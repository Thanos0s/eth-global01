import { NextResponse } from "next/server";
import { ApiError, handleRoute, requireToken } from "@/lib/api/helpers";
import { getHolder, insertEvent, updateHolder } from "@/lib/db/repo";
import { cancelScheduledReclaim } from "@/lib/hedera/scheduleService";

import { requireInvestor } from "@/lib/auth/middleware";
import { checkRateLimit, getClientIp } from "@/lib/api/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tokenId: string; accountId: string }> }
) {
  checkRateLimit(getClientIp(req), 20);

  return handleRoute(async () => {
    const { tokenId, accountId } = await params;
    await requireInvestor(req, accountId);
    await requireToken(tokenId);
    const holder = await getHolder(tokenId, accountId);
    if (!holder) throw new ApiError("Holder has not registered for this token.", 404);

    if (holder.activeScheduleId) {
      await cancelScheduledReclaim(holder.activeScheduleId);
      await updateHolder(tokenId, accountId, { activeScheduleId: null, activeScheduleExpiresAt: null });
      await insertEvent({ tokenId, accountId, type: "CANCEL_RECLAIM", detail: { reason: "manually cancelled" } });
    }

    return NextResponse.json({ holder: await getHolder(tokenId, accountId) });
  });
}
