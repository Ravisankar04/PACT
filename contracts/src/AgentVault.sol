// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AgentRegistry} from "./AgentRegistry.sol";
import {PolicyManager} from "./PolicyManager.sol";

/**
 * @title AgentVault
 * @notice Policy-constrained vault for AI agent spending via EIP-712 delegated authorization.
 * @dev The agent never holds the user's primary key. Owner signs AgentAction authorizations.
 */
contract AgentVault is Ownable, ReentrancyGuard, Pausable, EIP712 {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    bytes32 public constant AGENT_ACTION_TYPEHASH = keccak256(
        "AgentAction(uint256 agentId,uint256 policyId,address target,uint256 value,address token,uint256 amount,bytes32 dataHash,uint256 nonce,uint256 deadline)"
    );

    struct AgentAction {
        uint256 agentId;
        uint256 policyId;
        address target;
        uint256 value;
        address token;
        uint256 amount;
        bytes32 dataHash;
        uint256 nonce;
        uint256 deadline;
    }

    AgentRegistry public immutable registry;
    PolicyManager public immutable policyManager;
    IERC20 public immutable paymentToken;

    mapping(address => uint256) public balances; // owner => token balance
    mapping(uint256 => mapping(uint256 => bool)) public usedNonces; // agentId => nonce => used
    mapping(bytes32 => bool) public receiptExists;
    mapping(bytes32 => bytes32) public receiptHashOnChain; // receiptId => content hash

    event FundsDeposited(address indexed owner, uint256 amount, uint256 newBalance);
    event FundsWithdrawn(address indexed owner, uint256 amount, uint256 newBalance);
    event ActionExecuted(
        uint256 indexed agentId,
        uint256 indexed policyId,
        address indexed target,
        address token,
        uint256 amount,
        uint256 nonce,
        bytes32 receiptId,
        bytes32 receiptHash,
        bytes result
    );
    event ActionRejected(uint256 indexed agentId, uint256 indexed policyId, string reason);

    error InsufficientBalance(uint256 requested, uint256 available);
    error InvalidSignature();
    error SignatureExpired(uint256 deadline);
    error NonceAlreadyUsed(uint256 agentId, uint256 nonce);
    error AgentNotActive(uint256 agentId);
    error UnauthorizedAgent(uint256 agentId, address caller);
    error NotAgentOwner(uint256 agentId, address caller);
    error ZeroAddress();
    error CallFailed(bytes returnData);
    error InvalidTarget();

    constructor(address registry_, address policyManager_, address paymentToken_)
        Ownable(msg.sender)
        EIP712("PACT AgentVault", "1")
    {
        if (registry_ == address(0) || policyManager_ == address(0) || paymentToken_ == address(0)) {
            revert ZeroAddress();
        }
        registry = AgentRegistry(registry_);
        policyManager = PolicyManager(policyManager_);
        paymentToken = IERC20(paymentToken_);
    }

    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        balances[msg.sender] += amount;
        emit FundsDeposited(msg.sender, amount, balances[msg.sender]);
    }

    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        uint256 bal = balances[msg.sender];
        if (amount > bal) revert InsufficientBalance(amount, bal);
        balances[msg.sender] = bal - amount;
        paymentToken.safeTransfer(msg.sender, amount);
        emit FundsWithdrawn(msg.sender, amount, balances[msg.sender]);
    }

    /**
     * @notice Execute a policy-constrained action authorized by the agent owner's EIP-712 signature.
     * @param action Typed action parameters.
     * @param data Calldata forwarded to target (hash must match action.dataHash).
     * @param signature EIP-712 signature from the agent owner.
     */
    function execute(AgentAction calldata action, bytes calldata data, bytes calldata signature)
        external
        nonReentrant
        whenNotPaused
        returns (bytes memory result, bytes32 receiptId)
    {
        if (action.target == address(0) || action.target == address(this)) revert InvalidTarget();
        if (block.timestamp > action.deadline) revert SignatureExpired(action.deadline);
        if (usedNonces[action.agentId][action.nonce]) revert NonceAlreadyUsed(action.agentId, action.nonce);
        if (keccak256(data) != action.dataHash) revert InvalidSignature();

        AgentRegistry.Agent memory agent = registry.getAgent(action.agentId);
        if (!agent.active) revert AgentNotActive(action.agentId);

        // Caller must be the registered agent address (delegated executor) OR the owner
        if (msg.sender != agent.agentAddress && msg.sender != agent.owner) {
            revert UnauthorizedAgent(action.agentId, msg.sender);
        }

        bytes32 structHash = keccak256(
            abi.encode(
                AGENT_ACTION_TYPEHASH,
                action.agentId,
                action.policyId,
                action.target,
                action.value,
                action.token,
                action.amount,
                action.dataHash,
                action.nonce,
                action.deadline
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        if (signer != agent.owner) revert InvalidSignature();

        // Mark nonce BEFORE external calls (CEI)
        usedNonces[action.agentId][action.nonce] = true;

        bytes4 selector = data.length >= 4 ? bytes4(data[0:4]) : bytes4(0);

        // Policy enforcement (reverts on violation)
        policyManager.enforceAndRecord(action.policyId, action.target, selector, action.token, action.amount);

        // Debit + approve pull pattern so failed calls do not strand funds
        if (action.amount > 0 && action.token == address(paymentToken)) {
            uint256 bal = balances[agent.owner];
            if (action.amount > bal) revert InsufficientBalance(action.amount, bal);
            balances[agent.owner] = bal - action.amount;
            paymentToken.forceApprove(action.target, action.amount);
        }

        (bool ok, bytes memory returnData) = action.target.call{value: action.value}(data);

        if (action.amount > 0 && action.token == address(paymentToken)) {
            paymentToken.forceApprove(action.target, 0);
        }

        if (!ok) {
            if (action.amount > 0 && action.token == address(paymentToken)) {
                balances[agent.owner] += action.amount;
            }
            emit ActionRejected(action.agentId, action.policyId, "Target call failed");
            revert CallFailed(returnData);
        }
        result = returnData;

        receiptId = keccak256(
            abi.encode(
                block.chainid,
                address(this),
                action.agentId,
                action.policyId,
                action.target,
                action.token,
                action.amount,
                action.nonce,
                block.number,
                block.timestamp
            )
        );
        bytes32 contentHash = keccak256(abi.encode(receiptId, action, block.timestamp));
        receiptExists[receiptId] = true;
        receiptHashOnChain[receiptId] = contentHash;

        emit ActionExecuted(
            action.agentId,
            action.policyId,
            action.target,
            action.token,
            action.amount,
            action.nonce,
            receiptId,
            contentHash,
            result
        );
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function hashAction(AgentAction calldata action) external view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                AGENT_ACTION_TYPEHASH,
                action.agentId,
                action.policyId,
                action.target,
                action.value,
                action.token,
                action.amount,
                action.dataHash,
                action.nonce,
                action.deadline
            )
        );
        return _hashTypedDataV4(structHash);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    receive() external payable {
        revert("Native not supported");
    }
}
