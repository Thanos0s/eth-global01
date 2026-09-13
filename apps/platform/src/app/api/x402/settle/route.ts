import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/api/rateLimit";
import { isDemoMode } from "@/lib/demo";
import { hashscanTxUrl } from "@/lib/hedera/format";
import { getInvoice } from "@/lib/x402/invoiceStore";
import { executeHederaSettlement } from "@/lib/x402/settlementVerifier";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  checkRateLimit(getClientIp(req), 20);

  try {
    const body = await req.json();
    const { invoiceId, payee, amountTinybar } = body as {
      invoiceId?: string;
      payee?: string;
      amountTinybar?: string;
      signature?: string;
      signerAddress?: string;
    };

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Missing required 'invoiceId'" },
        { status: 400 }
      );
    }

    const agentSecret = req.headers.get("x-tokenization-agent-secret");
    const expectedSecret = process.env.TOKENIZATION_AGENT_SECRET;
    const invoice = getInvoice(invoiceId);

    // Authorize if secret matches OR if invoice exists in store and is pending
    const isAuthorized =
      (expectedSecret && agentSecret === expectedSecret) ||
      Boolean(invoice && invoice.status === "PENDING") ||
      !expectedSecret;

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid agent secret or unrecognized active x402 invoice" },
        { status: 401 }
      );
    }

    const targetPayee = payee || invoice?.payee;
    const targetAmount = amountTinybar || invoice?.amountTinybar;

    const settlement = await executeHederaSettlement(
      invoiceId,
      targetPayee,
      targetAmount
    );

    return NextResponse.json({
      success: true,
      txId: settlement.txId,
      hashscanUrl: settlement.hashscanUrl,
      invoiceId,
      payee: settlement.payeeAccountId,
      status: "SUCCESS",
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
