import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createToken,
  getTokenBalanceBaseUnits,
  isAssociated,
  freezeAccount,
  HederaConfigurationError,
} from "@/lib/hedera/tokenService";

describe("Hedera Token Service Security & Fail-Closed Behavior", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear operator credentials to simulate unconfigured/missing credentials
    delete process.env.HEDERA_OPERATOR_ID;
    delete process.env.HEDERA_OPERATOR_KEY;
    delete process.env.DEMO_MODE;
    (process.env as any).NODE_ENV = "test";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("fails closed when operator credentials are missing and demo mode is disabled", async () => {
    process.env.DEMO_MODE = "false";
    (process.env as any).NODE_ENV = "development";

    await expect(
      createToken({
        name: "Test RWA",
        symbol: "TRWA",
        tokenType: "FUNGIBLE",
        decimals: 2,
        initialSupply: 1000,
        supplyType: "FINITE",
        compliance: {
          kycRequired: false,
          freezeDefault: false,
          wipeEnabled: false,
          pauseEnabled: false,
          worldIdRequired: false,
          worldIdSelfieCheck: false,
          livenessEnabled: false,
        },
      })
    ).rejects.toThrow(HederaConfigurationError);
  });

  it("strictly rejects synthetic fallback in production mode even if DEMO_MODE=true", async () => {
    (process.env as any).NODE_ENV = "production";
    process.env.DEMO_MODE = "true";

    await expect(
      createToken({
        name: "Test RWA",
        symbol: "TRWA",
        tokenType: "FUNGIBLE",
        decimals: 2,
        initialSupply: 1000,
        supplyType: "FINITE",
        compliance: {
          kycRequired: false,
          freezeDefault: false,
          wipeEnabled: false,
          pauseEnabled: false,
          worldIdRequired: false,
          worldIdSelfieCheck: false,
          livenessEnabled: false,
        },
      })
    ).rejects.toThrow(HederaConfigurationError);
  });

  it("permits simulated token creation ONLY in non-production demo mode with explicit _demo tag", async () => {
    (process.env as any).NODE_ENV = "development";
    process.env.DEMO_MODE = "true";

    const result = await createToken({
      name: "Test RWA",
      symbol: "TRWA",
      tokenType: "FUNGIBLE",
      decimals: 2,
      initialSupply: 1000,
      supplyType: "FINITE",
      compliance: {
        kycRequired: false,
        freezeDefault: false,
        wipeEnabled: false,
        pauseEnabled: false,
        worldIdRequired: false,
        worldIdSelfieCheck: false,
        livenessEnabled: false,
      },
    });

    expect(result._demo).toBe(true);
    expect(result.simulationNotice).toBe("Simulated — not on-chain.");
    expect(result.tokenId).toMatch(/^demo-0\.0\./);
    expect(result.txId).toMatch(/^demo-0\.0\./);
  });

  it("fails closed on balance check and association query outside demo mode", async () => {
    process.env.DEMO_MODE = "false";

    await expect(getTokenBalanceBaseUnits("0.0.12345", "0.0.54321")).rejects.toThrow(
      HederaConfigurationError
    );

    await expect(isAssociated("0.0.12345", "0.0.54321")).rejects.toThrow(
      HederaConfigurationError
    );

    await expect(freezeAccount("0.0.12345", "0.0.54321")).rejects.toThrow(
      HederaConfigurationError
    );
  });

  it("strictly rejects mainnet configuration and explorer URLs in testnet-only mode", async () => {
    const { assertTestnetOnly, MainnetConfigurationError } = await import("@/lib/hedera/client");
    const { configuredHederaNetwork, tokenExplorerUrl, transactionExplorerUrl } = await import("@/lib/chains");

    process.env.HEDERA_NETWORK = "mainnet";

    expect(() => assertTestnetOnly()).toThrow(MainnetConfigurationError);
    expect(() => configuredHederaNetwork()).toThrow(/FATAL: Mainnet configuration rejected/);

    expect(() => tokenExplorerUrl("HEDERA", "mainnet" as any, "0.0.12345")).toThrow(
      /Mainnet explorer URLs are rejected/
    );
    expect(() =>
      transactionExplorerUrl({ blockchain: "HEDERA", network: "mainnet" as any }, "0.0.12345@123")
    ).toThrow(/Mainnet explorer URLs are rejected/);

    process.env.HEDERA_NETWORK = "testnet";
    expect(() => assertTestnetOnly()).not.toThrow();
    expect(configuredHederaNetwork()).toBe("testnet");
  });
});
