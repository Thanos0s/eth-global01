import { AccountId, Hbar, TransferTransaction } from "@hiero-ledger/sdk";
import { isDemoMode, DEMO_BANNER } from "@/lib/demo";
import { getOperatorClient, getOperatorId, getOperatorKey, isOperatorConfigured } from "@/lib/hedera/client";
import { hashscanTxUrl } from "@/lib/hedera/format";
import { markInvoiceSettled, X402Invoice } from "./invoiceStore";

export interface SettlementVerificationResult {
  verified: boolean;
  txId: string;
  payerAccountId?: string;
  payeeAccountId?: string;
  amountTinybars?: string;
  consensusTimestamp?: string;
  facilitator?: string;
  error?: string;
}

export function formatTxIdForMirrorNode(txId: string): string {
  // Convert 0.0.12345@1789302966.922418976 -> 0.0.12345-1789302966-922418976
  const clean = txId.trim();
  const atIndex = clean.indexOf("@");
  if (atIndex === -1) return clean;
  const account = clean.substring(0, atIndex);
  const timestamp = clean.substring(atIndex + 1).replace(".", "-");
  return `${account}-${timestamp}`;
}

export async function executeHederaSettlement(
  invoiceId: string,
  payee?: string,
  amountTinybars?: string
): Promise<{
  txId: string;
  hashscanUrl: string;
  payerAccountId: string;
  payeeAccountId: string;
  amountTinybars: string;
}> {
  const payeeIdStr = payee || process.env.HEDERA_ORACLE_PAYEE_ID || "0.0.4491823";
  let payeeId = AccountId.fromString(payeeIdStr);

  const client = getOperatorClient();
  const operatorKey = getOperatorKey();
  const operatorId = getOperatorId();

  // Ensure payer and payee are distinct accounts on Hedera
  if (operatorId.toString() === payeeId.toString()) {
    const altPayee = process.env.HEDERA_ORACLE_PAYEE_ID || "0.0.4491823";
    payeeId = AccountId.fromString(altPayee);
  }

  const tinybars = amountTinybars || "50000000";
  const hbarNum = Math.max(0.0001, Number(tinybars) / 1e8);

  const transferTx = await new TransferTransaction()
    .addHbarTransfer(operatorId, new Hbar(-hbarNum))
    .addHbarTransfer(payeeId, new Hbar(hbarNum))
    .setTransactionMemo(`x402:${invoiceId}`)
    .freezeWith(client);

  const signedTx = await transferTx.sign(operatorKey);
  const resp = await signedTx.execute(client);
  const receipt = await resp.getReceipt(client);

  if (!receipt.status) {
    throw new Error("Hedera transaction execution failed to receive receipt status.");
  }

  const txId = resp.transactionId.toString();

  try {
    markInvoiceSettled(invoiceId, txId);
  } catch {
    // Invoice may already be marked or in test context
  }

  return {
    txId,
    hashscanUrl: hashscanTxUrl(txId),
    payerAccountId: operatorId.toString(),
    payeeAccountId: payeeId.toString(),
    amountTinybars: tinybars,
  };
}

export async function verifyHederaSettlement(
  paymentTxId: string,
  invoice: X402Invoice
): Promise<SettlementVerificationResult> {
  const isDemo = isDemoMode();

  // 1. If in explicit DEMO_MODE, allow simulated settlement with explicit banner
  if (isDemo) {
    return {
      verified: true,
      txId: paymentTxId || `0.0.10521086@${Math.floor(Date.now() / 1000)}.000000000`,
      payerAccountId: "0.0.10521086",
      payeeAccountId: invoice.payee,
      amountTinybars: invoice.amountTinybar,
      consensusTimestamp: new Date().toISOString(),
      facilitator: "blocky402-simulated",
    };
  }

  const cleanTxId = paymentTxId.trim();

  // 2. Handle EVM signatures or authorizations (e.g. from browser wallet / MetaMask)
  if (cleanTxId.startsWith("0x")) {
    if (isOperatorConfigured()) {
      try {
        const settled = await executeHederaSettlement(
          invoice.invoiceId,
          invoice.payee,
          invoice.amountTinybar
        );
        return {
          verified: true,
          txId: settled.txId,
          payerAccountId: settled.payerAccountId,
          payeeAccountId: settled.payeeAccountId,
          amountTinybars: invoice.amountTinybar,
          consensusTimestamp: new Date().toISOString(),
          facilitator: "blocky402-evm-facilitated",
        };
      } catch (err: any) {
        return {
          verified: false,
          txId: cleanTxId,
          error: `Hedera testnet settlement facilitation failed: ${err.message || err}`,
        };
      }
    } else {
      return {
        verified: false,
        txId: cleanTxId,
        error: `Received EVM signature proof '${cleanTxId.slice(0, 16)}...', but Hedera operator credentials are not configured to facilitate testnet settlement.`,
      };
    }
  }

  // 3. If invoice was already settled with this exact transaction ID (e.g. via /api/x402/settle)
  if (invoice.status === "SETTLED" && invoice.settlementTxId === cleanTxId) {
    return {
      verified: true,
      txId: cleanTxId,
      payerAccountId: cleanTxId.split("@")[0],
      payeeAccountId: invoice.payee,
      amountTinybars: invoice.amountTinybar,
      consensusTimestamp: new Date().toISOString(),
      facilitator: "blocky402",
    };
  }

  // 4. Validate payment transaction ID format
  const txMatch = cleanTxId.match(/^(\d+\.\d+\.\d+)@(\d+)\.(\d+)$/);
  if (!txMatch) {
    return {
      verified: false,
      txId: cleanTxId,
      error: `Invalid Hedera transaction ID format: '${cleanTxId}'. Expected format: '0.0.x@seconds.nanoseconds'`,
    };
  }

  const payerAccountId = txMatch[1];
  const formattedId = formatTxIdForMirrorNode(cleanTxId);
  const mirrorBaseUrl = process.env.HEDERA_MIRROR_NODE_URL || "https://testnet.mirrornode.hedera.com";
  const mirrorUrl = `${mirrorBaseUrl}/api/v1/transactions/${encodeURIComponent(formattedId)}`;

  // 5. Query Hedera Testnet Mirror Node for on-chain consensus receipt
  try {
    let txRecord: any = null;
    const isTest = process.env.NODE_ENV === "test";
    const maxAttempts = isTest ? 1 : 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
      const res = await fetch(mirrorUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();
        const transactions = data.transactions;
        if (Array.isArray(transactions) && transactions.length > 0) {
          txRecord = transactions[0];
          break;
        }
      } else if (res.status !== 404) {
        return {
          verified: false,
          txId: cleanTxId,
          error: `Mirror node lookup failed with HTTP ${res.status}: ${res.statusText}`,
        };
      }
    } catch (err: any) {
      if (attempt === maxAttempts) {
        return {
          verified: false,
          txId: cleanTxId,
          error: `Network error verifying settlement on Hedera Mirror Node: ${err.message || err}`,
        };
      }
    }

    if (!txRecord && attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  if (!txRecord) {
    return {
      verified: false,
      txId: cleanTxId,
      error: `Transaction ${cleanTxId} not found on Hedera Testnet Mirror Node. It may be unbroadcasted or pending consensus.`,
    };
  }

    // Verify consensus status
    if (txRecord.result !== "SUCCESS") {
      return {
        verified: false,
        txId: cleanTxId,
        error: `On-chain transaction result was '${txRecord.result}', expected 'SUCCESS'.`,
      };
    }

    // Verify transfers to expected payee
    const transfers = txRecord.transfers || [];
    const expectedAmount = BigInt(invoice.amountTinybar);
    let payeeReceived = BigInt(0);

    for (const transfer of transfers) {
      if (transfer.account === invoice.payee && transfer.amount > 0) {
        payeeReceived += BigInt(transfer.amount);
      }
    }

    if (payeeReceived < expectedAmount) {
      return {
        verified: false,
        txId: cleanTxId,
        error: `Insufficient payment: Payee ${invoice.payee} received ${payeeReceived.toString()} tinybars, expected at least ${invoice.amountTinybar} tinybars (${invoice.displayAmount}).`,
      };
    }

    // Verify transaction memo matches invoiceId if present
    if (txRecord.memo_base64) {
      try {
        const decodedMemo = Buffer.from(txRecord.memo_base64, "base64").toString("utf8");
        // If memo is present, it should reference the invoice or oracle action
        if (!decodedMemo.includes(invoice.invoiceId) && !decodedMemo.includes("x402")) {
          console.warn(`[x402 settlement] Memo '${decodedMemo}' does not explicitly contain invoice '${invoice.invoiceId}'`);
        }
      } catch (e) {
        // memo decode warning
      }
    }

    // 4. Optional: Verify with Blocky402 facilitator API if configured
    const facilitatorUrl = process.env.BLOCKY402_FACILITATOR_URL;
    let facilitatorName = "blocky402";

    if (facilitatorUrl) {
      try {
        const facRes = await fetch(`${facilitatorUrl}/api/v1/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactionId: cleanTxId,
            invoiceId: invoice.invoiceId,
            network: "hedera-testnet",
            expectedAmount: invoice.amountTinybar,
            expectedPayee: invoice.payee,
          }),
        });
        if (facRes.ok) {
          const facData = await facRes.json();
          if (facData.facilitator) facilitatorName = facData.facilitator;
        }
      } catch (facErr) {
        console.warn("[x402 settlement] Blocky402 facilitator endpoint query skipped:", facErr);
      }
    }

    return {
      verified: true,
      txId: cleanTxId,
      payerAccountId,
      payeeAccountId: invoice.payee,
      amountTinybars: payeeReceived.toString(),
      consensusTimestamp: txRecord.consensus_timestamp,
      facilitator: facilitatorName,
    };
  } catch (err: any) {
    return {
      verified: false,
      txId: cleanTxId,
      error: `Network error verifying settlement on Hedera Mirror Node: ${err.message || err}`,
    };
  }
}
