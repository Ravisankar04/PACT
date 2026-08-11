// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {PolicyManager} from "../src/PolicyManager.sol";
import {AgentVault} from "../src/AgentVault.sol";
import {MockFlightProvider} from "../src/MockFlightProvider.sol";

contract AgentVaultTest is Test {
    MockUSDC usdc;
    AgentRegistry registry;
    PolicyManager policies;
    AgentVault vault;
    MockFlightProvider flights;

    uint256 ownerKey = 0xA11CE;
    address owner;
    address agentAddr = address(0xB01);
    uint256 agentId;
    uint256 policyId;

    bytes32 constant TYPEHASH = keccak256(
        "AgentAction(uint256 agentId,uint256 policyId,address target,uint256 value,address token,uint256 amount,bytes32 dataHash,uint256 nonce,uint256 deadline)"
    );

    function setUp() public {
        owner = vm.addr(ownerKey);
        usdc = new MockUSDC();
        registry = new AgentRegistry();
        policies = new PolicyManager();
        vault = new AgentVault(address(registry), address(policies), address(usdc));
        policies.setVault(address(vault));
        flights = new MockFlightProvider(address(usdc));

        usdc.mint(owner, 1000e6);

        vm.startPrank(owner);
        agentId = registry.registerAgent(agentAddr, "ipfs://travel");

        address[] memory targets = new address[](1);
        targets[0] = address(flights);
        bytes4[] memory fns = new bytes4[](1);
        fns[0] = MockFlightProvider.purchaseFlight.selector;
        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);

        policyId = policies.createPolicy(
            agentId, 50e6, 100e6, 500e6, uint64(block.timestamp + 7 days), targets, fns, tokens
        );

        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(200e6);
        vm.stopPrank();
    }

    function _sign(AgentVault.AgentAction memory action, uint256 key) internal view returns (bytes memory) {
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

    function _action(uint256 amount, uint256 nonce, uint256 deadline, bytes memory data)
        internal
        view
        returns (AgentVault.AgentAction memory)
    {
        return AgentVault.AgentAction({
            agentId: agentId,
            policyId: policyId,
            target: address(flights),
            value: 0,
            token: address(usdc),
            amount: amount,
            dataHash: keccak256(data),
            nonce: nonce,
            deadline: deadline
        });
    }

    function test_depositWithdraw() public {
        assertEq(vault.balances(owner), 200e6);
        vm.prank(owner);
        vault.withdraw(50e6);
        assertEq(vault.balances(owner), 150e6);
    }

    function test_unauthorizedWithdrawal() public {
        vm.prank(address(0xBAD));
        vm.expectRevert();
        vault.withdraw(1e6);
    }

    function test_validSignatureExecution() public {
        bytes memory data = abi.encodeWithSelector(MockFlightProvider.purchaseFlight.selector, "AA100", uint256(37e6));
        AgentVault.AgentAction memory action = _action(37e6, 1, block.timestamp + 1 hours, data);
        bytes memory sig = _sign(action, ownerKey);

        vm.prank(agentAddr);
        vault.execute(action, data, sig);

        assertEq(vault.balances(owner), 163e6);
        assertTrue(vault.usedNonces(agentId, 1));
    }

    function test_wrongSigner() public {
        bytes memory data = abi.encodeWithSelector(MockFlightProvider.purchaseFlight.selector, "AA100", uint256(37e6));
        AgentVault.AgentAction memory action = _action(37e6, 1, block.timestamp + 1 hours, data);
        bytes memory sig = _sign(action, 0xDEAD);

        vm.prank(agentAddr);
        vm.expectRevert(AgentVault.InvalidSignature.selector);
        vault.execute(action, data, sig);
    }

    function test_expiredSignature() public {
        bytes memory data = abi.encodeWithSelector(MockFlightProvider.purchaseFlight.selector, "AA100", uint256(37e6));
        AgentVault.AgentAction memory action = _action(37e6, 1, block.timestamp - 1, data);
        bytes memory sig = _sign(action, ownerKey);

        vm.prank(agentAddr);
        vm.expectRevert(abi.encodeWithSelector(AgentVault.SignatureExpired.selector, action.deadline));
        vault.execute(action, data, sig);
    }

    function test_replayedSignature() public {
        bytes memory data = abi.encodeWithSelector(MockFlightProvider.purchaseFlight.selector, "AA100", uint256(37e6));
        AgentVault.AgentAction memory action = _action(37e6, 1, block.timestamp + 1 hours, data);
        bytes memory sig = _sign(action, ownerKey);

        vm.prank(agentAddr);
        vault.execute(action, data, sig);

        vm.prank(agentAddr);
        vm.expectRevert(abi.encodeWithSelector(AgentVault.NonceAlreadyUsed.selector, agentId, uint256(1)));
        vault.execute(action, data, sig);
    }

    function test_wrongNonceReuseAfterRejectPath() public {
        // Same nonce cannot be reused even if we craft another action
        bytes memory data = abi.encodeWithSelector(MockFlightProvider.purchaseFlight.selector, "AA100", uint256(37e6));
        AgentVault.AgentAction memory action = _action(37e6, 5, block.timestamp + 1 hours, data);
        bytes memory sig = _sign(action, ownerKey);
        vm.prank(agentAddr);
        vault.execute(action, data, sig);

        bytes memory data2 = abi.encodeWithSelector(MockFlightProvider.purchaseFlight.selector, "BB200", uint256(20e6));
        AgentVault.AgentAction memory action2 = _action(20e6, 5, block.timestamp + 1 hours, data2);
        bytes memory sig2 = _sign(action2, ownerKey);
        vm.prank(agentAddr);
        vm.expectRevert(abi.encodeWithSelector(AgentVault.NonceAlreadyUsed.selector, agentId, uint256(5)));
        vault.execute(action2, data2, sig2);
    }

    function test_policyRejectOverLimit() public {
        bytes memory data = abi.encodeWithSelector(MockFlightProvider.purchaseFlight.selector, "AA100", uint256(80e6));
        AgentVault.AgentAction memory action = _action(80e6, 2, block.timestamp + 1 hours, data);
        bytes memory sig = _sign(action, ownerKey);

        vm.prank(agentAddr);
        vm.expectRevert();
        vault.execute(action, data, sig);

        // Full revert: funds untouched and nonce rolled back (Solidity atomicity).
        assertEq(vault.balances(owner), 200e6);
        assertFalse(vault.usedNonces(agentId, 2));
    }

    function test_wrongChainDomain() public {
        bytes memory data = abi.encodeWithSelector(MockFlightProvider.purchaseFlight.selector, "AA100", uint256(37e6));
        AgentVault.AgentAction memory action = _action(37e6, 3, block.timestamp + 1 hours, data);

        // Sign with wrong domain separator (simulating wrong chain)
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
        bytes32 wrongDomain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("PACT AgentVault")),
                keccak256(bytes("1")),
                uint256(999),
                address(vault)
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", wrongDomain, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(agentAddr);
        vm.expectRevert(AgentVault.InvalidSignature.selector);
        vault.execute(action, data, sig);
    }

    function test_wrongContractDomain() public {
        bytes memory data = abi.encodeWithSelector(MockFlightProvider.purchaseFlight.selector, "AA100", uint256(37e6));
        AgentVault.AgentAction memory action = _action(37e6, 4, block.timestamp + 1 hours, data);

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
        bytes32 wrongDomain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("PACT AgentVault")),
                keccak256(bytes("1")),
                block.chainid,
                address(0xDEAD)
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", wrongDomain, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(agentAddr);
        vm.expectRevert(AgentVault.InvalidSignature.selector);
        vault.execute(action, data, sig);
    }
}
