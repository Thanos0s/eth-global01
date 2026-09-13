// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAccount {
    function validateUserOp(
        MockEntryPoint.PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);
}

/**
 * @title MockEntryPoint
 * @notice ERC-4337 v0.7 compatible EntryPoint fixture for local integration testing.
 */
contract MockEntryPoint {
    struct PackedUserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        bytes32 accountGasLimits;
        uint256 preVerificationGas;
        bytes32 gasFees;
        bytes paymasterAndData;
        bytes signature;
    }

    event UserOperationEvent(
        bytes32 indexed userOpHash,
        address indexed sender,
        address indexed paymaster,
        uint256 nonce,
        bool success,
        uint256 actualGasCost,
        uint256 actualGasUsed
    );

    error ValidationFailed(address sender, uint256 validationData);
    error ExecutionFailed(address sender, bytes returnData);

    function getUserOpHash(PackedUserOperation calldata userOp) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256(
                    abi.encode(
                        userOp.sender,
                        userOp.nonce,
                        keccak256(userOp.initCode),
                        keccak256(userOp.callData),
                        userOp.accountGasLimits,
                        userOp.preVerificationGas,
                        userOp.gasFees,
                        keccak256(userOp.paymasterAndData)
                    )
                ),
                address(this),
                block.chainid
            )
        );
    }

    function handleOps(
        PackedUserOperation[] calldata ops,
        address payable beneficiary
    ) external {
        for (uint256 i = 0; i < ops.length; i++) {
            PackedUserOperation calldata op = ops[i];
            bytes32 opHash = getUserOpHash(op);

            // 1. Validation phase
            uint256 validationData = IAccount(op.sender).validateUserOp(op, opHash, 0);
            if (validationData != 0) {
                revert ValidationFailed(op.sender, validationData);
            }

            // 2. Execution phase
            (bool success, bytes memory ret) = op.sender.call(op.callData);
            if (!success) {
                revert ExecutionFailed(op.sender, ret);
            }

            emit UserOperationEvent(opHash, op.sender, address(0), op.nonce, true, 0, 0);
        }

        // Beneficiary receives gas refunds/fees if any
        if (beneficiary != address(0) && address(this).balance > 0) {
            beneficiary.transfer(address(this).balance);
        }
    }

    receive() external payable {}
}
