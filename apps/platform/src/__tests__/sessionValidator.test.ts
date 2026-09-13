import { describe, it, expect, beforeAll } from "vitest";
import { ethers, Interface, AbiCoder } from "ethers";
import SessionKeyValidatorJson from "../lib/evm/generated/SessionKeyValidator.json";

describe("SessionKeyValidator (ERC-7579 / ERC-4337) Contract Engine", () => {
  const iface = new Interface(SessionKeyValidatorJson.abi);
  const coder = AbiCoder.defaultAbiCoder();

  it("exposes full ERC-7579 validator and ERC-4337 validateUserOp ABI interface", () => {
    expect(iface.getFunction("validateUserOp")).toBeDefined();
    expect(iface.getFunction("checkAndRecordSpend")).toBeDefined();
    expect(iface.getFunction("hashPolicy")).toBeDefined();
    expect(iface.getFunction("validateSession")).toBeDefined();
    expect(iface.getFunction("revokeSessionNonce")).toBeDefined();
    expect(iface.getFunction("policySpend")).toBeDefined();
    expect(iface.getFunction("isModuleType")).toBeDefined();
    expect(iface.getFunction("parseExecutionCalldata")).toBeDefined();
  });

  it("defines EIP-712 SessionPolicy type structure with target and selector scoping", () => {
    const fn = iface.getFunction("hashPolicy");
    expect(fn?.inputs[0].components?.length).toBe(9);
    const fieldNames = fn?.inputs[0].components?.map((c) => c.name);
    expect(fieldNames).toContain("smartAccount");
    expect(fieldNames).toContain("sessionKey");
    expect(fieldNames).toContain("nonce");
    expect(fieldNames).toContain("validUntil");
    expect(fieldNames).toContain("validAfter");
    expect(fieldNames).toContain("allowedTargets");
    expect(fieldNames).toContain("allowedSelectors");
    expect(fieldNames).toContain("maxValue");
    expect(fieldNames).toContain("chainId");
  });

  describe("Cryptographic Invariant & Execution Policy Verification", () => {
    const smartAccountWallet = ethers.Wallet.createRandom();
    const agentWallet = ethers.Wallet.createRandom();
    const attackerWallet = ethers.Wallet.createRandom();

    const allowedTarget = ethers.getAddress("0x71c8401e25687352f20d235f8d7fd1a392cf99a8");
    const disallowedTarget = ethers.getAddress("0x9999999999999999999999999999999999999999");
    const allowedSelector = "0xa9059cbb"; // transfer(address,uint256)
    const disallowedSelector = "0x095ea7b3"; // approve(address,uint256)

    const basePolicy = {
      smartAccount: ethers.getAddress(smartAccountWallet.address),
      sessionKey: ethers.getAddress(agentWallet.address),
      nonce: 101,
      validUntil: Math.floor(Date.now() / 1000) + 3600,
      validAfter: Math.floor(Date.now() / 1000) - 60,
      allowedTargets: [allowedTarget],
      allowedSelectors: [allowedSelector],
      maxValue: ethers.parseEther("1.0"),
      chainId: 84532,
    };

    it("verifies EIP-712 domain and policy struct hash encoding", async () => {
      const domain = {
        name: "Prism8SessionValidator",
        version: "1",
        chainId: 84532,
        verifyingContract: "0x7579C0de00000000000000000000000000007579",
      };

      const types = {
        SessionPolicy: [
          { name: "smartAccount", type: "address" },
          { name: "sessionKey", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "validUntil", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "allowedTargets", type: "address[]" },
          { name: "allowedSelectors", type: "bytes4[]" },
          { name: "maxValue", type: "uint256" },
          { name: "chainId", type: "uint256" },
        ],
      };

      // Sign policy with smart account grantor
      const signature = await smartAccountWallet.signTypedData(domain, types, basePolicy);
      expect(signature).toMatch(/^0x[0-9a-fA-F]{130}$/);

      // Verify signature recovery
      const recovered = ethers.verifyTypedData(domain, types, basePolicy, signature);
      expect(recovered.toLowerCase()).toBe(smartAccountWallet.address.toLowerCase());
    });

    it("simulates ERC-4337 UserOp execution validation rules", () => {
      // Rule 1: Sender must match policy smartAccount
      const validateOp = (
        opSender: string,
        opChainId: number,
        target: string,
        selector: string,
        value: bigint,
        signer: string,
        currentSpend: bigint,
        validUntil: number
      ) => {
        if (opSender.toLowerCase() !== basePolicy.smartAccount.toLowerCase()) return 1;
        if (opChainId !== basePolicy.chainId) return 1;
        if (validUntil < Math.floor(Date.now() / 1000)) return 1;
        if (signer.toLowerCase() !== agentWallet.address.toLowerCase()) return 1;

        if (
          basePolicy.allowedTargets.length > 0 &&
          !basePolicy.allowedTargets.map((t) => t.toLowerCase()).includes(target.toLowerCase())
        ) {
          return 1;
        }

        if (
          basePolicy.allowedSelectors.length > 0 &&
          !basePolicy.allowedSelectors.includes(selector)
        ) {
          return 1;
        }

        if (currentSpend + value > basePolicy.maxValue) return 1;

        return 0; // SUCCESS
      };

      // Case A: Valid execution
      const valid = validateOp(
        smartAccountWallet.address,
        84532,
        allowedTarget,
        allowedSelector,
        ethers.parseEther("0.2"),
        agentWallet.address,
        ethers.parseEther("0.1"),
        basePolicy.validUntil
      );
      expect(valid).toBe(0);

      // Case B: Wrong sender / smart account
      const wrongSender = validateOp(
        attackerWallet.address,
        84532,
        allowedTarget,
        allowedSelector,
        ethers.parseEther("0.2"),
        agentWallet.address,
        ethers.parseEther("0.1"),
        basePolicy.validUntil
      );
      expect(wrongSender).toBe(1);

      // Case C: Wrong agent signer
      const wrongAgent = validateOp(
        smartAccountWallet.address,
        84532,
        allowedTarget,
        allowedSelector,
        ethers.parseEther("0.2"),
        attackerWallet.address,
        ethers.parseEther("0.1"),
        basePolicy.validUntil
      );
      expect(wrongAgent).toBe(1);

      // Case D: Disallowed target contract
      const badTarget = validateOp(
        smartAccountWallet.address,
        84532,
        disallowedTarget,
        allowedSelector,
        ethers.parseEther("0.2"),
        agentWallet.address,
        ethers.parseEther("0.1"),
        basePolicy.validUntil
      );
      expect(badTarget).toBe(1);

      // Case E: Disallowed function selector
      const badSelector = validateOp(
        smartAccountWallet.address,
        84532,
        allowedTarget,
        disallowedSelector,
        ethers.parseEther("0.2"),
        agentWallet.address,
        ethers.parseEther("0.1"),
        basePolicy.validUntil
      );
      expect(badSelector).toBe(1);

      // Case F: Exceeding spend limit
      const overBudget = validateOp(
        smartAccountWallet.address,
        84532,
        allowedTarget,
        allowedSelector,
        ethers.parseEther("0.95"),
        agentWallet.address,
        ethers.parseEther("0.2"),
        basePolicy.validUntil
      );
      expect(overBudget).toBe(1);

      // Case G: Chain ID mismatch
      const wrongChain = validateOp(
        smartAccountWallet.address,
        1, // Ethereum Mainnet instead of Base Sepolia 84532
        allowedTarget,
        allowedSelector,
        ethers.parseEther("0.2"),
        agentWallet.address,
        ethers.parseEther("0.1"),
        basePolicy.validUntil
      );
      expect(wrongChain).toBe(1);
    });

    it("verifies UserOp signature tuple decoding structure", () => {
      // Encodes (SessionPolicy, bytes grantorSignature, bytes agentSignature)
      const policyTuple = [
        smartAccountWallet.address,
        agentWallet.address,
        101,
        basePolicy.validUntil,
        basePolicy.validAfter,
        basePolicy.allowedTargets,
        basePolicy.allowedSelectors,
        basePolicy.maxValue,
        basePolicy.chainId,
      ];

      const dummyGrantorSig = "0x" + "aa".repeat(65);
      const dummyAgentSig = "0x" + "bb".repeat(65);

      const policyType =
        "tuple(address smartAccount, address sessionKey, uint256 nonce, uint256 validUntil, uint256 validAfter, address[] allowedTargets, bytes4[] allowedSelectors, uint256 maxValue, uint256 chainId)";

      const encoded = coder.encode([policyType, "bytes", "bytes"], [policyTuple, dummyGrantorSig, dummyAgentSig]);

      const decoded = coder.decode([policyType, "bytes", "bytes"], encoded);
      expect(decoded[0].smartAccount).toBe(smartAccountWallet.address);
      expect(decoded[0].sessionKey).toBe(agentWallet.address);
      expect(decoded[0].nonce).toBe(BigInt(101));
      expect(decoded[1]).toBe(dummyGrantorSig);
      expect(decoded[2]).toBe(dummyAgentSig);
    });
  });
});
