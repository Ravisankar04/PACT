// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentRegistry
 * @notice Registers AI agents with on-chain identity and ownership.
 * @dev Only the agent owner may update or deactivate their agents.
 */
contract AgentRegistry is Ownable {
    struct Agent {
        uint256 agentId;
        address owner;
        address agentAddress;
        string metadataURI;
        uint64 createdAt;
        bool active;
    }

    uint256 private _nextAgentId = 1;
    mapping(uint256 => Agent) private _agents;
    mapping(address => uint256[]) private _ownerAgents;
    mapping(address => uint256) public agentIdByAddress;

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed owner,
        address indexed agentAddress,
        string metadataURI
    );
    event AgentUpdated(uint256 indexed agentId, address agentAddress, string metadataURI);
    event AgentDeactivated(uint256 indexed agentId);

    error AgentNotFound(uint256 agentId);
    error NotAgentOwner(uint256 agentId, address caller);
    error AgentInactive(uint256 agentId);
    error ZeroAddress();
    error AgentAddressInUse(address agentAddress);

    constructor() Ownable(msg.sender) {}

    function registerAgent(address agentAddress, string calldata metadataURI)
        external
        returns (uint256 agentId)
    {
        if (agentAddress == address(0)) revert ZeroAddress();
        if (agentIdByAddress[agentAddress] != 0) revert AgentAddressInUse(agentAddress);

        agentId = _nextAgentId++;
        _agents[agentId] = Agent({
            agentId: agentId,
            owner: msg.sender,
            agentAddress: agentAddress,
            metadataURI: metadataURI,
            createdAt: uint64(block.timestamp),
            active: true
        });
        _ownerAgents[msg.sender].push(agentId);
        agentIdByAddress[agentAddress] = agentId;

        emit AgentRegistered(agentId, msg.sender, agentAddress, metadataURI);
    }

    function updateAgent(uint256 agentId, address newAgentAddress, string calldata metadataURI) external {
        Agent storage agent = _requireOwnedActive(agentId);

        if (newAgentAddress == address(0)) revert ZeroAddress();

        if (newAgentAddress != agent.agentAddress) {
            if (agentIdByAddress[newAgentAddress] != 0) revert AgentAddressInUse(newAgentAddress);
            delete agentIdByAddress[agent.agentAddress];
            agent.agentAddress = newAgentAddress;
            agentIdByAddress[newAgentAddress] = agentId;
        }

        agent.metadataURI = metadataURI;
        emit AgentUpdated(agentId, newAgentAddress, metadataURI);
    }

    function deactivateAgent(uint256 agentId) external {
        Agent storage agent = _requireOwnedActive(agentId);
        agent.active = false;
        emit AgentDeactivated(agentId);
    }

    function getAgent(uint256 agentId) external view returns (Agent memory) {
        if (_agents[agentId].agentId == 0) revert AgentNotFound(agentId);
        return _agents[agentId];
    }

    function getAgentsByOwner(address owner) external view returns (uint256[] memory) {
        return _ownerAgents[owner];
    }

    function isActiveAgent(uint256 agentId) external view returns (bool) {
        return _agents[agentId].active;
    }

    function _requireOwnedActive(uint256 agentId) internal view returns (Agent storage agent) {
        agent = _agents[agentId];
        if (agent.agentId == 0) revert AgentNotFound(agentId);
        if (agent.owner != msg.sender) revert NotAgentOwner(agentId, msg.sender);
        if (!agent.active) revert AgentInactive(agentId);
    }
}
