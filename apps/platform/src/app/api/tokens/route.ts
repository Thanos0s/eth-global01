import { NextResponse } from "next/server";
import { ApiError, handleRoute, readJson } from "@/lib/api/helpers";
import { insertEvent, insertToken, listTokens } from "@/lib/db/repo";
import { createToken } from "@/lib/hedera/tokenService";
import { getOperatorId } from "@/lib/hedera/client";
import { createTokenSchema } from "@/lib/validation";
import { configuredHederaNetwork } from "@/lib/chains";

import { requireOperator } from "@/lib/auth/middleware";
import { checkRateLimit, getClientIp } from "@/lib/api/rateLimit";
import { auditLog } from "@/lib/audit/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => NextResponse.json({ tokens: listTokens() }));
}

export async function POST(req: Request) {
  checkRateLimit(getClientIp(req), 30);
  const ctx = requireOperator(req);

  return handleRoute(async () => {
    const body = await readJson<unknown>(req);
    const input = createTokenSchema.parse(body);
    if (input.blockchain !== "HEDERA") {
      throw new ApiError("Use /api/evm/tokens to deploy a Sepolia ERC-20 token.", 400);
    }

    const created = await createToken({
      name: input.name,
      symbol: input.symbol,
      tokenType: input.tokenType,
      decimals: input.tokenType === "NFT" ? 0 : input.decimals,
      initialSupply: input.tokenType === "NFT" ? 0 : input.initialSupply,
      supplyType: input.supplyType,
      maxSupply: input.maxSupply,
      memo: input.memo,
      compliance: input.compliance,
      customFee: input.customFee ?? null,
    });

    const token = insertToken({
      id: created.tokenId,
      blockchain: "HEDERA",
      network: configuredHederaNetwork(),
      name: input.name,
      symbol: input.symbol,
      tokenType: input.tokenType,
      decimals: input.tokenType === "NFT" ? 0 : input.decimals,
      initialSupply: input.tokenType === "NFT" ? 0 : input.initialSupply,
      supplyType: input.supplyType,
      maxSupply: input.maxSupply,
      treasuryAccountId: getOperatorId().toString(),
      assetCategory: input.assetCategory,
      memo: input.memo,
      compliance: input.compliance,
      customFee: input.customFee ?? null,
      keys: created.keys,
      createTxId: created.txId,
    });

    insertEvent({
      tokenId: token.id,
      type: "CREATE_TOKEN",
      detail: { name: token.name, symbol: token.symbol, tokenType: token.tokenType },
      txId: created.txId,
      hashscanUrl: created.hashscanUrl,
    });

    // Ensure initial treasury holder exists
    try {
      const { ensureHolder, updateHolder } = await import("@/lib/db/repo");
      ensureHolder(token.id, token.treasuryAccountId, null);
      updateHolder(token.id, token.treasuryAccountId, {
        associated: true,
        kycGranted: true,
        status: "WHITELISTED",
      });
    } catch (holderErr) {
      console.warn("Could not insert initial treasury holder:", holderErr);
    }

    auditLog({
      actor: ctx.address,
      role: ctx.role,
      action: "CREATE_HEDERA_TOKEN",
      resource: `token:${token.id}`,
      status: "OK",
      detail: { name: token.name, symbol: token.symbol },
      ip: getClientIp(req),
    });

    return NextResponse.json({ token }, { status: 201 });
  });
}
