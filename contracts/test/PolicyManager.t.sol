// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PolicyManager} from "../src/PolicyManager.sol";

contract PolicyManagerTest is Test {
    PolicyManager policies;
    address owner = address(0xA11CE);
    address vault = address(0xBEEF);
    address flight = address(0xF11);
    address hotel = address(0x2222);
    address unknown = address(0x9999);
    bytes4 buySel = bytes4(keccak256("purchaseFlight(string,uint256)"));
    address token = address(0x3333);

    uint256 policyId;

    function setUp() public {

        policies = new PolicyManager();
        policies.setVault(vault);

        address[] memory targets = new address[](2);
        targets[0] = flight;
        targets[1] = hotel;
        bytes4[] memory fns = new bytes4[](1);
        fns[0] = buySel;
        address[] memory tokens = new address[](1);
        tokens[0] = token;

        vm.prank(owner);
        policyId = policies.createPolicy(
            1,
            50e6,
            100e6,
            500e6,
            uint64(block.timestamp + 7 days),
            targets,
            fns,
            tokens
        );
    }

    function test_validTransaction() public {
        vm.prank(vault);
        policies.enforceAndRecord(policyId, flight, buySel, token, 37e6);
        PolicyManager.Policy memory p = policies.getPolicy(policyId);
        assertEq(p.spentToday, 37e6);
        assertEq(p.spentLifetime, 37e6);
    }

    function test_overLimitTransaction() public {
        vm.prank(vault);
        vm.expectRevert(abi.encodeWithSelector(PolicyManager.ExceedsMaxTransaction.selector, uint256(80e6), uint256(50e6)));
        policies.enforceAndRecord(policyId, flight, buySel, token, 80e6);
    }

    function test_expiredPolicy() public {
        vm.warp(block.timestamp + 8 days);
        vm.prank(vault);
        vm.expectRevert(abi.encodeWithSelector(PolicyManager.PolicyExpired.selector, policyId));
        policies.enforceAndRecord(policyId, flight, buySel, token, 10e6);
    }

    function test_wrongTarget() public {
        vm.prank(vault);
        vm.expectRevert(abi.encodeWithSelector(PolicyManager.TargetNotAllowed.selector, unknown));
        policies.enforceAndRecord(policyId, unknown, buySel, token, 10e6);
    }

    function test_wrongFunction() public {
        bytes4 bad = bytes4(keccak256("transfer(address,uint256)"));
        vm.prank(vault);
        vm.expectRevert(abi.encodeWithSelector(PolicyManager.FunctionNotAllowed.selector, bad));
        policies.enforceAndRecord(policyId, flight, bad, token, 10e6);
    }

    function test_dailyLimitExceeded() public {
        vm.startPrank(vault);
        policies.enforceAndRecord(policyId, flight, buySel, token, 50e6);
        policies.enforceAndRecord(policyId, flight, buySel, token, 50e6);
        vm.expectRevert();
        policies.enforceAndRecord(policyId, flight, buySel, token, 1e6);
        vm.stopPrank();
    }

    function test_lifetimeLimitExceeded() public {
        vm.startPrank(vault);
        // Spend exactly lifetime limit across days (100/day * 5)
        for (uint256 i = 0; i < 5; i++) {
            policies.enforceAndRecord(policyId, flight, buySel, token, 50e6);
            policies.enforceAndRecord(policyId, flight, buySel, token, 50e6);
            if (i < 4) {
                vm.warp(block.timestamp + 1 days + 1);
            }
        }
        PolicyManager.Policy memory p = policies.getPolicy(policyId);
        assertEq(p.spentLifetime, 500e6);

        vm.warp(block.timestamp + 1 days + 1);
        vm.expectRevert(
            abi.encodeWithSelector(PolicyManager.ExceedsLifetimeLimit.selector, uint256(1e6), uint256(0))
        );
        policies.enforceAndRecord(policyId, flight, buySel, token, 1e6);
        vm.stopPrank();
    }

    function test_simulateMatchesEnforce() public {
        (bool ok, string memory reason) = policies.simulate(policyId, flight, buySel, token, 80e6);
        assertFalse(ok);
        assertEq(reason, "Exceeds max transaction");

        (ok, reason) = policies.simulate(policyId, flight, buySel, token, 37e6);
        assertTrue(ok);
        assertEq(reason, "");
    }
}
