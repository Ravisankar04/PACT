// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {PolicyManager} from "../src/PolicyManager.sol";
import {AgentVault} from "../src/AgentVault.sol";
import {Escrow} from "../src/Escrow.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {MockFlightProvider} from "../src/MockFlightProvider.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        MockUSDC usdc = new MockUSDC();
        AgentRegistry registry = new AgentRegistry();
        PolicyManager policies = new PolicyManager();
        AgentVault vault = new AgentVault(address(registry), address(policies), address(usdc));
        policies.setVault(address(vault));

        Escrow escrow = new Escrow(address(usdc), deployer);
        ReputationRegistry reputation = new ReputationRegistry();
        escrow.setReputation(address(reputation));
        reputation.grantRole(reputation.RECORDER_ROLE(), address(escrow));
        reputation.grantRole(reputation.RECORDER_ROLE(), address(vault));

        MockFlightProvider flights = new MockFlightProvider(address(usdc));

        // Seed deployer with test USDC
        usdc.mint(deployer, 1_000_000 * 1e6);

        vm.stopBroadcast();

        console2.log("CHAIN_ID", block.chainid);
        console2.log("MockUSDC", address(usdc));
        console2.log("AgentRegistry", address(registry));
        console2.log("PolicyManager", address(policies));
        console2.log("AgentVault", address(vault));
        console2.log("Escrow", address(escrow));
        console2.log("ReputationRegistry", address(reputation));
        console2.log("MockFlightProvider", address(flights));

        string memory json = string.concat(
            "{\n",
            '  "chainId": ',
            vm.toString(block.chainid),
            ",\n",
            '  "MockUSDC": "',
            vm.toString(address(usdc)),
            '",\n',
            '  "AgentRegistry": "',
            vm.toString(address(registry)),
            '",\n',
            '  "PolicyManager": "',
            vm.toString(address(policies)),
            '",\n',
            '  "AgentVault": "',
            vm.toString(address(vault)),
            '",\n',
            '  "Escrow": "',
            vm.toString(address(escrow)),
            '",\n',
            '  "ReputationRegistry": "',
            vm.toString(address(reputation)),
            '",\n',
            '  "MockFlightProvider": "',
            vm.toString(address(flights)),
            '"\n',
            "}\n"
        );
        vm.writeFile("deployments/local.json", json);
    }
}
