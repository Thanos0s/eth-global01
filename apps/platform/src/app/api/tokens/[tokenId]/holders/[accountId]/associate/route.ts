import { NextResponse } from "next/server";
import { ApiError, handleRoute, readJson, requireToken } from "@/lib/api/helpers";
import { insertEvent, updateHolder } from "@/lib/db/repo";
import { isAssociated } from "@/lib/hedera/tokenService";
import { hashscanTxUrl } from "@/lib/hedera/format";
import { txReceiptSchema } from "@/lib/validation";

import { requireInvestor } from "@/lib/auth/middleware";
import { checkRateLimit, getClientIp } from "@/lib/api/rateLimit";

export const dynamic = "force-dynamic";

/** Holder associated the token to their own account client-side (wallet-signed
 *  TokenAssociateTransaction). We independently confirm it against the network before trusting
 *  it rather than taking the client's word for it. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ tokenId: string; accountId: string }> }
) {
  checkRateLimit(getClientIp(req), 30);

  return handleRoute(async () => {
    const { tokenId, accountId } = await params;
    requireInvestor(req, accountId);
    requireToken(tokenId);
    const { txId } = txReceiptSchema.parse(await readJson<unknown>(req));

    const confirmed = await isAssociated(tokenId, accountId);
    if (!confirmed) {
      throw new ApiError(
        "Could not confirm association on the network yet (mirror/consensus lag?). Try again in a few seconds.",
        409
      );
    }

    updateHolder(tokenId, accountId, { associated: true });
    insertEvent({ tokenId, accountId, type: "ASSOCIATE", txId, hashscanUrl: hashscanTxUrl(txId) });

    return NextResponse.json({ associated: true });
  });
}
