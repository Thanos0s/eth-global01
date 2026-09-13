import crypto from "node:crypto";

export type PricingTier = "STANDARD_DPV" | "PREMIUM_DPV";

export interface X402Invoice {
  invoiceId: string;
  requestHash: string;
  payee: string;
  amountTinybar: string;
  displayAmount: string;
  pricingTier: PricingTier;
  createdAt: number;
  expiresAt: number;
  status: "PENDING" | "SETTLED" | "CONSUMED";
  settlementTxId?: string;
  consumedAt?: number;
}

export const TIER_PRICING: Record<PricingTier, { tinybars: string; displayAmount: string; hbar: number }> = {
  STANDARD_DPV: {
    tinybars: "50000000", // 0.5 HBAR
    displayAmount: "0.5 HBAR",
    hbar: 0.5,
  },
  PREMIUM_DPV: {
    tinybars: "100000000", // 1.0 HBAR
    displayAmount: "1.0 HBAR",
    hbar: 1.0,
  },
};

const INVOICE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

// In-memory persistent invoice map and transaction registry to prevent replay attacks
const invoiceStore = new Map<string, X402Invoice>();
const usedTransactions = new Set<string>();

export function createInvoice(
  requestHash: string,
  tier: PricingTier = "STANDARD_DPV",
  customPayee?: string
): X402Invoice {
  const invoiceId = `inv_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const now = Date.now();
  const pricing = TIER_PRICING[tier] ?? TIER_PRICING.STANDARD_DPV;
  const payee = customPayee || process.env.HEDERA_ORACLE_PAYEE_ID || process.env.HEDERA_OPERATOR_ID || "0.0.10521086";

  const invoice: X402Invoice = {
    invoiceId,
    requestHash,
    payee,
    amountTinybar: pricing.tinybars,
    displayAmount: pricing.displayAmount,
    pricingTier: tier,
    createdAt: now,
    expiresAt: now + INVOICE_TTL_MS,
    status: "PENDING",
  };

  invoiceStore.set(invoiceId, invoice);
  return invoice;
}

export function getInvoice(invoiceId: string): X402Invoice | undefined {
  return invoiceStore.get(invoiceId);
}

export function isTxAlreadyUsed(txId: string): boolean {
  return usedTransactions.has(txId);
}

export function markInvoiceSettled(invoiceId: string, txId: string): X402Invoice {
  const invoice = invoiceStore.get(invoiceId);
  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }
  if (usedTransactions.has(txId)) {
    throw new Error(`Transaction ${txId} has already been consumed for another invoice.`);
  }

  invoice.status = "SETTLED";
  invoice.settlementTxId = txId;
  usedTransactions.add(txId);
  invoiceStore.set(invoiceId, invoice);
  return invoice;
}

export function consumeInvoice(invoiceId: string): X402Invoice {
  const invoice = invoiceStore.get(invoiceId);
  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }
  if (invoice.status === "CONSUMED") {
    throw new Error(`Invoice ${invoiceId} has already been consumed.`);
  }

  invoice.status = "CONSUMED";
  invoice.consumedAt = Date.now();
  invoiceStore.set(invoiceId, invoice);
  return invoice;
}

export function clearInvoiceStore(): void {
  invoiceStore.clear();
  usedTransactions.clear();
}
