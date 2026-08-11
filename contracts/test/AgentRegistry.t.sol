// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";

contract AgentRegistryTest is Test {
    AgentRegistry registry;
    address owner = address(0xA11CE);
    address agentAddr = address(0xB01);
    address stranger = address(0xBAD);

    function setUp() public {
        registry = new AgentRegistry();
        vm.prank(owner);
        registry.registerAgent(agentAddr, "ipfs://travelbot");
    }

    function test_register() public view {
        AgentRegistry.Agent memory a = registry.getAgent(1);
        assertEq(a.owner, owner);
        assertEq(a.agentAddress, agentAddr);
        assertTrue(a.active);
        assertEq(registry.agentIdByAddress(agentAddr), 1);
    }

    function test_update() public {
        address newAddr = address(0xB02);
        vm.prank(owner);
        registry.updateAgent(1, newAddr, "ipfs://v2");
        AgentRegistry.Agent memory a = registry.getAgent(1);
        assertEq(a.agentAddress, newAddr);
        assertEq(a.metadataURI, "ipfs://v2");
    }

    function test_deactivate() public {
        vm.prank(owner);
        registry.deactivateAgent(1);
        assertFalse(registry.getAgent(1).active);
    }

    function test_unauthorizedUpdate() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.NotAgentOwner.selector, uint256(1), stranger));
        registry.updateAgent(1, address(0x1), "x");
    }

    function test_cannotReuseAgentAddress() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.AgentAddressInUse.selector, agentAddr));
        registry.registerAgent(agentAddr, "dup");
    }
}
