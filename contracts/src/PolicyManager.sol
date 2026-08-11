// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PolicyManager
 * @notice On-chain spending and target policies for AI agents.
 * @dev Policy enforcement is the source of truth — backends must not bypass this contract.
 */
contract PolicyManager is Ownable {
    struct Policy {
        uint256 policyId;
        uint256 agentId;
        address owner;
        uint256 maxTransaction;
        uint256 dailyLimit;
        uint256 lifetimeLimit;
        uint64 expiration;
        address[] allowedTargets;
        bytes4[] allowedFunctions;
        address[] allowedTokens;
        bool active;
        uint256 spentLifetime;
        uint256 spentToday;
        uint64 dayStart;
    }

    uint256 private _nextPolicyId = 1;
    mapping(uint256 => Policy) private _policies;
    mapping(uint256 => uint256) public policyIdByAgent; // latest active binding (optional helper)

    event PolicyCreated(
        uint256 indexed policyId,
        uint256 indexed agentId,
        address indexed owner,
        uint256 maxTransaction,
        uint256 dailyLimit,
        uint256 lifetimeLimit,
        uint64 expiration
    );
    event PolicyUpdated(uint256 indexed policyId);
    event PolicyDeactivated(uint256 indexed policyId);
    event PolicySpendRecorded(uint256 indexed policyId, uint256 amount, uint256 spentToday, uint256 spentLifetime);

    error PolicyNotFound(uint256 policyId);
    error NotPolicyOwner(uint256 policyId, address caller);
    error PolicyInactive(uint256 policyId);
    error PolicyExpired(uint256 policyId);
    error ExceedsMaxTransaction(uint256 amount, uint256 maxTransaction);
    error ExceedsDailyLimit(uint256 amount, uint256 remaining);
    error ExceedsLifetimeLimit(uint256 amount, uint256 remaining);
    error TargetNotAllowed(address target);
    error FunctionNotAllowed(bytes4 selector);
    error TokenNotAllowed(address token);
    error InvalidLimits();

    constructor() Ownable(msg.sender) {}

    function createPolicy(
        uint256 agentId,
        uint256 maxTransaction,
        uint256 dailyLimit,
        uint256 lifetimeLimit,
        uint64 expiration,
        address[] calldata allowedTargets,
        bytes4[] calldata allowedFunctions,
        address[] calldata allowedTokens
    ) external returns (uint256 policyId) {
        if (maxTransaction == 0 || dailyLimit == 0 || lifetimeLimit == 0) revert InvalidLimits();
        if (maxTransaction > dailyLimit || dailyLimit > lifetimeLimit) revert InvalidLimits();

        policyId = _nextPolicyId++;
        Policy storage p = _policies[policyId];
        p.policyId = policyId;
        p.agentId = agentId;
        p.owner = msg.sender;
        p.maxTransaction = maxTransaction;
        p.dailyLimit = dailyLimit;
        p.lifetimeLimit = lifetimeLimit;
        p.expiration = expiration;
        p.active = true;
        p.dayStart = uint64(block.timestamp);

        for (uint256 i = 0; i < allowedTargets.length; i++) {
            p.allowedTargets.push(allowedTargets[i]);
        }
        for (uint256 i = 0; i < allowedFunctions.length; i++) {
            p.allowedFunctions.push(allowedFunctions[i]);
        }
        for (uint256 i = 0; i < allowedTokens.length; i++) {
            p.allowedTokens.push(allowedTokens[i]);
        }

        policyIdByAgent[agentId] = policyId;

        emit PolicyCreated(
            policyId, agentId, msg.sender, maxTransaction, dailyLimit, lifetimeLimit, expiration
        );
    }

    function updatePolicy(
        uint256 policyId,
        uint256 maxTransaction,
        uint256 dailyLimit,
        uint256 lifetimeLimit,
        uint64 expiration,
        address[] calldata allowedTargets,
        bytes4[] calldata allowedFunctions,
        address[] calldata allowedTokens,
        bool active
    ) external {
        Policy storage p = _requireOwner(policyId);
        if (maxTransaction == 0 || dailyLimit == 0 || lifetimeLimit == 0) revert InvalidLimits();
        if (maxTransaction > dailyLimit || dailyLimit > lifetimeLimit) revert InvalidLimits();

        p.maxTransaction = maxTransaction;
        p.dailyLimit = dailyLimit;
        p.lifetimeLimit = lifetimeLimit;
        p.expiration = expiration;
        p.active = active;

        delete p.allowedTargets;
        delete p.allowedFunctions;
        delete p.allowedTokens;

        for (uint256 i = 0; i < allowedTargets.length; i++) {
            p.allowedTargets.push(allowedTargets[i]);
        }
        for (uint256 i = 0; i < allowedFunctions.length; i++) {
            p.allowedFunctions.push(allowedFunctions[i]);
        }
        for (uint256 i = 0; i < allowedTokens.length; i++) {
            p.allowedTokens.push(allowedTokens[i]);
        }

        emit PolicyUpdated(policyId);
    }

    function deactivatePolicy(uint256 policyId) external {
        Policy storage p = _requireOwner(policyId);
        p.active = false;
        emit PolicyDeactivated(policyId);
    }

    function getPolicy(uint256 policyId) external view returns (Policy memory) {
        if (_policies[policyId].policyId == 0) revert PolicyNotFound(policyId);
        return _policies[policyId];
    }

    /**
     * @notice Pure simulation helper used by off-chain simulators and AgentVault.
     */
    function simulate(
        uint256 policyId,
        address target,
        bytes4 functionSelector,
        address token,
        uint256 amount
    ) external view returns (bool allowed, string memory reason) {
        Policy storage p = _policies[policyId];
        if (p.policyId == 0) return (false, "Policy not found");
        if (!p.active) return (false, "Policy inactive");
        if (p.expiration != 0 && block.timestamp > p.expiration) return (false, "Policy expired");
        if (amount > p.maxTransaction) return (false, "Exceeds max transaction");

        uint256 spentToday = _effectiveSpentToday(p);
        if (spentToday + amount > p.dailyLimit) return (false, "Exceeds daily limit");
        if (p.spentLifetime + amount > p.lifetimeLimit) return (false, "Exceeds lifetime limit");
        if (!_isTargetAllowed(p, target)) return (false, "Target not allowed");
        if (!_isFunctionAllowed(p, functionSelector)) return (false, "Function not allowed");
        if (!_isTokenAllowed(p, token)) return (false, "Token not allowed");

        return (true, "");
    }

    /**
     * @notice Enforce policy and record spend. Callable by authorized vault only via owner-set role.
     * @dev AgentVault is granted access by becoming Ownable-transferred or via setVault.
     */
    address public vault;

    function setVault(address vault_) external onlyOwner {
        vault = vault_;
    }

    modifier onlyVault() {
        require(msg.sender == vault, "Not vault");
        _;
    }

    function enforceAndRecord(
        uint256 policyId,
        address target,
        bytes4 functionSelector,
        address token,
        uint256 amount
    ) external onlyVault {
        Policy storage p = _policies[policyId];
        if (p.policyId == 0) revert PolicyNotFound(policyId);
        if (!p.active) revert PolicyInactive(policyId);
        if (p.expiration != 0 && block.timestamp > p.expiration) revert PolicyExpired(policyId);
        if (amount > p.maxTransaction) revert ExceedsMaxTransaction(amount, p.maxTransaction);

        _rolloverDay(p);

        if (p.spentToday + amount > p.dailyLimit) {
            uint256 dailyRemaining = p.spentToday >= p.dailyLimit ? 0 : p.dailyLimit - p.spentToday;
            revert ExceedsDailyLimit(amount, dailyRemaining);
        }
        if (p.spentLifetime + amount > p.lifetimeLimit) {
            uint256 lifeRemaining = p.spentLifetime >= p.lifetimeLimit ? 0 : p.lifetimeLimit - p.spentLifetime;
            revert ExceedsLifetimeLimit(amount, lifeRemaining);
        }
        if (!_isTargetAllowed(p, target)) revert TargetNotAllowed(target);
        if (!_isFunctionAllowed(p, functionSelector)) revert FunctionNotAllowed(functionSelector);
        if (!_isTokenAllowed(p, token)) revert TokenNotAllowed(token);

        p.spentToday += amount;
        p.spentLifetime += amount;

        emit PolicySpendRecorded(policyId, amount, p.spentToday, p.spentLifetime);
    }

    function _requireOwner(uint256 policyId) internal view returns (Policy storage p) {
        p = _policies[policyId];
        if (p.policyId == 0) revert PolicyNotFound(policyId);
        if (p.owner != msg.sender) revert NotPolicyOwner(policyId, msg.sender);
    }

    function _rolloverDay(Policy storage p) internal {
        if (block.timestamp >= p.dayStart + 1 days) {
            p.dayStart = uint64(block.timestamp);
            p.spentToday = 0;
        }
    }

    function _effectiveSpentToday(Policy storage p) internal view returns (uint256) {
        if (block.timestamp >= p.dayStart + 1 days) return 0;
        return p.spentToday;
    }

    function _isTargetAllowed(Policy storage p, address target) internal view returns (bool) {
        if (p.allowedTargets.length == 0) return true; // empty = allow all (dev convenience); production should set list
        for (uint256 i = 0; i < p.allowedTargets.length; i++) {
            if (p.allowedTargets[i] == target) return true;
        }
        return false;
    }

    function _isFunctionAllowed(Policy storage p, bytes4 selector) internal view returns (bool) {
        if (p.allowedFunctions.length == 0) return true;
        for (uint256 i = 0; i < p.allowedFunctions.length; i++) {
            if (p.allowedFunctions[i] == selector) return true;
        }
        return false;
    }

    function _isTokenAllowed(Policy storage p, address token) internal view returns (bool) {
        if (p.allowedTokens.length == 0) return true;
        for (uint256 i = 0; i < p.allowedTokens.length; i++) {
            if (p.allowedTokens[i] == token) return true;
        }
        return false;
    }
}
