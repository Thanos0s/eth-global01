import { NextResponse } from "next/server";
import { handleRoute, readJson } from "@/lib/api/helpers";
import { insertEvent, insertToken, listTokens } from "@/lib/db/repo";
import { createEvmTokenSchema } from "@/lib/validation";
import { deployEvmToken, getEvmOperatorAddress } from "@/lib/evm/client";

import { requireOperator } from "@/lib/auth/middleware";
import { checkRateLimit, getClientIp } from "@/lib/api/rateLimit";
import { auditLog } from "@/lib/audit/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    const tokens = await listTokens();
    return NextResponse.json({ tokens: tokens.filter((token) => token.blockchain === "EVM") });
  });
}

export async function POST(req: Request) {
  checkRateLimit(getClientIp(req), 30);
  const ctx = await requireOperator(req);

  return handleRoute(async () => {
    const body = await readJson<Record<string, unknown>>(req);
    const input = createEvmTokenSchema.parse({ ...body, blockchain: "EVM" });
    const compliance = input.compliance.worldIdRequired
      ? { ...input.compliance, kycRequired: true }
      : input.compliance;

    let tokenId: string;
    let txId: string;
    let explorerUrl: string;
    let keys: any;
    const treasuryAccountId = input.treasuryAccountId || getEvmOperatorAddress();

    if (input.existingTokenId && input.createTxId) {
      tokenId = input.existingTokenId;
      txId = input.createTxId;
      explorerUrl = `https://sepolia.etherscan.io/tx/${txId}`;
      keys = {
        admin: true,
        kyc: !!(compliance.kycRequired || compliance.worldIdRequired),
        freeze: !!compliance.freezeDefault,
        wipe: !!compliance.wipeEnabled,
        pause: !!compliance.pauseEnabled,
        supply: true,
        feeSchedule: false,
      };
    } else {
      const created = await deployEvmToken({
        name: input.name,
        symbol: input.symbol,
        decimals: input.decimals,
        initialSupply: input.initialSupply,
        supplyType: input.supplyType,
        maxSupply: input.maxSupply,
        compliance,
      });
      tokenId = created.tokenId;
      txId = created.txId;
      explorerUrl = created.explorerUrl;
      keys = created.keys;
    }

    const token = await insertToken({
      id: tokenId,
      blockchain: "EVM",
      network: "sepolia",
      name: input.name,
      symbol: input.symbol,
      tokenType: "FUNGIBLE",
      decimals: input.decimals,
      initialSupply: input.initialSupply,
      supplyType: input.supplyType,
      maxSupply: input.maxSupply,
      treasuryAccountId,
      assetCategory: input.assetCategory,
      memo: input.memo,
      compliance,
      customFee: null,
      keys,
      createTxId: txId,
    });

    await insertEvent({
      tokenId: token.id,
      type: "CREATE_TOKEN",
      detail: {
        name: token.name,
        symbol: token.symbol,
        tokenType: token.tokenType,
        blockchain: "EVM",
        network: "sepolia",
      },
      txId,
      hashscanUrl: explorerUrl,
    });

    // Ensure initial treasury holder exists
    try {
      const { ensureHolder, updateHolder } = await import("@/lib/db/repo");
      await ensureHolder(token.id, treasuryAccountId, treasuryAccountId);
      await updateHolder(token.id, treasuryAccountId, {
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
      action: "CREATE_EVM_TOKEN",
      resource: `token:${token.id}`,
      status: "OK",
      detail: { name: token.name, symbol: token.symbol },
      ip: getClientIp(req),
    });

    return NextResponse.json({ token }, { status: 201 });
  });
}
