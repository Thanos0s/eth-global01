import { NextRequest, NextResponse } from "next/server";
import { requireOperator } from "@/lib/auth/middleware";
import { checkRateLimit, getClientIp } from "@/lib/api/rateLimit";
import { auditLog } from "@/lib/audit/logger";

interface StreamRecord {
  propertyId: string;
  token: string;
  receiver: string;
  flowRate: number;
  monthlyRentEquivUsd: number;
  startedAt: number;
  status: string;
  txHash: string;
}

const activeStreamsMap = new Map<string, StreamRecord>();

export async function GET(req: NextRequest) {
  const propertyId = req.nextUrl.searchParams.get("propertyId");
  const streams = Array.from(activeStreamsMap.values()).filter((s) =>
    propertyId ? s.propertyId === propertyId : true
  );

  return NextResponse.json({
    success: true,
    count: streams.length,
    streams,
  });
}

export async function POST(req: NextRequest) {
  checkRateLimit(getClientIp(req), 30);
  const ctx = await requireOperator(req);

  try {
    const body = (await req.json()) as StreamRecord;
    if (!body.propertyId || !body.receiver || !body.flowRate) {
      return NextResponse.json({ error: "Missing required stream parameters" }, { status: 400 });
    }

    const key = `${body.propertyId}:${body.receiver?.toLowerCase()}`;
    activeStreamsMap.set(key, body);

    auditLog({
      actor: ctx.address,
      role: ctx.role,
      action: "CREATE_OR_UPDATE_STREAM",
      resource: `property:${body.propertyId}:receiver:${body.receiver}`,
      status: "OK",
      detail: { flowRate: body.flowRate, monthlyRent: body.monthlyRentEquivUsd },
      ip: getClientIp(req),
    });

    return NextResponse.json({ success: true, stream: body });
  } catch {
    return NextResponse.json({ error: "Invalid stream payload" }, { status: 400 });
  }
}
