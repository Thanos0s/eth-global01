import { NextRequest, NextResponse } from "next/server";
import { logHcsAuditEvent } from "@/lib/hedera/hcsAudit";
import { requireOperator } from "@/lib/auth/middleware";
import { checkRateLimit, getClientIp } from "@/lib/api/rateLimit";
import { auditLog } from "@/lib/audit/logger";
import { isDemoMode, DEMO_BANNER } from "@/lib/demo";
import { handleRoute } from "@/lib/api/helpers";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  checkRateLimit(getClientIp(req), 30);

  if (isDemoMode()) {
    return NextResponse.json({
      success: true,
      _demo: true,
      _notice: DEMO_BANNER,
      status: "SIMULATED",
      message: `${DEMO_BANNER}: Rent ingestion simulated locally.`,
    });
  }

  return handleRoute(async () => {
    const ctx = await requireOperator(req);

    const body = await req.json();
    const propertyId = body.propertyId || "prop_456_oak_ave";
    const amount = Number(body.amount || 3800);
    const tenantName = body.tenantName || "Acme Residential Tenant Corp";
    const flowRatePerSec = amount / 2592000;

    const hcsReceipt = await logHcsAuditEvent({
      event: "TENANT_RENT_DEPOSITED",
      propertyId,
      amount: `$${amount} USD`,
      metadata: { tenant: tenantName, monthlyRate: amount, calculatedFlowRate: flowRatePerSec },
    });

    const txId = hcsReceipt.txId || null;
    const hashscanUrl = hcsReceipt.hashscanUrl || null;

    try {
      const { insertEvent } = await import("@/lib/db/repo");
      const targetTokenId =
        propertyId.startsWith("0.") || propertyId.startsWith("0x") ? propertyId : "0.0.4491823";
      insertEvent({
        tokenId: targetTokenId,
        type: "TRANSFER",
        detail: {
          action: "TENANT_RENT_DEPOSITED",
          amount: `$${amount.toLocaleString()} USD`,
          tenant: tenantName,
          flowRatePerSec,
          hcsSequenceNumber: hcsReceipt.sequenceNumber,
        },
        txId,
        hashscanUrl,
      });
    } catch (e) {
      console.warn("[simulate rent] Could not record event in sqlite:", e);
    }

    auditLog({
      actor: ctx.address,
      role: ctx.role,
      action: "DEPOSIT_RENT",
      resource: `property:${propertyId}`,
      status: "OK",
      detail: { amount, tenant: tenantName, flowRatePerSec },
      ip: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      propertyId,
      amountDeposited: amount,
      currency: "USDC (Wrapped fUSDCx)",
      calculatedFlowRate: flowRatePerSec,
      txId,
      hashscanUrl,
      hcsAudit: hcsReceipt,
      depositTimestamp: new Date().toISOString(),
    });
  });
}
