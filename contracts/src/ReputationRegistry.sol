// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ReputationRegistry
 * @notice Reputation derived from verifiable protocol events — agents cannot self-set scores.
 *
 * ## Score Formula (documented)
 *
 * Let:
 *   S = successfulTasks
 *   F = failedTasks
 *   D = disputes
 *   V = policyViolations
 *   C = completedEscrows
 *
 * successRate = S / max(S + F, 1)          // 0..1
 * volumeBonus = min(C, 100) / 100          // 0..1 capped
 * disputePenalty = min(D * 3, 40)          // up to -40
 * violationPenalty = min(V * 10, 50)       // up to -50
 *
 * raw = successRate * 70 + volumeBonus * 30 - disputePenalty - violationPenalty
 * score = clamp(round(raw), 0, 100)
 */
contract ReputationRegistry is AccessControl {
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");

    struct Stats {
        uint256 successfulTasks;
        uint256 failedTasks;
        uint256 disputes;
        uint256 policyViolations;
        uint256 completedEscrows;
        uint256 score; // cached 0..100
    }

    mapping(uint256 => Stats) private _stats;

    event ReputationUpdated(
        uint256 indexed agentId,
        uint256 score,
        uint256 successfulTasks,
        uint256 failedTasks,
        uint256 disputes,
        uint256 policyViolations,
        uint256 completedEscrows
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RECORDER_ROLE, msg.sender);
    }

    function recordSuccess(uint256 agentId) external onlyRole(RECORDER_ROLE) {
        Stats storage s = _stats[agentId];
        s.successfulTasks += 1;
        _recompute(agentId);
    }

    function recordFailure(uint256 agentId) external onlyRole(RECORDER_ROLE) {
        Stats storage s = _stats[agentId];
        s.failedTasks += 1;
        _recompute(agentId);
    }

    function recordPolicyViolation(uint256 agentId) external onlyRole(RECORDER_ROLE) {
        Stats storage s = _stats[agentId];
        s.policyViolations += 1;
        _recompute(agentId);
    }

    function recordDispute(uint256 payeeAgentId, uint256 payerAgentId) external onlyRole(RECORDER_ROLE) {
        _stats[payeeAgentId].disputes += 1;
        _stats[payerAgentId].disputes += 1;
        _recompute(payeeAgentId);
        _recompute(payerAgentId);
    }

    function recordEscrowCompleted(uint256 payeeAgentId, uint256 payerAgentId, bool success)
        external
        onlyRole(RECORDER_ROLE)
    {
        Stats storage payee = _stats[payeeAgentId];
        payee.completedEscrows += 1;
        if (success) {
            payee.successfulTasks += 1;
        } else {
            payee.failedTasks += 1;
        }
        _stats[payerAgentId].completedEscrows += 1;
        _recompute(payeeAgentId);
        _recompute(payerAgentId);
    }

    function getStats(uint256 agentId) external view returns (Stats memory) {
        return _stats[agentId];
    }

    function getScore(uint256 agentId) external view returns (uint256) {
        return _stats[agentId].score;
    }

    function computeScore(Stats memory s) public pure returns (uint256) {
        uint256 total = s.successfulTasks + s.failedTasks;
        uint256 successRateBps = total == 0 ? 5000 : (s.successfulTasks * 10_000) / total; // basis points
        uint256 volumeBonusBps = s.completedEscrows >= 100 ? 10_000 : (s.completedEscrows * 10_000) / 100;

        uint256 disputePenalty = s.disputes * 3;
        if (disputePenalty > 40) disputePenalty = 40;
        uint256 violationPenalty = s.policyViolations * 10;
        if (violationPenalty > 50) violationPenalty = 50;

        // raw = successRate*70 + volumeBonus*30 - penalties  (using bps)
        uint256 positive = (successRateBps * 70 + volumeBonusBps * 30) / 10_000;
        if (positive < disputePenalty + violationPenalty) return 0;
        uint256 raw = positive - disputePenalty - violationPenalty;
        if (raw > 100) return 100;
        return raw;
    }

    function _recompute(uint256 agentId) internal {
        Stats storage s = _stats[agentId];
        s.score = computeScore(s);
        emit ReputationUpdated(
            agentId, s.score, s.successfulTasks, s.failedTasks, s.disputes, s.policyViolations, s.completedEscrows
        );
    }
}
