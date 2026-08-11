// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockFlightProvider
 * @notice Demo target contract for TravelBot purchases. Pulls ERC-20 via allowance.
 */
contract MockFlightProvider is Ownable {
    IERC20 public immutable token;
    uint256 public purchaseCount;

    event FlightPurchased(address indexed buyer, string flightId, uint256 amount);

    constructor(address token_) Ownable(msg.sender) {
        token = IERC20(token_);
    }

    function purchaseFlight(string calldata flightId, uint256 amount) external returns (bool) {
        require(amount > 0, "amount");
        require(token.transferFrom(msg.sender, address(this), amount), "transfer failed");
        purchaseCount += 1;
        emit FlightPurchased(msg.sender, flightId, amount);
        return true;
    }

    function withdraw(address to, uint256 amount) external onlyOwner {
        token.transfer(to, amount);
    }
}
