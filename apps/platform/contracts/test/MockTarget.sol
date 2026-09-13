// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockTarget
 * @notice Target contract for verifying modular smart account calls.
 */
contract MockTarget {
    uint256 public count;
    address public lastCaller;
    uint256 public lastValue;

    event Incremented(address indexed caller, uint256 newCount);
    event ValueReceived(address indexed caller, uint256 value);

    function increment() external {
        count += 1;
        lastCaller = msg.sender;
        emit Incremented(msg.sender, count);
    }

    function add(uint256 amount) external {
        count += amount;
        lastCaller = msg.sender;
        emit Incremented(msg.sender, count);
    }

    function payMe() external payable {
        lastCaller = msg.sender;
        lastValue = msg.value;
        emit ValueReceived(msg.sender, msg.value);
    }

    function blockedAction() external pure {
        revert("Should never be reached under policy allowlist");
    }
}
