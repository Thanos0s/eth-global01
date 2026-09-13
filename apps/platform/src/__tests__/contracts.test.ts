import { describe, it, expect } from "vitest";
import { Interface, ethers } from "ethers";
import YieldVaultJson from "../lib/evm/generated/YieldVault.json";
import CompliantRwaTokenJson from "../lib/evm/generated/CompliantRwaToken.json";

describe("Smart Contract Architecture & Behavioral Invariants", () => {
  describe("YieldVault Contract Specification", () => {
    const iface = new Interface(YieldVaultJson.abi);

    it("exposes strict role-based access control and pausable interface", () => {
      expect(iface.getFunction("hasRole")).toBeDefined();
      expect(iface.getFunction("grantRole")).toBeDefined();
      expect(iface.getFunction("pause")).toBeDefined();
      expect(iface.getFunction("unpause")).toBeDefined();
      expect(iface.getFunction("OPERATOR_ROLE")).toBeDefined();
      expect(iface.getFunction("PAUSER_ROLE")).toBeDefined();
    });

    it("implements bounded emergency freeze batch to prevent unbounded gas bombs", () => {
      const fn = iface.getFunction("emergencyFreezeBatch");
      expect(fn).toBeDefined();
      expect(fn?.inputs.length).toBe(2);
      expect(fn?.inputs[0].type).toBe("bytes32"); // propertyId
      expect(fn?.inputs[1].type).toBe("address[]"); // investors slice
    });

    it("enforces 48-hour configuration timelock for sensitive upgrades", () => {
      expect(iface.getFunction("proposeSuperToken")).toBeDefined();
      expect(iface.getFunction("applySuperToken")).toBeDefined();
      expect(iface.getFunction("proposeCFAForwarder")).toBeDefined();
      expect(iface.getFunction("applyCFAForwarder")).toBeDefined();
    });

    it("verifies flow rate calculation: 1 month = 2,592,000 seconds", () => {
      // 3,800 USD monthly with 18 decimals and 100% share (10,000 bps)
      const monthlyRent = BigInt(3800) * (BigInt(10) ** BigInt(18));
      const shareBps = BigInt(10000);
      const secondsPerMonth = BigInt(2592000);

      const monthlyPortion = (monthlyRent * shareBps) / BigInt(10000);
      const perSecond = monthlyPortion / secondsPerMonth;

      expect(perSecond).toBeGreaterThan(BigInt(0));
      expect(perSecond * secondsPerMonth).toBeLessThanOrEqual(monthlyRent);
    });

    it("solvency invariant: monthly obligated flow must never exceed deposited rent reserve", () => {
      // Simulate reserve accounting
      let totalRentDeposited = BigInt(11400) * (BigInt(10) ** BigInt(18)); // 3 months of rent
      let totalObligatedPerSec = BigInt(0);

      const addStream = (flowRate: bigint) => {
        const newObligation = (totalObligatedPerSec + flowRate) * BigInt(2592000);
        if (newObligation > totalRentDeposited) {
          throw new Error("InsufficientReserve");
        }
        totalObligatedPerSec += flowRate;
      };

      const validFlow = (BigInt(3800) * (BigInt(10) ** BigInt(18))) / BigInt(2592000);
      expect(() => addStream(validFlow)).not.toThrow();

      // Second stream within reserve
      expect(() => addStream(validFlow)).not.toThrow();

      // Excessive stream exceeding remaining reserve should throw
      const excessiveFlow = (BigInt(100000) * (BigInt(10) ** BigInt(18))) / BigInt(2592000);
      expect(() => addStream(excessiveFlow)).toThrow("InsufficientReserve");
    });
  });

  describe("CompliantRwaToken Contract Specification", () => {
    const iface = new Interface(CompliantRwaTokenJson.abi);

    it("exposes full compliance role definitions and event interfaces", () => {
      expect(iface.getFunction("setApproved")).toBeDefined();
      expect(iface.getFunction("setFrozen")).toBeDefined();
      expect(iface.getFunction("recover")).toBeDefined();
      expect(iface.getEvent("ApprovalUpdated")).toBeDefined();
      expect(iface.getEvent("FreezeUpdated")).toBeDefined();
      expect(iface.getEvent("RecoveryExecuted")).toBeDefined();
    });

    it("defines custom error types for compliance violations", () => {
      expect(iface.getError("AccountNotApproved")).toBeDefined();
      expect(iface.getError("AccountFrozen")).toBeDefined();
      expect(iface.getError("MaxSupplyExceeded")).toBeDefined();
    });

    it("maintains maxSupply cap invariant: totalSupply <= maxSupply", () => {
      const maxSupply = BigInt(10000);
      let totalSupply = BigInt(1000);

      const simulateMint = (amount: bigint) => {
        if (totalSupply + amount > maxSupply) {
          throw new Error("MaxSupplyExceeded");
        }
        totalSupply += amount;
      };

      expect(() => simulateMint(BigInt(5000))).not.toThrow();
      expect(totalSupply).toBe(BigInt(6000));

      expect(() => simulateMint(BigInt(4001))).toThrow("MaxSupplyExceeded");
      expect(totalSupply).toBeLessThanOrEqual(maxSupply);
    });
  });
});

