import { NextResponse } from "next/server";
import { ApiError, handleRoute, requireToken } from "@/lib/api/helpers";
import { getHolder, insertEvent, updateHolder } from "@/lib/db/repo";
import { grantKyc, unfreezeAccount } from "@/lib/hedera/tokenService";
import { setEvmApproved, setEvmFrozen } from "@/lib/evm/client";
import { hasRequiredWorldIdVerification } from "@/lib/worldid/policy";

import { requireOperator } from "@/lib/auth/middleware";
import { checkRateLimit, getClientIp } from "@/lib/api/rateLimit";
import { auditLog } from "@/lib/audit/logger";

export const dynamic = "force-dynamic";

/** Admin approval step: grants KYC and/or unfreezes the account, whichever compliance
 *  mechanisms this token was created with, and marks the holder WHITELISTED. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ tokenId: string; accountId: string }> }
) {
  checkRateLimit(getClientIp(req), 30);
  const ctx = requireOperator(req);

  return handleRoute(async () => {
    const { tokenId, accountId } = await params;
    const token = requireToken(tokenId);
    const holder = getHolder(tokenId, accountId);
    if (!holder) throw new ApiError("Holder has not registered for this token yet.", 404);
    if (!holder.associated) throw new ApiError("Holder must associate the token to their account first.", 409);
    if (!hasRequiredWorldIdVerification(token, holder)) {
      throw new ApiError("This token requires World ID verification before whitelisting.", 409);
    }

    if (token.blockchain === "EVM") {
      const result = await setEvmApproved(tokenId, accountId, true);
      updateHolder(tokenId, accountId, {
        kycGranted: token.compliance.kycRequired,
        frozen: false,
      });
      insertEvent({
        tokenId,
        accountId,
        type: "GRANT_KYC",
        detail: { mechanism: "EVM allowlist" },
        txId: result.txId,
        hashscanUrl: result.explorerUrl,
      });
      if (holder.frozen) {
        const unfreeze = await setEvmFrozen(tokenId, accountId, false);
        insertEvent({ tokenId, accountId, type: "UNFREEZE", txId: unfreeze.txId, hashscanUrl: unfreeze.explorerUrl });
      }
    } else if (token.compliance.kycRequired) {
      const result = await grantKyc(tokenId, accountId);
      updateHolder(tokenId, accountId, { kycGranted: true });
      insertEvent({ tokenId, accountId, type: "GRANT_KYC", txId: result.txId, hashscanUrl: result.hashscanUrl });
    }
    if (token.blockchain === "HEDERA" && token.compliance.freezeDefault) {
      const result = await unfreezeAccount(tokenId, accountId);
      updateHolder(tokenId, accountId, { frozen: false });
      insertEvent({ tokenId, accountId, type: "UNFREEZE", txId: result.txId, hashscanUrl: result.hashscanUrl });
    }

    updateHolder(tokenId, accountId, { status: "WHITELISTED" });
    return NextResponse.json({ holder: getHolder(tokenId, accountId) });
  });
}
