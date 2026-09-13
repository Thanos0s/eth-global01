import { NextResponse } from "next/server";
import { ApiError, handleRoute, readJson, requireToken } from "@/lib/api/helpers";
import { insertEvent, setTokenPaused } from "@/lib/db/repo";
import { pauseToken, unpauseToken } from "@/lib/hedera/tokenService";
import { pauseSchema } from "@/lib/validation";
import { pauseEvmToken } from "@/lib/evm/client";

import { requireOperator } from "@/lib/auth/middleware";
import { checkRateLimit, getClientIp } from "@/lib/api/rateLimit";
import { auditLog } from "@/lib/audit/logger";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ tokenId: string }> }) {
  checkRateLimit(getClientIp(req), 20);
  const ctx = requireOperator(req);

  return handleRoute(async () => {
    const { tokenId } = await params;
    const token = requireToken(tokenId);
    if (!token.keys.pause) throw new ApiError("This token was created without a pause key.", 400);

    const { paused } = pauseSchema.parse(await readJson<unknown>(req));
    const result = token.blockchain === "EVM"
      ? await pauseEvmToken(tokenId, paused)
      : paused
        ? await pauseToken(tokenId)
        : await unpauseToken(tokenId);

    setTokenPaused(tokenId, paused);
    insertEvent({
      tokenId,
      type: paused ? "PAUSE" : "UNPAUSE",
      txId: result.txId,
      hashscanUrl: result.hashscanUrl,
    });

    auditLog({
      actor: ctx.address,
      role: ctx.role,
      action: paused ? "PAUSE_TOKEN" : "UNPAUSE_TOKEN",
      resource: `token:${tokenId}`,
      status: "OK",
      detail: { paused, txId: result.txId },
      ip: getClientIp(req),
    });

    return NextResponse.json({ paused, ...result });
  });
}
