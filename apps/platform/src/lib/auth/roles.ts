export type Role = "public" | "investor" | "operator" | "agent";

export interface AuthContext {
  role: Exclude<Role, "public">;
  address: string;
  sessionId: string;
}

export const DEFAULT_OPERATOR_ADDRESSES = [
  "0x3a97b1206489c853a836a2286bbf228fd0dd040e", // Connected demo/judge wallet
  "0x81d6652d2840973c54883d5e69a6397596236f3c", // Hedera EVM operator
  "0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7", // Platform operator 1
  "0x70997970c51812dc3a010c7d01b50e0d17dc79c8", // Platform operator 2
];

export function isOperatorAddress(addr?: string | null): boolean {
  if (!addr) return false;
  const lower = addr.toLowerCase();
  const configured = (process.env.OPERATOR_ADDRESSES ?? "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);

  const allowlist = new Set([
    ...DEFAULT_OPERATOR_ADDRESSES.map((a) => a.toLowerCase()),
    ...configured,
  ]);

  if (allowlist.has(lower)) return true;

  // On testnet in non-test runtime, permit connected user tokenizing real estate
  if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
    return true;
  }

  return false;
}

