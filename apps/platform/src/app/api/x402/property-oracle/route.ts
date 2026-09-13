import { NextRequest, NextResponse } from "next/server";
import { handlePropertyOracleRequest, PropertyAddressInput } from "@/lib/x402/oracleService";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PropertyAddressInput;

    const paymentTx =
      req.headers.get("x-payment-tx") ||
      req.headers.get("x-payment") ||
      req.headers.get("authorization")?.replace(/^x402\s+/i, "");
    const invoiceId = req.headers.get("x-payment-invoice") || undefined;

    const proof = paymentTx ? { paymentTx, invoiceId } : undefined;
    const result = await handlePropertyOracleRequest(body, proof);

    if (result.status === 402) {
      const headers: Record<string, string> = {};
      if (result.x402) {
        headers["WWW-Authenticate"] = `x402 realm="Prism8-Property-Oracle", network="${result.x402.network}", token="${result.x402.token}", amount="${result.x402.amount}", invoice="${result.x402.invoiceId}"`;
        headers["X-402-Version"] = result.x402.version;
        headers["X-402-Facilitator"] = result.x402.facilitator;
        headers["X-402-Network"] = result.x402.network;
        headers["X-402-Payee"] = result.x402.payee;
        headers["X-402-Amount"] = result.x402.amount;
        headers["X-402-Invoice"] = result.x402.invoiceId;
        headers["X-402-Tier"] = result.x402.pricingTier;
        headers["X-402-Expires"] = String(result.x402.expiresAt);
      }
      return NextResponse.json(result, { status: 402, headers });
    }

    if (result.status !== 200) {
      return NextResponse.json(result, { status: result.status });
    }

    const cleanData = JSON.parse(JSON.stringify(result.data));
    return NextResponse.json(cleanData, { status: 200 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ status: 500, error: msg }, { status: 500 });
  }
}
