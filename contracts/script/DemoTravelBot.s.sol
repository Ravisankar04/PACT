// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {PolicyManager} from "../src/PolicyManager.sol";
import {AgentVault} from "../src/AgentVault.sol";
import {MockFlightProvider} from "../src/MockFlightProvider.sol";

/**
 * @notice Deterministic TravelBot portfolio demo against already-deployed contracts.
 * Env: MOCK_USDC_ADDRESS, AGENT_REGISTRY_ADDRESS, POLICY_MANAGER_ADDRESS,
 *      AGENT_VAULT_ADDRESS, MOCK_FLIGHT_PROVIDER_ADDRESS, DEPLOYER_PRIVATE_KEY
 */
contract DemoTravelBot is Script {
    bytes32 constant TYPEHASH = keccak256(
        "AgentAction(uint256 agentId,uint256 policyId,address target,uint256 value,address token,uint256 amount,bytes32 dataHash,uint256 nonce,uint256 deadline)"
    );

    function run() external {
        uint256 key = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address owner = vm.addr(key);

        MockUSDC usdc = MockUSDC(vm.envAddress("MOCK_USDC_ADDRESS"));
        AgentRegistry registry = AgentRegistry(vm.envAddress("AGENT_REGISTRY_ADDRESS"));
        PolicyManager policies = PolicyManager(vm.envAddress("POLICY_MANAGER_ADDRESS"));
        AgentVault vault = AgentVault(payable(vm.envAddress("AGENT_VAULT_ADDRESS")));
        MockFlightProvider flights = MockFlightProvider(vm.envAddress("MOCK_FLIGHT_PROVIDER_ADDRESS"));

        vm.startBroadcast(key);

        uint256 agentId = registry.registerAgent(owner, "ipfs://travelbot");
        bytes4 selector = MockFlightProvider.purchaseFlight.selector;
        address[] memory targets = new address[](1);
        targets[0] = address(flights);
        bytes4[] memory fns = new bytes4[](1);
        fns[0] = selector;
        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);

        uint256 policyId = policies.createPolicy(
            agentId, 50e6, 100e6, 500e6, uint64(block.timestamp + 7 days), targets, fns, tokens
        );

        usdc.faucet(10_000e6);
        usdc.approve(address(vault), 200e6);
        vault.deposit(200e6);

        // SUCCESS: $37.42
        bytes memory dataOk = abi.encodeWithSelector(selector, "AA100", uint256(37_420_000));
        AgentVault.AgentAction memory okAction = AgentVault.AgentAction({
            agentId: agentId,
            policyId: policyId,
            target: address(flights),
            value: 0,
            token: address(usdc),
            amount: 37_420_000,
            dataHash: keccak256(dataOk),
            nonce: 1,
            deadline: block.timestamp + 1 hours
        });
        bytes memory okSig = _sign(vault, okAction, key);
        vault.execute(okAction, dataOk, okSig);
        console2.log("SUCCESS purchase 37.42 USDC");
        console2.log("vaultBalance", vault.balances(owner));
        console2.log("agentId", agentId);
        console2.log("policyId", policyId);
        vm.stopBroadcast();

        // REJECTED: $80 — verify via simulate (no broadcast of reverting tx)
        (bool allowed, string memory reason) = policies.simulate(
            policyId, address(flights), selector, address(usdc), 80e6
        );
        console2.log("80 USDC allowed?", allowed);
        console2.log("reject reason:", reason);
        require(!allowed, "expected rejection");
    }

    function _sign(AgentVault vault, AgentVault.AgentAction memory action, uint256 key)
        internal
        view
        returns (bytes memory)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                TYPEHASH,
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
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", vault.domainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }
}
