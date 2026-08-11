// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";

contract ReputationRegistryTest is Test {
    ReputationRegistry rep;

    function setUp() public {
        rep = new ReputationRegistry();
    }

    function test_scoreFormula() public {
        rep.recordEscrowCompleted(1, 2, true);
        rep.recordEscrowCompleted(1, 2, true);
        rep.recordSuccess(1);
        uint256 score = rep.getScore(1);
        assertGt(score, 50);
        assertLe(score, 100);
    }

    function test_violationsLowerScore() public {
        for (uint256 i = 0; i < 10; i++) {
            rep.recordSuccess(1);
        }
        uint256 before = rep.getScore(1);
        rep.recordPolicyViolation(1);
        rep.recordPolicyViolation(1);
        assertLt(rep.getScore(1), before);
    }

    function test_cannotSelfRecord() public {
        vm.prank(address(0xBAD));
        vm.expectRevert();
        rep.recordSuccess(1);
    }
}
