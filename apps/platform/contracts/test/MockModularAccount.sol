// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAccount} from "@account-abstraction/contracts/interfaces/IAccount.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

interface ISessionValidator {
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) external returns (uint256 validationData);
}

/**
 * @title MockModularAccount
 * @notice ERC-7579 compatible modular smart account fixture implementing IAccount.
 * Delegates UserOp validation to installed validator module (SessionKeyValidator).
 * Implements ERC-1271 for owner signature verification.
 */
contract MockModularAccount is IAccount {
    using ECDSA for bytes32;

    address public owner;
    address public entryPoint;
    address public validator;

    event ValidatorInstalled(address indexed validator);
    event Executed(address indexed target, uint256 value, bytes data);

    error OnlyEntryPoint();
    error OnlyOwnerOrEntryPoint();
    error ExecutionFailed(bytes data);

    constructor(address _owner, address _entryPoint) {
        owner = _owner;
        entryPoint = _entryPoint;
    }

    function setEntryPoint(address _entryPoint) external {
        if (msg.sender != owner && msg.sender != address(this)) {
            revert OnlyOwnerOrEntryPoint();
        }
        entryPoint = _entryPoint;
    }

    function installValidator(address _validator) external {
        if (msg.sender != owner && msg.sender != address(this)) {
            revert OnlyOwnerOrEntryPoint();
        }
        validator = _validator;
        emit ValidatorInstalled(_validator);
    }

    /**
     * @notice ERC-1271 signature validation interface.
     */
    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
        address recovered = hash.recover(signature);
        if (recovered != owner) {
            recovered = MessageHashUtils.toEthSignedMessageHash(hash).recover(signature);
        }
        if (recovered == owner) {
            return 0x1626ba7e;
        }
        return 0xffffffff;
    }

    /**
     * @notice Canonical ERC-4337 validation entrypoint called by the EntryPoint.
     * Delegates validation to the installed ERC-7579 validator module.
     */
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override returns (uint256 validationData) {
        if (msg.sender != entryPoint) {
            revert OnlyEntryPoint();
        }
        if (missingAccountFunds > 0) {
            (bool success, ) = payable(msg.sender).call{value: missingAccountFunds}("");
            require(success, "Failed to pay missingAccountFunds");
        }
        if (validator == address(0)) {
            return 1; // No validator installed
        }

        // Forward to the installed validator module (SessionKeyValidator)
        return ISessionValidator(validator).validateUserOp(userOp, userOpHash);
    }

    /**
     * @notice ERC-7579 standard execution entrypoint: execute(bytes32 mode, bytes calldata executionCalldata).
     */
    function execute(bytes32, bytes calldata executionCalldata) external payable {
        if (msg.sender != entryPoint && msg.sender != owner) {
            revert OnlyOwnerOrEntryPoint();
        }

        (address target, uint256 value, bytes memory callData) = abi.decode(
            executionCalldata,
            (address, uint256, bytes)
        );

        (bool success, bytes memory returnData) = target.call{value: value}(callData);
        if (!success) {
            revert ExecutionFailed(returnData);
        }
        emit Executed(target, value, callData);
    }

    /**
     * @notice Standard single execution entrypoint: execute(address target, uint256 value, bytes data).
     */
    function execute(address target, uint256 value, bytes calldata data) external payable {
        if (msg.sender != entryPoint && msg.sender != owner) {
            revert OnlyOwnerOrEntryPoint();
        }

        (bool success, bytes memory returnData) = target.call{value: value}(data);
        if (!success) {
            revert ExecutionFailed(returnData);
        }
        emit Executed(target, value, data);
    }

    receive() external payable {}
}
