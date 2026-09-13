import type { Blockchain, TokenNetwork, TokenRecord } from "@/types";

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

export function configuredHederaNetwork(): "testnet" | "previewnet" {
  const value = (process.env.HEDERA_NETWORK ?? "testnet").toLowerCase();
  if (value === "mainnet") {
    throw new Error(
      "FATAL: Mainnet configuration rejected. This release of Prism 8 is strictly testnet/previewnet only."
    );
  }
  return value === "previewnet" ? "previewnet" : "testnet";
}

export function tokenExplorerUrl(
  blockchain: Blockchain,
  network: TokenNetwork,
  identifier: string
): string {
  if (network === "mainnet") {
    throw new Error("Mainnet explorer URLs are rejected in testnet-only mode.");
  }
  if (blockchain === "EVM") {
    return `https://sepolia.etherscan.io/token/${identifier}`;
  }
  return `https://hashscan.io/${network}/token/${identifier}`;
}

export function transactionExplorerUrl(token: Pick<TokenRecord, "blockchain" | "network">, txId: string): string {
  if (token.network === "mainnet") {
    throw new Error("Mainnet explorer URLs are rejected in testnet-only mode.");
  }
  if (token.blockchain === "EVM") {
    return `https://sepolia.etherscan.io/tx/${txId}`;
  }
  return `https://hashscan.io/${token.network}/transaction/${encodeURIComponent(txId)}`;
}

export function worldIdHolderSignal(
  token: Pick<TokenRecord, "id" | "blockchain" | "network">,
  accountId: string
): string {
  // Never change the legacy Hedera format: existing World proofs were bound to it.
  if (token.blockchain === "HEDERA") return `hedera:${token.id}:holder:${accountId}`;
  return `eip155:${SEPOLIA_CHAIN_ID}:${token.id.toLowerCase()}:holder:${accountId.toLowerCase()}`;
}
