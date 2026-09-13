import { NextResponse } from "next/server";
import { getDatabaseHealth } from "@/lib/db/index";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbHealth = await getDatabaseHealth();
  const checks: Record<string, "ok" | "degraded"> = {
    database: dbHealth.status,
    hederaMirror: "degraded",
    evmRpc: "degraded",
  };

  // 1. Hedera Mirror Node Check
  try {
    const res = await fetch(
      "https://testnet.mirrornode.hedera.com/api/v1/network/nodes?limit=1",
      {
        signal: AbortSignal.timeout(3000),
        cache: "no-store",
      }
    );
    if (res.ok) {
      checks.hederaMirror = "ok";
    }
  } catch {
    checks.hederaMirror = "degraded";
  }

  // 2. EVM RPC Check
  try {
    const rpcUrl = process.env.SEPOLIA_RPC_URL || "https://sepolia.base.org";
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "net_version",
        params: [],
        id: 1,
      }),
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (res.ok) {
      checks.evmRpc = "ok";
    }
  } catch {
    checks.evmRpc = "degraded";
  }

  const allHealthy = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json(
    {
      status: allHealthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
      database: {
        dialect: dbHealth.dialect,
        latencyMs: dbHealth.latencyMs,
        error: dbHealth.error,
      },
      environment: process.env.NODE_ENV ?? "development",
      demoMode: process.env.DEMO_MODE === "true",
    },
    { status: allHealthy ? 200 : 503 }
  );
}
