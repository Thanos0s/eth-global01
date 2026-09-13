import { NextRequest, NextResponse } from "next/server";
import { insertEvent } from "@/lib/db/repo";
import { logHcsAuditEvent } from "@/lib/hedera/hcsAudit";
import { requireInvestor } from "@/lib/auth/middleware";
import { checkRateLimit, getClientIp } from "@/lib/api/rateLimit";
import { auditLog } from "@/lib/audit/logger";
import { isDemoMode, DEMO_BANNER } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  checkRateLimit(getClientIp(req), 60);

  // If in demo mode, return visibly isolated simulation response without real execution
  if (isDemoMode()) {
    return NextResponse.json({
      success: true,
      _demo: true,
      _notice: DEMO_BANNER,
      status: "SIMULATED",
      txId: null,
      message: `${DEMO_BANNER}: Yield claim simulated locally.`,
    });
  }

  // Production: Authenticate investor; recipient is strictly derived from session context
  const ctx = await requireInvestor(req);
  const accountId = ctx.address;

  try {
    const body = await req.json();
    const {
      propertyId = "0.0.4491823",
      amount = 14.8251,
    } = body;

    const claimAmount = Math.max(0.01, Number(amount));

    // Anchor verifiable payout receipt on Hedera Consensus Service
    const hcsReceipt = await logHcsAuditEvent({
      event: "RENTAL_YIELD_CLAIMED",
      propertyId,
      amount: `$${claimAmount.toFixed(4)} USD`,
      payer: accountId,
      metadata: {
        receiver: accountId,
        currency: "fUSDCx (Base Sepolia)",
        settlementEngine: "Superfluid CFA Constant Flow Agreement",
        claimedAt: new Date().toISOString(),
      },
    });

    const txId = hcsReceipt.txId || null;
    const hashscanUrl = hcsReceipt.hashscanUrl || null;

    // Persist immutable transfer event to database
    try {
      insertEvent({
        tokenId: propertyId.startsWith("0.") || propertyId.startsWith("0x") ? propertyId : "0.0.4491823",
        accountId,
        type: "TRANSFER",
        detail: {
          action: "RENTAL_YIELD_CLAIMED",
          amount: `$${claimAmount.toFixed(4)} USD`,
          receiver: accountId,
          currency: "fUSDCx",
          settlementRail: "Base Sepolia Superfluid CFA",
          hcsSequenceNumber: hcsReceipt.sequenceNumber,
        },
        txId,
        hashscanUrl,
      });
    } catch (dbErr) {
      console.warn("[claim route] Could not insert event into sqlite:", dbErr);
    }

    auditLog({
      actor: accountId,
      role: ctx.role,
      action: "CLAIM_YIELD",
      resource: `property:${propertyId}`,
      status: "OK",
      detail: { amount: claimAmount, currency: "fUSDCx" },
      ip: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      propertyId,
      recipient: accountId,
      amountClaimed: claimAmount,
      currency: "fUSDCx",
      txId,
      hashscanUrl,
      hcsAudit: hcsReceipt,
      claimedAt: new Date().toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
