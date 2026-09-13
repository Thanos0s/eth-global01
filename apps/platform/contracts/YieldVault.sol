// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/ISuperfluidCFA.sol";

/**
 * @title YieldVault
 * @notice Holds incoming rental stablecoins and maintains continuous per-second
 *         Superfluid CFA yield streams into verified investor accounts with
 *         cryptographic reserve solvency invariants and role-based controls.
 */
contract YieldVault is AccessControl, Pausable {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 public constant SECONDS_PER_MONTH = 2_592_000; // 30 days
    uint256 public constant CONFIG_TIMELOCK = 48 hours;

    ISuperfluidToken public superToken; // fUSDCx on Base Sepolia
    ICFAv1Forwarder public cfaForwarder;

    // Timelock state for configuration changes
    address public pendingSuperToken;
    uint256 public pendingSuperTokenUnlockAt;
    address public pendingCFAForwarder;
    uint256 public pendingCFAForwarderUnlockAt;

    struct InvestorStream {
        address investor;
        int96 flowRate;
        uint256 startedAt;
        bool isActive;
    }

    // propertyId => investor => InvestorStream
    mapping(bytes32 => mapping(address => InvestorStream)) public propertyInvestorStreams;
    // propertyId => list of active investor addresses
    mapping(bytes32 => address[]) private activeInvestors;
    // propertyId => total deposited rent
    mapping(bytes32 => uint256) public totalRentDeposited;
    // propertyId => total obligated monthly flow in wei per second
    mapping(bytes32 => uint256) public totalObligatedPerSec;

    event RentDeposited(bytes32 indexed propertyId, address indexed depositor, uint256 amount);
    event StreamOpened(bytes32 indexed propertyId, address indexed investor, int96 flowRate);
    event StreamUpdated(bytes32 indexed propertyId, address indexed investor, int96 newFlowRate);
    event StreamClosed(bytes32 indexed propertyId, address indexed investor);
    event PropertyStreamsFrozen(bytes32 indexed propertyId, uint256 closedCount);
    event SuperTokenProposed(address indexed newSuperToken, uint256 unlockAt);
    event SuperTokenUpdated(address indexed newSuperToken);
    event CFAForwarderProposed(address indexed newForwarder, uint256 unlockAt);
    event CFAForwarderUpdated(address indexed newForwarder);

    error InsufficientReserve(uint256 requiredReserve, uint256 availableReserve);
    error FlowRateOverflow();
    error TimelockNotExpired(uint256 unlockAt, uint256 currentTimestamp);
    error NoPendingConfig();

    constructor(address admin_, address operator_, address _superToken, address _cfaForwarder) {
        require(admin_ != address(0), "Invalid admin address");
        require(operator_ != address(0), "Invalid operator address");

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(OPERATOR_ROLE, operator_);
        _grantRole(PAUSER_ROLE, operator_);

        superToken = ISuperfluidToken(_superToken);
        cfaForwarder = ICFAv1Forwarder(_cfaForwarder);
    }

    // --- Configuration Timelock (48h safety window) ---

    function proposeSuperToken(address _superToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_superToken != address(0), "Invalid token");
        pendingSuperToken = _superToken;
        pendingSuperTokenUnlockAt = block.timestamp + CONFIG_TIMELOCK;
        emit SuperTokenProposed(_superToken, pendingSuperTokenUnlockAt);
    }

    function applySuperToken() external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (pendingSuperToken == address(0)) revert NoPendingConfig();
        if (block.timestamp < pendingSuperTokenUnlockAt) {
            revert TimelockNotExpired(pendingSuperTokenUnlockAt, block.timestamp);
        }
        superToken = ISuperfluidToken(pendingSuperToken);
        emit SuperTokenUpdated(pendingSuperToken);
        pendingSuperToken = address(0);
        pendingSuperTokenUnlockAt = 0;
    }

    function proposeCFAForwarder(address _forwarder) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_forwarder != address(0), "Invalid forwarder");
        pendingCFAForwarder = _forwarder;
        pendingCFAForwarderUnlockAt = block.timestamp + CONFIG_TIMELOCK;
        emit CFAForwarderProposed(_forwarder, pendingCFAForwarderUnlockAt);
    }

    function applyCFAForwarder() external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (pendingCFAForwarder == address(0)) revert NoPendingConfig();
        if (block.timestamp < pendingCFAForwarderUnlockAt) {
            revert TimelockNotExpired(pendingCFAForwarderUnlockAt, block.timestamp);
        }
        cfaForwarder = ICFAv1Forwarder(pendingCFAForwarder);
        emit CFAForwarderUpdated(pendingCFAForwarder);
        pendingCFAForwarder = address(0);
        pendingCFAForwarderUnlockAt = 0;
    }

    // --- Pausing ---

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // --- Flow Rate & Solvency Invariant ---

    /**
     * @notice Computes flow rate in wei per second given monthly rent and share bps.
     *         Includes safe bounds check against int96 overflow.
     */
    function calculateFlowRate(uint256 monthlyRentUsd, uint256 shareBasisPoints) public pure returns (int96) {
        require(shareBasisPoints <= 10000, "Share exceeds 100%");
        uint256 monthlyInvestorPortion = (monthlyRentUsd * shareBasisPoints) / 10000;
        uint256 perSecond = monthlyInvestorPortion / SECONDS_PER_MONTH;
        if (perSecond > uint256(uint96(type(int96).max))) {
            revert FlowRateOverflow();
        }
        return int96(uint96(perSecond));
    }

    /**
     * @notice Deposit rental payment from tenant bridge into the vault reserve.
     */
    function depositRent(bytes32 propertyId, uint256 amount) external whenNotPaused {
        require(amount > 0, "Amount must be positive");
        totalRentDeposited[propertyId] += amount;

        if (address(superToken) != address(0)) {
            require(superToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        }

        emit RentDeposited(propertyId, msg.sender, amount);
    }

    /**
     * @notice Internal solvency check: ensures monthly obligations never exceed deposited reserves.
     */
    function _requireSolvent(bytes32 propertyId, uint256 oldRate, uint256 newRate) internal view {
        uint256 newObligatedPerSec = totalObligatedPerSec[propertyId] - oldRate + newRate;
        uint256 monthlyObligation = newObligatedPerSec * SECONDS_PER_MONTH;
        if (monthlyObligation > totalRentDeposited[propertyId]) {
            revert InsufficientReserve(monthlyObligation, totalRentDeposited[propertyId]);
        }
    }

    /**
     * @notice Opens or adjusts a per-second continuous yield stream to an investor.
     *         Enforces solvency invariant before updating state.
     */
    function createInvestorStream(
        bytes32 propertyId,
        address investor,
        int96 flowRate
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        require(investor != address(0), "Invalid investor address");
        require(flowRate > 0, "Flow rate must be positive");

        InvestorStream storage stream = propertyInvestorStreams[propertyId][investor];
        uint256 oldRate = stream.isActive ? uint256(uint96(stream.flowRate)) : 0;
        uint256 newRate = uint256(uint96(flowRate));

        // Solvency verification: reserve must cover all monthly obligations
        _requireSolvent(propertyId, oldRate, newRate);

        if (address(cfaForwarder) != address(0)) {
            if (stream.isActive) {
                cfaForwarder.updateFlow(superToken, address(this), investor, flowRate, "");
            } else {
                cfaForwarder.createFlow(superToken, address(this), investor, flowRate, "");
            }
        }

        totalObligatedPerSec[propertyId] = totalObligatedPerSec[propertyId] - oldRate + newRate;

        if (!stream.isActive) {
            activeInvestors[propertyId].push(investor);
            stream.isActive = true;
            stream.investor = investor;
            stream.startedAt = block.timestamp;
            emit StreamOpened(propertyId, investor, flowRate);
        } else {
            emit StreamUpdated(propertyId, investor, flowRate);
        }

        stream.flowRate = flowRate;
    }

    /**
     * @notice Deletes an ongoing stream to an investor and reduces obligated reserves.
     */
    function deleteInvestorStream(bytes32 propertyId, address investor) external onlyRole(OPERATOR_ROLE) {
        InvestorStream storage stream = propertyInvestorStreams[propertyId][investor];
        require(stream.isActive, "Stream not active");

        if (address(cfaForwarder) != address(0)) {
            cfaForwarder.deleteFlow(superToken, address(this), investor, "");
        }

        uint256 oldRate = uint256(uint96(stream.flowRate));
        totalObligatedPerSec[propertyId] = totalObligatedPerSec[propertyId] >= oldRate
            ? totalObligatedPerSec[propertyId] - oldRate
            : 0;

        stream.isActive = false;
        stream.flowRate = 0;
        emit StreamClosed(propertyId, investor);
    }

    /**
     * @notice Bounded batched emergency freeze (mitigates gas bomb from unbounded iteration).
     */
    function emergencyFreezeBatch(
        bytes32 propertyId,
        address[] calldata investors
    ) external onlyRole(OPERATOR_ROLE) returns (uint256 closed) {
        for (uint256 i = 0; i < investors.length; i++) {
            address inv = investors[i];
            InvestorStream storage stream = propertyInvestorStreams[propertyId][inv];
            if (stream.isActive) {
                if (address(cfaForwarder) != address(0)) {
                    try cfaForwarder.deleteFlow(superToken, address(this), inv, "") {} catch {}
                }
                uint256 oldRate = uint256(uint96(stream.flowRate));
                totalObligatedPerSec[propertyId] = totalObligatedPerSec[propertyId] >= oldRate
                    ? totalObligatedPerSec[propertyId] - oldRate
                    : 0;
                stream.isActive = false;
                stream.flowRate = 0;
                closed++;
                emit StreamClosed(propertyId, inv);
            }
        }

        emit PropertyStreamsFrozen(propertyId, closed);
        return closed;
    }

    function getActiveInvestors(bytes32 propertyId) external view returns (address[] memory) {
        return activeInvestors[propertyId];
    }
}
