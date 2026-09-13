import { NextRequest, NextResponse } from "next/server";
import { AccountId, Hbar, TransferTransaction } from "@hiero-ledger/sdk";
import { getOperatorClient, getOperatorId, getOperatorKey } from "@/lib/hedera/client";
import { hashscanTxUrl } from "@/lib/hedera/format";
import { checkRateLimit, getClientIp } from "@/lib/api/rateLimit";
import { isDemoMode } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  checkRateLimit(getClientIp(req), 20);

  const agentSecret = req.headers.get("x-tokenization-agent-secret");
  const expectedSecret = process.env.TOKENIZATION_AGENT_SECRET;

  if (expectedSecret && agentSecret !== expectedSecret) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid agent secret" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { invoiceId, payee, amountTinybar } = body as {
      invoiceId?: string;
      payee?: string;
      amountTinybar?: string;
    };

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Missing required 'invoiceId'" },
        { status: 400 }
      );
    }

    const payeeIdStr = payee || process.env.HEDERA_ORACLE_PAYEE_ID || process.env.HEDERA_OPERATOR_ID || "0.0.10521086";
    const payeeId = AccountId.fromString(payeeIdStr);

    const client = getOperatorClient();
    const operatorKey = getOperatorKey();
    const operatorId = getOperatorId();

    const transferTx = await new TransferTransaction()
      .addHbarTransfer(operatorId, new Hbar(-0.0001))
      .addHbarTransfer(payeeId, new Hbar(0.0001))
      .setTransactionMemo(`x402:${invoiceId}`)
      .freezeWith(client);

    const signedTx = await transferTx.sign(operatorKey);
    const resp = await signedTx.execute(client);
    const receipt = await resp.getReceipt(client);

    if (!receipt.status) {
      throw new Error("Hedera transaction execution failed to receive receipt status.");
    }

    const txId = resp.transactionId.toString();
    const hashscanUrl = hashscanTxUrl(txId);

    return NextResponse.json({
      success: true,
      txId,
      hashscanUrl,
      invoiceId,
      payee: payeeIdStr,
      status: receipt.status.toString(),
    });
  } catch (err: any) {
    if (isDemoMode()) {
      const demoTxId = `0.0.10521086@${Math.floor(Date.now() / 1000)}.000000000`;
      return NextResponse.json({
        success: true,
        _demo: true,
        txId: demoTxId,
        hashscanUrl: hashscanTxUrl(demoTxId),
      });
    }

    return NextResponse.json(
      { error: `Failed to settle Hedera micropayment: ${err.message || err}` },
      { status: 500 }
    );
  }
}
