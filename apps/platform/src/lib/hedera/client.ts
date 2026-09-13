import { AccountId, Client, PrivateKey } from "@hiero-ledger/sdk";

export class MainnetConfigurationError extends Error {
  constructor(
    message = "FATAL: Mainnet configuration rejected. This release of Prism 8 is strictly testnet/previewnet only."
  ) {
    super(message);
    this.name = "MainnetConfigurationError";
  }
}

export function assertTestnetOnly(): void {
  const n = (process.env.HEDERA_NETWORK ?? "testnet").toLowerCase();
  if (n === "mainnet") throw new MainnetConfigurationError();
}

function networkName(): "testnet" | "previewnet" {
  assertTestnetOnly();
  const n = (process.env.HEDERA_NETWORK ?? "testnet").toLowerCase();
  return n === "previewnet" ? "previewnet" : "testnet";
}

const TESTNET_FALLBACK_OPERATOR_ID = "0.0.10521086";
const TESTNET_FALLBACK_OPERATOR_KEY =
  "0xa5521c1ab443772d4993015cf5591b9178c3f3118d0097d8d7383e19dbda07ee";

export function isOperatorConfigured(): boolean {
  if (process.env.HEDERA_OPERATOR_ID && process.env.HEDERA_OPERATOR_KEY) {
    return true;
  }
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return false;
  }
  return true;
}

/**
 * Always returns a fresh Client with a clean gRPC channel.
 * Never caches SDK objects in globalThis to avoid HMR class-identity mismatches.
 */
export function getOperatorClient(): Client {
  assertTestnetOnly();
  const net = networkName();
  const client = net === "previewnet" ? Client.forPreviewnet() : Client.forTestnet();

  const idStr = process.env.HEDERA_OPERATOR_ID || TESTNET_FALLBACK_OPERATOR_ID;
  const keyStr = process.env.HEDERA_OPERATOR_KEY || TESTNET_FALLBACK_OPERATOR_KEY;
  if (idStr && keyStr) {
    const operatorId = AccountId.fromString(idStr);
    const operatorKey = PrivateKey.isDerKey(keyStr)
      ? PrivateKey.fromStringDer(keyStr)
      : PrivateKey.fromStringECDSA(keyStr);
    client.setOperator(operatorId, operatorKey);
  }

  return client;
}

export function getOperatorKey(): PrivateKey {
  const keyStr = process.env.HEDERA_OPERATOR_KEY || TESTNET_FALLBACK_OPERATOR_KEY;
  if (!keyStr) throw new Error("HEDERA_OPERATOR_KEY is not configured in environment.");
  return PrivateKey.isDerKey(keyStr)
    ? PrivateKey.fromStringDer(keyStr)
    : PrivateKey.fromStringECDSA(keyStr);
}

export function getOperatorId(): AccountId {
  const idStr = process.env.HEDERA_OPERATOR_ID || TESTNET_FALLBACK_OPERATOR_ID;
  return AccountId.fromString(idStr);
}
