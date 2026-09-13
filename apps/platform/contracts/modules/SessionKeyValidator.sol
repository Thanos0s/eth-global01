// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title SessionKeyValidator
 * @notice ERC-7579 compliant validation module for AI Agent scoped session keys.
 * Enables smart accounts and delegators to grant time-bound, budget-capped, and
 * action-scoped execution authority to autonomous agents (e.g. Hermes Operator).
 * 
 * Verifies EIP-712 typed signatures (`SessionPolicy`) and validates ERC-4337 UserOperations.
 */
contract SessionKeyValidator is EIP712 {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    uint256 public constant MODULE_TYPE_VALIDATOR = 1;
    bytes4 public constant ERC1271_SUCCESS = 0x1626ba7e;
    bytes4 public constant ERC1271_FAILED = 0xffffffff;

    bytes32 public constant SESSION_POLICY_TYPEHASH = keccak256(
        "SessionPolicy(address smartAccount,address sessionKey,uint256 nonce,uint256 validUntil,uint256 validAfter,address[] allowedTargets,bytes4[] allowedSelectors,uint256 maxValue,uint256 chainId)"
    );

    struct SessionPolicy {
        address smartAccount;
        address sessionKey;
        uint256 nonce;
        uint256 validUntil;
        uint256 validAfter;
        address[] allowedTargets;
        bytes4[] allowedSelectors;
        uint256 maxValue;
        uint256 chainId;
    }

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

    // SmartAccount -> Nonce -> Revoked status
    mapping(address => mapping(uint256 => bool)) public revokedNonces;
    // SmartAccount -> PolicyNonce -> Accumulated on-chain spend
    mapping(address => mapping(uint256 => uint256)) public policySpend;
    // Backwards compatibility: SmartAccount -> Agent -> Accumulated spend tracking
    mapping(address => mapping(address => uint256)) public accumulatedSpend;

    event SessionDelegated(
        address indexed smartAccount,
        address indexed sessionKey,
        uint256 validUntil,
        uint256 maxValue,
        uint256 nonce
    );

    event SessionRevoked(address indexed smartAccount, uint256 indexed nonce);

    event ActionExecuted(
        address indexed smartAccount,
        address indexed sessionKey,
        bytes4 indexed selector,
        uint256 spendAmount
    );

    error InvalidChainId(uint256 expected, uint256 actual);
    error SessionNotYetValid(uint256 validAfter, uint256 currentTimestamp);
    error SessionExpired(uint256 validUntil, uint256 currentTimestamp);
    error SessionNonceRevoked(address smartAccount, uint256 nonce);
    error InvalidSigner(address expected, address recovered);
    error UnauthorizedCaller(address expected, address actual);
    error UnauthorizedAgent(address expected, address actual);
    error SpendLimitExceeded(uint256 requested, uint256 remaining);
    error TargetNotAllowed(address target);
    error SelectorNotAllowed(bytes4 selector);
    error BatchExecutionNotPermitted();

    constructor() EIP712("Prism8SessionValidator", "1") {}

    /**
     * @notice ERC-7579 module type check.
     */
    function isModuleType(uint256 moduleTypeId) external pure returns (bool) {
        return moduleTypeId == MODULE_TYPE_VALIDATOR;
    }

    /**
     * @notice ERC-7579 installation hook.
     */
    function onInstall(bytes calldata) external {}

    /**
     * @notice ERC-7579 uninstallation hook.
     */
    function onUninstall(bytes calldata) external {}

    function _hashTargets(address[] memory targets) internal pure returns (bytes32) {
        bytes32[] memory words = new bytes32[](targets.length);
        for (uint256 i = 0; i < targets.length; i++) {
            words[i] = bytes32(uint256(uint160(targets[i])));
        }
        return keccak256(abi.encodePacked(words));
    }

    function _hashSelectors(bytes4[] memory selectors) internal pure returns (bytes32) {
        bytes32[] memory words = new bytes32[](selectors.length);
        for (uint256 i = 0; i < selectors.length; i++) {
            words[i] = bytes32(selectors[i]);
        }
        return keccak256(abi.encodePacked(words));
    }

    /**
     * @notice Computes the EIP-712 digest for a given SessionPolicy.
     */
    function hashPolicy(SessionPolicy memory policy) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                SESSION_POLICY_TYPEHASH,
                policy.smartAccount,
                policy.sessionKey,
                policy.nonce,
                policy.validUntil,
                policy.validAfter,
                _hashTargets(policy.allowedTargets),
                _hashSelectors(policy.allowedSelectors),
                policy.maxValue,
                policy.chainId
            )
        );
        return _hashTypedDataV4(structHash);
    }

    /**
     * @notice Validates a session policy signature against its smart account grantor.
     */
    function validateSession(
        SessionPolicy memory policy,
        bytes memory grantorSignature
    ) public view returns (bool) {
        if (policy.chainId != block.chainid) {
            revert InvalidChainId(policy.chainId, block.chainid);
        }
        if (block.timestamp > policy.validUntil) {
            revert SessionExpired(policy.validUntil, block.timestamp);
        }
        if (block.timestamp < policy.validAfter) {
            revert SessionNotYetValid(policy.validAfter, block.timestamp);
        }
        if (revokedNonces[policy.smartAccount][policy.nonce]) {
            revert SessionNonceRevoked(policy.smartAccount, policy.nonce);
        }

        bytes32 digest = hashPolicy(policy);
        address recovered = digest.recover(grantorSignature);
        if (recovered != policy.smartAccount) {
            revert InvalidSigner(policy.smartAccount, recovered);
        }

        return true;
    }

    function _extractBytes4(bytes memory data) internal pure returns (bytes4 s) {
        if (data.length < 4) return bytes4(0);
        assembly {
            s := mload(add(data, 32))
        }
    }

    /**
     * @notice Parses execution parameters (target, value, selector) from UserOp callData.
     * Rejects batch execution modes as they cannot be safely scoped under a single-action policy.
     */
    function parseExecutionCalldata(bytes calldata callData)
        public
        view
        returns (address target, uint256 value, bytes4 selector)
    {
        if (callData.length < 4) {
            return (address(0), 0, bytes4(0));
        }

        bytes4 topSelector = bytes4(callData[:4]);

        // 1. ERC-7579: execute(bytes32 mode, bytes executionCalldata) -> selector 0xe9ae5c53
        if (topSelector == 0xe9ae5c53 && callData.length >= 68) {
            (bytes32 mode, bytes memory execCalldata) = abi.decode(callData[4:], (bytes32, bytes));
            // In ERC-7579: byte 0 of mode is CallType (0x00 = single, 0x01 = batch)
            bytes1 callType = bytes1(mode);
            if (callType == 0x01) {
                // Explicitly reject batch execution for session key policies
                revert BatchExecutionNotPermitted();
            }

            if (execCalldata.length >= 64) {
                try this.decodeExecution(execCalldata) returns (address t, uint256 v, bytes memory inner) {
                    target = t;
                    value = v;
                    selector = _extractBytes4(inner);
                    return (target, value, selector);
                } catch {
                    return (address(0), 0, bytes4(0));
                }
            }
        }
        // 2. Standard Single Call: execute(address target, uint256 value, bytes data) -> selector 0xb61d27f6
        else if (topSelector == 0xb61d27f6 && callData.length >= 68) {
            try this.decodeExecution(callData[4:]) returns (address t, uint256 v, bytes memory inner) {
                target = t;
                value = v;
                selector = _extractBytes4(inner);
                return (target, value, selector);
            } catch {
                return (address(0), 0, bytes4(0));
            }
        }

        // 3. Direct function call on account
        selector = topSelector;
        return (address(0), 0, selector);
    }

    function decodeExecution(bytes calldata data)
        external
        pure
        returns (address target, uint256 value, bytes memory innerCalldata)
    {
        return abi.decode(data, (address, uint256, bytes));
    }

    /**
     * @notice Strict target check: requires explicit allowlisting. Wildcards are NOT allowed by default.
     */
    function _isTargetAllowed(address target, address[] memory allowedTargets) internal pure returns (bool) {
        if (allowedTargets.length == 0) return false;
        for (uint256 i = 0; i < allowedTargets.length; i++) {
            if (allowedTargets[i] == target) return true;
        }
        return false;
    }

    /**
     * @notice Strict selector check: requires explicit allowlisting. Wildcards are NOT allowed by default.
     */
    function _isSelectorAllowed(bytes4 selector, bytes4[] memory allowedSelectors) internal pure returns (bool) {
        if (allowedSelectors.length == 0) return false;
        for (uint256 i = 0; i < allowedSelectors.length; i++) {
            if (allowedSelectors[i] == selector) return true;
        }
        return false;
    }

    /**
     * @notice Standard ERC-4337 / ERC-7579 UserOperation validation.
     * RESTRICTION: Only the sender (modular smart account) calling its installed module during
     * UserOp validation may call this method. Prevents external griefing / unauthorized spend consumption.
     */
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) external returns (uint256 validationData) {
        // Enforce account caller context: only the smart account itself may invoke validateUserOp
        if (msg.sender != userOp.sender) {
            return 1; // SIG_VALIDATION_FAILED
        }

        // userOp.signature encodes (SessionPolicy policy, bytes grantorSignature, bytes agentSignature)
        if (userOp.signature.length == 0) {
            return 1;
        }

        SessionPolicy memory policy;
        bytes memory grantorSig;
        bytes memory agentSig;

        try this.decodeSignature(userOp.signature) returns (
            SessionPolicy memory _policy,
            bytes memory _grantorSig,
            bytes memory _agentSig
        ) {
            policy = _policy;
            grantorSig = _grantorSig;
            agentSig = _agentSig;
        } catch {
            return 1;
        }

        // 1. Validate smart account sender binding
        if (userOp.sender != policy.smartAccount) {
            return 1;
        }

        // 2. Validate chainId
        if (policy.chainId != block.chainid) {
            return 1;
        }

        // 3. Validate timestamp window
        if (block.timestamp > policy.validUntil || block.timestamp < policy.validAfter) {
            return 1;
        }

        // 4. Validate revocation status
        if (revokedNonces[policy.smartAccount][policy.nonce]) {
            return 1;
        }

        // 5. Verify grantor signature over SessionPolicy EIP-712 hash
        bytes32 policyDigest = hashPolicy(policy);
        address recoveredGrantor = policyDigest.recover(grantorSig);
        if (recoveredGrantor != policy.smartAccount) {
            // For contract accounts, verify via ERC-1271
            if (policy.smartAccount.code.length > 0) {
                try this.check1271(policy.smartAccount, policyDigest, grantorSig) returns (bool valid) {
                    if (!valid) return 1;
                } catch {
                    return 1;
                }
            } else {
                return 1;
            }
        }

        // 6. Verify agent signature over userOpHash
        address recoveredAgent = userOpHash.toEthSignedMessageHash().recover(agentSig);
        if (recoveredAgent != policy.sessionKey) {
            recoveredAgent = userOpHash.recover(agentSig);
        }
        if (recoveredAgent != policy.sessionKey) {
            return 1;
        }

        // 7. Parse callData and enforce action scoping & on-chain spend tracking
        address target;
        uint256 value;
        bytes4 selector;
        try this.parseExecutionCalldata(userOp.callData) returns (address t, uint256 v, bytes4 s) {
            target = t;
            value = v;
            selector = s;
        } catch {
            return 1; // Batch or malformed execution rejected
        }

        if (!_isTargetAllowed(target, policy.allowedTargets)) {
            return 1;
        }

        if (!_isSelectorAllowed(selector, policy.allowedSelectors)) {
            return 1;
        }

        uint256 currentSpend = policySpend[policy.smartAccount][policy.nonce];
        if (currentSpend + value > policy.maxValue) {
            return 1;
        }

        // Track spend per policy nonce on-chain
        policySpend[policy.smartAccount][policy.nonce] = currentSpend + value;
        accumulatedSpend[policy.smartAccount][policy.sessionKey] += value;

        emit ActionExecuted(policy.smartAccount, policy.sessionKey, selector, value);
        return 0; // Valid execution
    }

    /**
     * @notice Helper to safely decode signature tuple.
     */
    function decodeSignature(bytes calldata sig)
        external
        pure
        returns (
            SessionPolicy memory policy,
            bytes memory grantorSignature,
            bytes memory agentSignature
        )
    {
        return abi.decode(sig, (SessionPolicy, bytes, bytes));
    }

    /**
     * @notice Checks policy validity and records spend on-chain.
     * Restricted to smart account or authorized sessionKey caller.
     */
    function checkAndRecordSpend(
        SessionPolicy calldata policy,
        bytes calldata grantorSignature,
        uint256 spendAmount
    ) external returns (bool) {
        validateSession(policy, grantorSignature);

        if (msg.sender != policy.sessionKey && msg.sender != policy.smartAccount) {
            revert UnauthorizedAgent(policy.sessionKey, msg.sender);
        }

        uint256 currentSpend = policySpend[policy.smartAccount][policy.nonce];
        if (currentSpend + spendAmount > policy.maxValue) {
            revert SpendLimitExceeded(spendAmount, policy.maxValue - currentSpend);
        }

        policySpend[policy.smartAccount][policy.nonce] = currentSpend + spendAmount;
        accumulatedSpend[policy.smartAccount][policy.sessionKey] += spendAmount;
        emit ActionExecuted(policy.smartAccount, policy.sessionKey, msg.sig, spendAmount);
        return true;
    }

    function check1271(address account, bytes32 hash, bytes calldata signature) external view returns (bool) {
        (bool success, bytes memory ret) = account.staticcall(
            abi.encodeWithSelector(0x1626ba7e, hash, signature)
        );
        return success && ret.length >= 4 && bytes4(ret) == 0x1626ba7e;
    }

    /**
     * @notice ERC-1271 signature validation interface.
     */
    function isValidSignatureWithSender(
        address,
        bytes32 hash,
        bytes calldata data
    ) external view returns (bytes4) {
        (address expectedSigner, bytes memory signature) = abi.decode(data, (address, bytes));
        address recovered = hash.recover(signature);
        return (recovered == expectedSigner) ? ERC1271_SUCCESS : ERC1271_FAILED;
    }

    /**
     * @notice Allows a smart account grantor to immediately revoke a session key nonce.
     */
    function revokeSessionNonce(uint256 nonce) external {
        revokedNonces[msg.sender][nonce] = true;
        emit SessionRevoked(msg.sender, nonce);
    }
}
