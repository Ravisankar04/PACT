// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {Escrow} from "../src/Escrow.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";

contract EscrowTest is Test {
    MockUSDC usdc;
    Escrow escrow;
    ReputationRegistry reputation;

    address arbitrator = address(0xA8B);
    address payer = address(0x1111);
    address payee = address(0x2222);

    function setUp() public {
        usdc = new MockUSDC();
        escrow = new Escrow(address(usdc), arbitrator);
        reputation = new ReputationRegistry();
        escrow.setReputation(address(reputation));
        reputation.grantRole(reputation.RECORDER_ROLE(), address(escrow));

        usdc.mint(payer, 1000e6);
        vm.prank(payer);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function test_createFundComplete() public {
        vm.prank(payer);
        uint256 id = escrow.createEscrow(1, 2, payee, 5e6, keccak256("terms"));

        vm.prank(payer);
        escrow.fundEscrow(id);

        vm.prank(payee);
        escrow.submitWork(id, keccak256("work"));

        vm.prank(payer);
        escrow.approve(id);

        assertEq(usdc.balanceOf(payee), 5e6);
        assertEq(uint8(escrow.getEscrow(id).status), uint8(Escrow.Status.Completed));
        assertEq(reputation.getScore(2) > 0, true);
    }

    function test_refund() public {
        vm.prank(payer);
        uint256 id = escrow.createEscrow(1, 2, payee, 5e6, keccak256("terms"));
        vm.prank(payer);
        escrow.fundEscrow(id);
        vm.prank(payer);
        escrow.refund(id);
        assertEq(usdc.balanceOf(payer), 1000e6);
    }

    function test_disputeResolve() public {
        vm.prank(payer);
        uint256 id = escrow.createEscrow(1, 2, payee, 5e6, keccak256("terms"));
        vm.prank(payer);
        escrow.fundEscrow(id);
        vm.prank(payee);
        escrow.submitWork(id, keccak256("work"));
        vm.prank(payer);
        escrow.dispute(id, "incomplete");

        vm.prank(arbitrator);
        escrow.resolveDispute(id, false);
        assertEq(usdc.balanceOf(payer), 1000e6);
    }

    function test_unauthorizedResolve() public {
        vm.prank(payer);
        uint256 id = escrow.createEscrow(1, 2, payee, 5e6, keccak256("terms"));
        vm.prank(payer);
        escrow.fundEscrow(id);
        vm.prank(payer);
        escrow.dispute(id, "bad");

        vm.prank(payer);
        vm.expectRevert(Escrow.Unauthorized.selector);
        escrow.resolveDispute(id, true);
    }
}
