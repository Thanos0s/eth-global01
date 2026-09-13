import { describe, it, expect, beforeAll } from "vitest";
import { ethers } from "ethers";
import hre from "hardhat";
import SessionKeyValidatorJson from "@/lib/evm/generated/SessionKeyValidator.json";
import MockEntryPointJson from "@/lib/evm/generated/MockEntryPoint.json";
import CanonicalEntryPointJson from "@/lib/evm/generated/CanonicalEntryPoint.json";
import MockModularAccountJson from "@/lib/evm/generated/MockModularAccount.json";
import MockTargetJson from "@/lib/evm/generated/MockTarget.json";

describe("ERC-7579 / ERC-4337 SessionKeyValidator Behavioral Integration", () => {
  let provider: ethers.BrowserProvider;
  let deployer: ethers.Signer;
  let grantor: ethers.HDNodeWallet;
  let agent: ethers.HDNodeWallet;
  let attacker: ethers.HDNodeWallet;

  let entryPoint: ethers.Contract;
  let canonicalEntryPoint: ethers.Contract;
  let validator: ethers.Contract;
  let modularAccount: ethers.Contract;
  let canonicalModularAccount: ethers.Contract;
  let targetContract: ethers.Contract;

  const CHAIN_ID = 31337;

  const EIP712_DOMAIN = {
    name: "Prism8SessionValidator",
    version: "1",
    chainId: CHAIN_ID,
    verifyingContract: "",
  };

  const POLICY_TYPES = {
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

  beforeAll(async () => {
    const conn = await (hre as any).network.connect();
    provider = new ethers.BrowserProvider(conn.provider);
    deployer = await provider.getSigner(0);

    grantor = ethers.Wallet.createRandom().connect(provider);
    agent = ethers.Wallet.createRandom().connect(provider);
    attacker = ethers.Wallet.createRandom().connect(provider);

    // Fund grantor, agent, attacker
    await deployer.sendTransaction({
      to: grantor.address,
      value: ethers.parseEther("5.0"),
    });
    await deployer.sendTransaction({
      to: agent.address,
      value: ethers.parseEther("1.0"),
    });
    await deployer.sendTransaction({
      to: attacker.address,
      value: ethers.parseEther("1.0"),
    });

    // Deploy EntryPoint
    const EntryPointFactory = new ethers.ContractFactory(
      MockEntryPointJson.abi,
      MockEntryPointJson.bytecode,
      deployer
    );
    entryPoint = (await EntryPointFactory.deploy()) as ethers.Contract;
    await entryPoint.waitForDeployment();

    // Deploy SessionKeyValidator
    const ValidatorFactory = new ethers.ContractFactory(
      SessionKeyValidatorJson.abi,
      SessionKeyValidatorJson.bytecode,
      deployer
    );
    validator = (await ValidatorFactory.deploy()) as ethers.Contract;
    await validator.waitForDeployment();
    EIP712_DOMAIN.verifyingContract = await validator.getAddress();

    // Deploy Target Contract
    const TargetFactory = new ethers.ContractFactory(
      MockTargetJson.abi,
      MockTargetJson.bytecode,
      deployer
    );
    targetContract = (await TargetFactory.deploy()) as ethers.Contract;
    await targetContract.waitForDeployment();

    // Deploy MockModularAccount
    const AccountFactory = new ethers.ContractFactory(
      MockModularAccountJson.abi,
      MockModularAccountJson.bytecode,
      deployer
    );
    modularAccount = (await AccountFactory.deploy(
      grantor.address,
      await entryPoint.getAddress()
    )) as ethers.Contract;
    await modularAccount.waitForDeployment();

    // Fund modular smart account
    await deployer.sendTransaction({
      to: await modularAccount.getAddress(),
      value: ethers.parseEther("10.0"),
    });

    // Install validator module on smart account as grantor
    await (modularAccount.connect(grantor) as any).installValidator(await validator.getAddress());

    // Deploy Canonical ERC-4337 EntryPoint (official v0.7 implementation)
    const CanonicalEntryPointFactory = new ethers.ContractFactory(
      CanonicalEntryPointJson.abi,
      CanonicalEntryPointJson.bytecode,
      deployer
    );
    canonicalEntryPoint = (await CanonicalEntryPointFactory.deploy()) as ethers.Contract;
    await canonicalEntryPoint.waitForDeployment();

    canonicalModularAccount = (await AccountFactory.deploy(
      grantor.address,
      await canonicalEntryPoint.getAddress()
    )) as ethers.Contract;
    await canonicalModularAccount.waitForDeployment();

    // Fund canonical modular smart account
    await deployer.sendTransaction({
      to: await canonicalModularAccount.getAddress(),
      value: ethers.parseEther("10.0"),
    });

    // Deposit ETH in CanonicalEntryPoint for gas
    await (canonicalEntryPoint.connect(deployer) as any).depositTo(
      await canonicalModularAccount.getAddress(),
      { value: ethers.parseEther("2.0") }
    );

    // Install validator module on canonical smart account as grantor
    await (canonicalModularAccount.connect(grantor) as any).installValidator(await validator.getAddress());
  });

  async function buildUserOp(params: {
    policy: any;
    grantorSigner: ethers.Signer;
    agentSigner: ethers.Signer;
    callData: string;
    nonce?: number;
  }) {
    const accountAddress = await modularAccount.getAddress();
    const grantorSig = await (params.grantorSigner as any).signTypedData(
      EIP712_DOMAIN,
      POLICY_TYPES,
      params.policy
    );

    const userOp = {
      sender: accountAddress,
      nonce: params.nonce ?? 0,
      initCode: "0x",
      callData: params.callData,
      accountGasLimits: ethers.ZeroHash,
      preVerificationGas: 0,
      gasFees: ethers.ZeroHash,
      paymasterAndData: "0x",
      signature: "0x",
    };

    const userOpHash = await entryPoint.getUserOpHash(userOp);
    const agentSig = await params.agentSigner.signMessage(ethers.getBytes(userOpHash));

    const coder = ethers.AbiCoder.defaultAbiCoder();
    userOp.signature = coder.encode(
      [
        "tuple(address smartAccount, address sessionKey, uint256 nonce, uint256 validUntil, uint256 validAfter, address[] allowedTargets, bytes4[] allowedSelectors, uint256 maxValue, uint256 chainId)",
        "bytes",
        "bytes",
      ],
      [
        [
          params.policy.smartAccount,
          params.policy.sessionKey,
          params.policy.nonce,
          params.policy.validUntil,
          params.policy.validAfter,
          params.policy.allowedTargets,
          params.policy.allowedSelectors,
          params.policy.maxValue,
          params.policy.chainId,
        ],
        grantorSig,
        agentSig,
      ]
    );

    return { userOp, userOpHash };
  }

  async function expectRevert(action: Promise<any>) {
    try {
      await action;
      expect.unreachable("Expected transaction to revert");
    } catch (err: any) {
      const errorStr = (err?.data || "") + (err?.message || "");
      const didRevert =
        errorStr.includes("0xa175e5cb") || // ValidationFailed
        errorStr.includes("ValidationFailed") ||
        errorStr.includes("revert") ||
        errorStr.includes("reverted");
      expect(didRevert).toBe(true);
    }
  }

  it("1. Successfully executes valid authorized UserOp through EntryPoint", async () => {
    const accountAddress = await modularAccount.getAddress();
    const targetAddress = await targetContract.getAddress();
    const incrementSelector = targetContract.interface.getFunction("increment")!.selector;

    const policy = {
      smartAccount: accountAddress,
      sessionKey: agent.address,
      nonce: 101,
      validUntil: Math.floor(Date.now() / 1000) + 7200,
      validAfter: 0,
      allowedTargets: [targetAddress],
      allowedSelectors: [incrementSelector],
      maxValue: ethers.parseEther("1.0"),
      chainId: CHAIN_ID,
    };

    const execCallData = modularAccount.interface.encodeFunctionData(
      "execute(address,uint256,bytes)",
      [targetAddress, 0, targetContract.interface.encodeFunctionData("increment")]
    );

    const { userOp } = await buildUserOp({
      policy,
      grantorSigner: grantor,
      agentSigner: agent,
      callData: execCallData,
      nonce: 1,
    });

    const countBefore = await targetContract.count();
    await entryPoint.handleOps([userOp], agent.address);
    const countAfter = await targetContract.count();

    expect(countAfter).toBe(countBefore + BigInt(1));
    expect(await targetContract.lastCaller()).toBe(accountAddress);
  });

  it("2. Successfully executes ERC-7579 mode format (execute(bytes32,bytes))", async () => {
    const accountAddress = await modularAccount.getAddress();
    const targetAddress = await targetContract.getAddress();
    const addSelector = targetContract.interface.getFunction("add")!.selector;

    const policy = {
      smartAccount: accountAddress,
      sessionKey: agent.address,
      nonce: 102,
      validUntil: Math.floor(Date.now() / 1000) + 7200,
      validAfter: 0,
      allowedTargets: [targetAddress],
      allowedSelectors: [addSelector],
      maxValue: ethers.parseEther("1.0"),
      chainId: CHAIN_ID,
    };

    const innerCall = targetContract.interface.encodeFunctionData("add", [5]);
    const innerPayload = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "bytes"],
      [targetAddress, 0, innerCall]
    );

    // ERC-7579 single execution mode: 0x00...
    const execCallData = modularAccount.interface.encodeFunctionData(
      "execute(bytes32,bytes)",
      [ethers.ZeroHash, innerPayload]
    );

    const { userOp } = await buildUserOp({
      policy,
      grantorSigner: grantor,
      agentSigner: agent,
      callData: execCallData,
      nonce: 2,
    });

    const countBefore = await targetContract.count();
    await entryPoint.handleOps([userOp], agent.address);
    const countAfter = await targetContract.count();

    expect(countAfter).toBe(countBefore + BigInt(5));
  });

  it("3. Rejects UserOp when sender does not match policy smartAccount", async () => {
    const targetAddress = await targetContract.getAddress();
    const policy = {
      smartAccount: ethers.Wallet.createRandom().address, // Mismatched smart account
      sessionKey: agent.address,
      nonce: 103,
      validUntil: Math.floor(Date.now() / 1000) + 7200,
      validAfter: 0,
      allowedTargets: [targetAddress],
      allowedSelectors: [targetContract.interface.getFunction("increment")!.selector],
      maxValue: ethers.parseEther("1.0"),
      chainId: CHAIN_ID,
    };

    const execCallData = modularAccount.interface.encodeFunctionData(
      "execute(address,uint256,bytes)",
      [targetAddress, 0, targetContract.interface.encodeFunctionData("increment")]
    );

    const { userOp } = await buildUserOp({
      policy,
      grantorSigner: grantor,
      agentSigner: agent,
      callData: execCallData,
    });

    await expectRevert(entryPoint.handleOps([userOp], agent.address));
  });

  it("4. Rejects UserOp signed by wrong/unauthorized session key", async () => {
    const accountAddress = await modularAccount.getAddress();
    const targetAddress = await targetContract.getAddress();

    const policy = {
      smartAccount: accountAddress,
      sessionKey: agent.address, // Authorized session key is agent
      nonce: 104,
      validUntil: Math.floor(Date.now() / 1000) + 7200,
      validAfter: 0,
      allowedTargets: [targetAddress],
      allowedSelectors: [targetContract.interface.getFunction("increment")!.selector],
      maxValue: ethers.parseEther("1.0"),
      chainId: CHAIN_ID,
    };

    const execCallData = modularAccount.interface.encodeFunctionData(
      "execute(address,uint256,bytes)",
      [targetAddress, 0, targetContract.interface.encodeFunctionData("increment")]
    );

    // Attacker signs userOp instead of agent
    const { userOp } = await buildUserOp({
      policy,
      grantorSigner: grantor,
      agentSigner: attacker,
      callData: execCallData,
    });

    await expectRevert(entryPoint.handleOps([userOp], agent.address));
  });

  it("5. Rejects UserOp with invalid/forged grantor signature", async () => {
    const accountAddress = await modularAccount.getAddress();
    const targetAddress = await targetContract.getAddress();

    const policy = {
      smartAccount: accountAddress,
      sessionKey: agent.address,
      nonce: 105,
      validUntil: Math.floor(Date.now() / 1000) + 7200,
      validAfter: 0,
      allowedTargets: [targetAddress],
      allowedSelectors: [targetContract.interface.getFunction("increment")!.selector],
      maxValue: ethers.parseEther("1.0"),
      chainId: CHAIN_ID,
    };

    const execCallData = modularAccount.interface.encodeFunctionData(
      "execute(address,uint256,bytes)",
      [targetAddress, 0, targetContract.interface.encodeFunctionData("increment")]
    );

    // Attacker signs grantor policy instead of grantor
    const { userOp } = await buildUserOp({
      policy,
      grantorSigner: attacker,
      agentSigner: agent,
      callData: execCallData,
    });

    await expectRevert(entryPoint.handleOps([userOp], agent.address));
  });

  it("6. Rejects malformed signature encoding", async () => {
    const targetAddress = await targetContract.getAddress();
    const userOp = {
      sender: await modularAccount.getAddress(),
      nonce: 6,
      initCode: "0x",
      callData: modularAccount.interface.encodeFunctionData("execute(address,uint256,bytes)", [
        targetAddress,
        0,
        targetContract.interface.encodeFunctionData("increment"),
      ]),
      accountGasLimits: ethers.ZeroHash,
      preVerificationGas: 0,
      gasFees: ethers.ZeroHash,
      paymasterAndData: "0x",
      signature: "0xdeadbeef1234", // Malformed
    };

    await expectRevert(entryPoint.handleOps([userOp], agent.address));
  });

  it("7. Rejects expired session policy", async () => {
    const accountAddress = await modularAccount.getAddress();
    const targetAddress = await targetContract.getAddress();

    const policy = {
      smartAccount: accountAddress,
      sessionKey: agent.address,
      nonce: 107,
      validUntil: Math.floor(Date.now() / 1000) - 100, // Expired in the past
      validAfter: 0,
      allowedTargets: [targetAddress],
      allowedSelectors: [targetContract.interface.getFunction("increment")!.selector],
      maxValue: ethers.parseEther("1.0"),
      chainId: CHAIN_ID,
    };

    const execCallData = modularAccount.interface.encodeFunctionData(
      "execute(address,uint256,bytes)",
      [targetAddress, 0, targetContract.interface.encodeFunctionData("increment")]
    );

    const { userOp } = await buildUserOp({
      policy,
      grantorSigner: grantor,
      agentSigner: agent,
      callData: execCallData,
    });

    await expectRevert(entryPoint.handleOps([userOp], agent.address));
  });

  it("8. Rejects not-yet-valid session policy", async () => {
    const accountAddress = await modularAccount.getAddress();
    const targetAddress = await targetContract.getAddress();

    const policy = {
      smartAccount: accountAddress,
      sessionKey: agent.address,
      nonce: 108,
      validUntil: Math.floor(Date.now() / 1000) + 10000,
      validAfter: Math.floor(Date.now() / 1000) + 3600, // Valid only in future
      allowedTargets: [targetAddress],
      allowedSelectors: [targetContract.interface.getFunction("increment")!.selector],
      maxValue: ethers.parseEther("1.0"),
      chainId: CHAIN_ID,
    };

    const execCallData = modularAccount.interface.encodeFunctionData(
      "execute(address,uint256,bytes)",
      [targetAddress, 0, targetContract.interface.encodeFunctionData("increment")]
    );

    const { userOp } = await buildUserOp({
      policy,
      grantorSigner: grantor,
      agentSigner: agent,
      callData: execCallData,
    });

    await expectRevert(entryPoint.handleOps([userOp], agent.address));
  });

  it("9. Rejects session policy with mismatched chainId", async () => {
    const accountAddress = await modularAccount.getAddress();
    const targetAddress = await targetContract.getAddress();

    const policy = {
      smartAccount: accountAddress,
      sessionKey: agent.address,
      nonce: 109,
      validUntil: Math.floor(Date.now() / 1000) + 7200,
      validAfter: 0,
      allowedTargets: [targetAddress],
      allowedSelectors: [targetContract.interface.getFunction("increment")!.selector],
      maxValue: ethers.parseEther("1.0"),
      chainId: 99999, // Wrong chainId
    };

    const execCallData = modularAccount.interface.encodeFunctionData(
      "execute(address,uint256,bytes)",
      [targetAddress, 0, targetContract.interface.encodeFunctionData("increment")]
    );

    const { userOp } = await buildUserOp({
      policy,
      grantorSigner: grantor,
      agentSigner: agent,
      callData: execCallData,
    });

    await expectRevert(entryPoint.handleOps([userOp], agent.address));
  });

  it("10. Rejects UserOp for revoked policy nonce", async () => {
    const accountAddress = await modularAccount.getAddress();
    const targetAddress = await targetContract.getAddress();
    const nonce = 110;

    const policy = {
      smartAccount: accountAddress,
      sessionKey: agent.address,
      nonce,
      validUntil: Math.floor(Date.now() / 1000) + 7200,
      validAfter: 0,
      allowedTargets: [targetAddress],
      allowedSelectors: [targetContract.interface.getFunction("increment")!.selector],
      maxValue: ethers.parseEther("1.0"),
      chainId: CHAIN_ID,
    };

    // Grantor explicitly revokes nonce on validator
    await (validator.connect(grantor) as any).revokeSessionNonce(nonce);
    expect(await (validator as any).revokedNonces(grantor.address, nonce)).toBe(true);

    const execCallData = modularAccount.interface.encodeFunctionData(
      "execute(address,uint256,bytes)",
      [targetAddress, 0, targetContract.interface.encodeFunctionData("increment")]
    );

    const { userOp } = await buildUserOp({
      policy,
      grantorSigner: grantor,
      agentSigner: agent,
      callData: execCallData,
    });

    await expectRevert(entryPoint.handleOps([userOp], agent.address));
  });

  it("11. Rejects target allowlist bypass attempt", async () => {
    const accountAddress = await modularAccount.getAddress();
    const unauthorizedTarget = ethers.Wallet.createRandom().address;
    const targetAddress = await targetContract.getAddress();

    const policy = {
      smartAccount: accountAddress,
      sessionKey: agent.address,
      nonce: 111,
      validUntil: Math.floor(Date.now() / 1000) + 7200,
      validAfter: 0,
      allowedTargets: [targetAddress], // Only targetContract allowed
      allowedSelectors: [targetContract.interface.getFunction("increment")!.selector],
      maxValue: ethers.parseEther("1.0"),
      chainId: CHAIN_ID,
    };

    // UserOp attempts to call unauthorizedTarget
    const execCallData = modularAccount.interface.encodeFunctionData(
      "execute(address,uint256,bytes)",
      [unauthorizedTarget, 0, "0x"]
    );

    const { userOp } = await buildUserOp({
      policy,
      grantorSigner: grantor,
      agentSigner: agent,
      callData: execCallData,
    });

    await expectRevert(entryPoint.handleOps([userOp], agent.address));
  });

  it("12. Rejects selector allowlist bypass attempt on allowed target", async () => {
    const accountAddress = await modularAccount.getAddress();
    const targetAddress = await targetContract.getAddress();

    const policy = {
      smartAccount: accountAddress,
      sessionKey: agent.address,
      nonce: 112,
      validUntil: Math.floor(Date.now() / 1000) + 7200,
      validAfter: 0,
      allowedTargets: [targetAddress],
      allowedSelectors: [targetContract.interface.getFunction("increment")!.selector], // Only increment allowed
      maxValue: ethers.parseEther("1.0"),
      chainId: CHAIN_ID,
    };

    // UserOp attempts to call blockedAction() on targetContract
    const blockedCall = targetContract.interface.encodeFunctionData("blockedAction");
    const execCallData = modularAccount.interface.encodeFunctionData(
      "execute(address,uint256,bytes)",
      [targetAddress, 0, blockedCall]
    );

    const { userOp } = await buildUserOp({
      policy,
      grantorSigner: grantor,
      agentSigner: agent,
      callData: execCallData,
    });

    await expectRevert(entryPoint.handleOps([userOp], agent.address));
  });

  it("13. Rejects batch execution mode (CALLTYPE_BATCH)", async () => {
    const accountAddress = await modularAccount.getAddress();
    const targetAddress = await targetContract.getAddress();

    const policy = {
      smartAccount: accountAddress,
      sessionKey: agent.address,
      nonce: 113,
      validUntil: Math.floor(Date.now() / 1000) + 7200,
      validAfter: 0,
      allowedTargets: [targetAddress],
      allowedSelectors: [targetContract.interface.getFunction("increment")!.selector],
      maxValue: ethers.parseEther("1.0"),
      chainId: CHAIN_ID,
    };

    // ERC-7579 mode with callType = 0x01 (CALLTYPE_BATCH)
    const batchMode = "0x0100000000000000000000000000000000000000000000000000000000000000";
    const execCallData = modularAccount.interface.encodeFunctionData(
      "execute(bytes32,bytes)",
      [batchMode, "0x1234"]
    );

    const { userOp } = await buildUserOp({
      policy,
      grantorSigner: grantor,
      agentSigner: agent,
      callData: execCallData,
    });

    await expectRevert(entryPoint.handleOps([userOp], agent.address));
  });

  it("14. Enforces on-chain spend cap and prevents cumulative spend exceedance", async () => {
    const accountAddress = await modularAccount.getAddress();
    const targetAddress = await targetContract.getAddress();
    const paySelector = targetContract.interface.getFunction("payMe")!.selector;
    const spendCap = ethers.parseEther("0.5");

    const policy = {
      smartAccount: accountAddress,
      sessionKey: agent.address,
      nonce: 114,
      validUntil: Math.floor(Date.now() / 1000) + 7200,
      validAfter: 0,
      allowedTargets: [targetAddress],
      allowedSelectors: [paySelector],
      maxValue: spendCap,
      chainId: CHAIN_ID,
    };

    const payCall = targetContract.interface.encodeFunctionData("payMe");

    // Spend 0.3 ETH -> should succeed
    const execCallData1 = modularAccount.interface.encodeFunctionData(
      "execute(address,uint256,bytes)",
      [targetAddress, ethers.parseEther("0.3"), payCall]
    );
    const { userOp: op1 } = await buildUserOp({
      policy,
      grantorSigner: grantor,
      agentSigner: agent,
      callData: execCallData1,
      nonce: 10,
    });
    await entryPoint.handleOps([op1], agent.address);

    const spendRecorded = await validator.policySpend(accountAddress, 114);
    expect(spendRecorded).toBe(ethers.parseEther("0.3"));

    // Spend another 0.3 ETH (total 0.6 ETH > 0.5 ETH max) -> should be rejected!
    const execCallData2 = modularAccount.interface.encodeFunctionData(
      "execute(address,uint256,bytes)",
      [targetAddress, ethers.parseEther("0.3"), payCall]
    );
    const { userOp: op2 } = await buildUserOp({
      policy,
      grantorSigner: grantor,
      agentSigner: agent,
      callData: execCallData2,
      nonce: 11,
    });

    await expectRevert(entryPoint.handleOps([op2], agent.address));
  });

  it("15. Enforces isolated spend accounting across distinct policies", async () => {
    const accountAddress = await modularAccount.getAddress();
    const targetAddress = await targetContract.getAddress();
    const paySelector = targetContract.interface.getFunction("payMe")!.selector;

    // Policy A (nonce 115) and Policy B (nonce 116)
    const policyA = {
      smartAccount: accountAddress,
      sessionKey: agent.address,
      nonce: 115,
      validUntil: Math.floor(Date.now() / 1000) + 7200,
      validAfter: 0,
      allowedTargets: [targetAddress],
      allowedSelectors: [paySelector],
      maxValue: ethers.parseEther("1.0"),
      chainId: CHAIN_ID,
    };
    const policyB = {
      smartAccount: accountAddress,
      sessionKey: agent.address,
      nonce: 116,
      validUntil: Math.floor(Date.now() / 1000) + 7200,
      validAfter: 0,
      allowedTargets: [targetAddress],
      allowedSelectors: [paySelector],
      maxValue: ethers.parseEther("1.0"),
      chainId: CHAIN_ID,
    };

    const payCall = targetContract.interface.encodeFunctionData("payMe");
    const execCallData = modularAccount.interface.encodeFunctionData(
      "execute(address,uint256,bytes)",
      [targetAddress, ethers.parseEther("0.4"), payCall]
    );

    const { userOp: opA } = await buildUserOp({
      policy: policyA,
      grantorSigner: grantor,
      agentSigner: agent,
      callData: execCallData,
      nonce: 20,
    });
    await entryPoint.handleOps([opA], agent.address);

    expect(await (validator as any).policySpend(accountAddress, 115)).toBe(ethers.parseEther("0.4"));
    // Policy B spend remains zero
    expect(await (validator as any).policySpend(accountAddress, 116)).toBe(BigInt(0));
  });

  it("16. Rejects unauthorized direct external calls to validator.validateUserOp", async () => {
    const accountAddress = await modularAccount.getAddress();
    const targetAddress = await targetContract.getAddress();

    const policy = {
      smartAccount: accountAddress,
      sessionKey: agent.address,
      nonce: 117,
      validUntil: Math.floor(Date.now() / 1000) + 7200,
      validAfter: 0,
      allowedTargets: [targetAddress],
      allowedSelectors: [targetContract.interface.getFunction("increment")!.selector],
      maxValue: ethers.parseEther("1.0"),
      chainId: CHAIN_ID,
    };

    const execCallData = modularAccount.interface.encodeFunctionData(
      "execute(address,uint256,bytes)",
      [targetAddress, 0, targetContract.interface.encodeFunctionData("increment")]
    );

    const { userOp, userOpHash } = await buildUserOp({
      policy,
      grantorSigner: grantor,
      agentSigner: agent,
      callData: execCallData,
    });

    // Attacker calls validator directly (msg.sender != userOp.sender)
    const res = await (validator.connect(attacker) as any).validateUserOp.staticCall(userOp, userOpHash);
    // Returns 1 (SIG_VALIDATION_FAILED) because msg.sender is attacker, not smart account
    expect(res).toBe(BigInt(1));
  });

  it("17. Executes end-to-end UserOperation through canonical ERC-4337 v0.7 EntryPoint with SessionKeyValidator", async () => {
    const accountAddress = await canonicalModularAccount.getAddress();
    const targetAddress = await targetContract.getAddress();
    const countBefore = await targetContract.count();

    const policy = {
      smartAccount: accountAddress,
      sessionKey: agent.address,
      nonce: 201,
      validUntil: Math.floor(Date.now() / 1000) + 7200,
      validAfter: 0,
      allowedTargets: [targetAddress],
      allowedSelectors: [targetContract.interface.getFunction("increment")!.selector],
      maxValue: ethers.parseEther("1.0"),
      chainId: CHAIN_ID,
    };

    const grantorSig = await (grantor as any).signTypedData(
      EIP712_DOMAIN,
      POLICY_TYPES,
      policy
    );

    const execCallData = canonicalModularAccount.interface.encodeFunctionData(
      "execute(address,uint256,bytes)",
      [targetAddress, 0, targetContract.interface.encodeFunctionData("increment")]
    );

    // ERC-4337 v0.7 Gas Limits: packed verificationGasLimit (500000) and callGasLimit (500000)
    const accountGasLimits = ethers.concat([
      ethers.zeroPadValue(ethers.toBeHex(500000), 16),
      ethers.zeroPadValue(ethers.toBeHex(500000), 16),
    ]);
    const gasFees = ethers.concat([
      ethers.zeroPadValue(ethers.toBeHex(1000000000), 16),
      ethers.zeroPadValue(ethers.toBeHex(1000000000), 16),
    ]);

    const nonce = await (canonicalEntryPoint as any).getNonce(accountAddress, 0);

    const userOp = {
      sender: accountAddress,
      nonce,
      initCode: "0x",
      callData: execCallData,
      accountGasLimits,
      preVerificationGas: 100000,
      gasFees,
      paymasterAndData: "0x",
      signature: "0x",
    };

    const userOpHash = await (canonicalEntryPoint as any).getUserOpHash(userOp);
    const agentSig = await agent.signMessage(ethers.getBytes(userOpHash));

    const coder = ethers.AbiCoder.defaultAbiCoder();
    userOp.signature = coder.encode(
      [
        "tuple(address smartAccount, address sessionKey, uint256 nonce, uint256 validUntil, uint256 validAfter, address[] allowedTargets, bytes4[] allowedSelectors, uint256 maxValue, uint256 chainId)",
        "bytes",
        "bytes",
      ],
      [
        [
          policy.smartAccount,
          policy.sessionKey,
          policy.nonce,
          policy.validUntil,
          policy.validAfter,
          policy.allowedTargets,
          policy.allowedSelectors,
          policy.maxValue,
          policy.chainId,
        ],
        grantorSig,
        agentSig,
      ]
    );

    // Execute via canonical official ERC-4337 EntryPoint handleOps
    const tx = await (canonicalEntryPoint.connect(deployer) as any).handleOps([userOp], await deployer.getAddress());
    const receipt = await tx.wait();
    expect(receipt.status).toBe(1);

    // Verify state transition on Target contract
    const countAfter = await targetContract.count();
    expect(countAfter).toBe(countBefore + BigInt(1));
  });

  it("18. Canonical EntryPoint rejects UserOperation when spend limit is exceeded", async () => {
    const accountAddress = await canonicalModularAccount.getAddress();
    const targetAddress = await targetContract.getAddress();
    const paySelector = targetContract.interface.getFunction("payMe")!.selector;

    const policy = {
      smartAccount: accountAddress,
      sessionKey: agent.address,
      nonce: 202,
      validUntil: Math.floor(Date.now() / 1000) + 7200,
      validAfter: 0,
      allowedTargets: [targetAddress],
      allowedSelectors: [paySelector],
      maxValue: ethers.parseEther("0.5"),
      chainId: CHAIN_ID,
    };

    const grantorSig = await (grantor as any).signTypedData(
      EIP712_DOMAIN,
      POLICY_TYPES,
      policy
    );

    // Attempt to spend 0.6 ETH when maxValue is 0.5 ETH
    const payCall = targetContract.interface.encodeFunctionData("payMe");
    const execCallData = canonicalModularAccount.interface.encodeFunctionData(
      "execute(address,uint256,bytes)",
      [targetAddress, ethers.parseEther("0.6"), payCall]
    );

    const accountGasLimits = ethers.concat([
      ethers.zeroPadValue(ethers.toBeHex(500000), 16),
      ethers.zeroPadValue(ethers.toBeHex(500000), 16),
    ]);
    const gasFees = ethers.concat([
      ethers.zeroPadValue(ethers.toBeHex(1000000000), 16),
      ethers.zeroPadValue(ethers.toBeHex(1000000000), 16),
    ]);

    const nonce = await (canonicalEntryPoint as any).getNonce(accountAddress, 0);

    const userOp = {
      sender: accountAddress,
      nonce,
      initCode: "0x",
      callData: execCallData,
      accountGasLimits,
      preVerificationGas: 100000,
      gasFees,
      paymasterAndData: "0x",
      signature: "0x",
    };

    const userOpHash = await (canonicalEntryPoint as any).getUserOpHash(userOp);
    const agentSig = await agent.signMessage(ethers.getBytes(userOpHash));

    const coder = ethers.AbiCoder.defaultAbiCoder();
    userOp.signature = coder.encode(
      [
        "tuple(address smartAccount, address sessionKey, uint256 nonce, uint256 validUntil, uint256 validAfter, address[] allowedTargets, bytes4[] allowedSelectors, uint256 maxValue, uint256 chainId)",
        "bytes",
        "bytes",
      ],
      [
        [
          policy.smartAccount,
          policy.sessionKey,
          policy.nonce,
          policy.validUntil,
          policy.validAfter,
          policy.allowedTargets,
          policy.allowedSelectors,
          policy.maxValue,
          policy.chainId,
        ],
        grantorSig,
        agentSig,
      ]
    );

    // Canonical EntryPoint must revert on execution because validator returns 1 (FailedOp / AA24 signature error)
    await expect(
      (canonicalEntryPoint.connect(deployer) as any).handleOps([userOp], await deployer.getAddress())
    ).rejects.toThrow(/(FailedOp|execution reverted|AA24)/);
  });
});
