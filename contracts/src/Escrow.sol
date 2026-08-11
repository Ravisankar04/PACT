// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReputationRegistry} from "./ReputationRegistry.sol";

/**
 * @title Escrow
 * @notice Agent-to-agent escrow with centralized arbitration (MVP).
 * @dev Arbitration is intentionally centralized for MVP; design allows future decentralized resolvers.
 */
contract Escrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        None,
        Created,
        Funded,
        WorkSubmitted,
        Completed,
        Refunded,
        Disputed,
        Resolved
    }

    struct EscrowDeal {
        uint256 escrowId;
        uint256 payerAgentId;
        uint256 payeeAgentId;
        address payer;
        address payee;
        address token;
        uint256 amount;
        bytes32 termsHash;
        bytes32 workHash;
        Status status;
        uint64 createdAt;
        uint64 fundedAt;
        string disputeReason;
    }

    IERC20 public immutable paymentToken;
    ReputationRegistry public reputation;
    address public arbitrator;

    uint256 private _nextEscrowId = 1;
    mapping(uint256 => EscrowDeal) private _escrows;

    event EscrowCreated(
        uint256 indexed escrowId,
        uint256 indexed payerAgentId,
        uint256 indexed payeeAgentId,
        address payer,
        address payee,
        uint256 amount,
        bytes32 termsHash
    );
    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
    event WorkSubmitted(uint256 indexed escrowId, bytes32 workHash);
    event EscrowCompleted(uint256 indexed escrowId);
    event EscrowRefunded(uint256 indexed escrowId);
    event EscrowDisputed(uint256 indexed escrowId, string reason);
    event EscrowResolved(uint256 indexed escrowId, bool payeeWins);

    error EscrowNotFound(uint256 escrowId);
    error InvalidStatus(Status current, Status expected);
    error Unauthorized();
    error ZeroAmount();
    error ZeroAddress();
    error AlreadyFunded();

    constructor(address paymentToken_, address arbitrator_) Ownable(msg.sender) {
        if (paymentToken_ == address(0) || arbitrator_ == address(0)) revert ZeroAddress();
        paymentToken = IERC20(paymentToken_);
        arbitrator = arbitrator_;
    }

    function setReputation(address reputation_) external onlyOwner {
        reputation = ReputationRegistry(reputation_);
    }

    function setArbitrator(address arbitrator_) external onlyOwner {
        if (arbitrator_ == address(0)) revert ZeroAddress();
        arbitrator = arbitrator_;
    }

    function createEscrow(
        uint256 payerAgentId,
        uint256 payeeAgentId,
        address payee,
        uint256 amount,
        bytes32 termsHash
    ) external returns (uint256 escrowId) {
        if (amount == 0) revert ZeroAmount();
        if (payee == address(0)) revert ZeroAddress();

        escrowId = _nextEscrowId++;
        _escrows[escrowId] = EscrowDeal({
            escrowId: escrowId,
            payerAgentId: payerAgentId,
            payeeAgentId: payeeAgentId,
            payer: msg.sender,
            payee: payee,
            token: address(paymentToken),
            amount: amount,
            termsHash: termsHash,
            workHash: bytes32(0),
            status: Status.Created,
            createdAt: uint64(block.timestamp),
            fundedAt: 0,
            disputeReason: ""
        });

        emit EscrowCreated(escrowId, payerAgentId, payeeAgentId, msg.sender, payee, amount, termsHash);
    }

    function fundEscrow(uint256 escrowId) external nonReentrant {
        EscrowDeal storage e = _requireEscrow(escrowId);
        if (e.status != Status.Created) revert InvalidStatus(e.status, Status.Created);
        if (msg.sender != e.payer) revert Unauthorized();

        paymentToken.safeTransferFrom(msg.sender, address(this), e.amount);
        e.status = Status.Funded;
        e.fundedAt = uint64(block.timestamp);
        emit EscrowFunded(escrowId, e.amount);
    }

    function submitWork(uint256 escrowId, bytes32 workHash) external {
        EscrowDeal storage e = _requireEscrow(escrowId);
        if (e.status != Status.Funded) revert InvalidStatus(e.status, Status.Funded);
        if (msg.sender != e.payee) revert Unauthorized();
        e.workHash = workHash;
        e.status = Status.WorkSubmitted;
        emit WorkSubmitted(escrowId, workHash);
    }

    function approve(uint256 escrowId) external nonReentrant {
        EscrowDeal storage e = _requireEscrow(escrowId);
        if (e.status != Status.WorkSubmitted && e.status != Status.Funded) {
            revert InvalidStatus(e.status, Status.WorkSubmitted);
        }
        if (msg.sender != e.payer) revert Unauthorized();

        e.status = Status.Completed;
        paymentToken.safeTransfer(e.payee, e.amount);
        emit EscrowCompleted(escrowId);

        if (address(reputation) != address(0)) {
            reputation.recordEscrowCompleted(e.payeeAgentId, e.payerAgentId, true);
        }
    }

    function refund(uint256 escrowId) external nonReentrant {
        EscrowDeal storage e = _requireEscrow(escrowId);
        if (e.status != Status.Funded && e.status != Status.WorkSubmitted) {
            revert InvalidStatus(e.status, Status.Funded);
        }
        // Payee can agree to refund, or payer before work submitted
        bool allowed = (msg.sender == e.payee)
            || (msg.sender == e.payer && e.status == Status.Funded);
        if (!allowed) revert Unauthorized();

        e.status = Status.Refunded;
        paymentToken.safeTransfer(e.payer, e.amount);
        emit EscrowRefunded(escrowId);

        if (address(reputation) != address(0)) {
            reputation.recordEscrowCompleted(e.payeeAgentId, e.payerAgentId, false);
        }
    }

    function dispute(uint256 escrowId, string calldata reason) external {
        EscrowDeal storage e = _requireEscrow(escrowId);
        if (e.status != Status.WorkSubmitted && e.status != Status.Funded) {
            revert InvalidStatus(e.status, Status.WorkSubmitted);
        }
        if (msg.sender != e.payer && msg.sender != e.payee) revert Unauthorized();
        e.status = Status.Disputed;
        e.disputeReason = reason;
        emit EscrowDisputed(escrowId, reason);

        if (address(reputation) != address(0)) {
            reputation.recordDispute(e.payeeAgentId, e.payerAgentId);
        }
    }

    /**
     * @notice Centralized arbitration (MVP). `payeeWins` true releases funds to payee.
     */
    function resolveDispute(uint256 escrowId, bool payeeWins) external nonReentrant {
        if (msg.sender != arbitrator) revert Unauthorized();
        EscrowDeal storage e = _requireEscrow(escrowId);
        if (e.status != Status.Disputed) revert InvalidStatus(e.status, Status.Disputed);

        e.status = Status.Resolved;
        if (payeeWins) {
            paymentToken.safeTransfer(e.payee, e.amount);
        } else {
            paymentToken.safeTransfer(e.payer, e.amount);
        }
        emit EscrowResolved(escrowId, payeeWins);

        if (address(reputation) != address(0)) {
            reputation.recordEscrowCompleted(e.payeeAgentId, e.payerAgentId, payeeWins);
        }
    }

    function getEscrow(uint256 escrowId) external view returns (EscrowDeal memory) {
        return _requireEscrow(escrowId);
    }

    function _requireEscrow(uint256 escrowId) internal view returns (EscrowDeal storage e) {
        e = _escrows[escrowId];
        if (e.escrowId == 0) revert EscrowNotFound(escrowId);
    }
}
