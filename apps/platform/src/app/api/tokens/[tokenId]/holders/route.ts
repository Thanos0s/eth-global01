import { NextResponse } from "next/server";
import { ApiError, handleRoute, readJson, requireToken } from "@/lib/api/helpers";
import { ensureHolder, getHolder, updateHolder } from "@/lib/db/repo";
import { registerHolderSchema } from "@/lib/validation";
import { getAddress } from "ethers";
import { requireInvestor } from "@/lib/auth/middleware";

export const dynamic = "force-dynamic";

/** A holder "registers" (connects their wallet and shows up in the admin queue) before doing
 *  anything on-chain. Association/allowance/whitelisting are separate steps after this, each
 *  logging their own on-chain event — registering itself is purely local bookkeeping. */
export async function POST(req: Request, { params }: { params: Promise<{ tokenId: string }> }) {
  return handleRoute(async () => {
    const { tokenId } = await params;
    const token = await requireToken(tokenId);
    const auth = await requireInvestor(req);

    const { accountId, evmAddress } = registerHolderSchema.parse(await readJson<unknown>(req));
    const isEvmAddress = accountId.startsWith("0x");
    if ((token.blockchain === "EVM") !== isEvmAddress) {
      throw new ApiError(
        token.blockchain === "EVM"
          ? "Connect a Sepolia EVM wallet for this token."
          : "Connect a Hedera wallet for this token.",
        400,
      );
    }

    // Investors may only register their own authenticated address. Operators may register any supplied account.
    if (auth.role === "investor") {
      if (token.blockchain === "EVM" && accountId.toLowerCase() !== auth.address.toLowerCase()) {
        throw new ApiError("Cannot act on behalf of another account identifier.", 403);
      }
      if (token.blockchain !== "EVM" && accountId.toLowerCase() !== auth.address.toLowerCase()) {
        throw new ApiError("Cannot act on behalf of another account identifier.", 403);
      }
    }

    const effectiveAccountId = auth.role === "investor" && token.blockchain === "EVM"
      ? getAddress(auth.address)
      : accountId;

    const normalizedAccountId = token.blockchain === "EVM" ? getAddress(effectiveAccountId) : effectiveAccountId;
    await ensureHolder(tokenId, normalizedAccountId, token.blockchain === "EVM" ? normalizedAccountId : evmAddress);
    if (token.blockchain === "EVM") {
      // ERC-20 balances require no HTS-style association transaction.
      await updateHolder(tokenId, normalizedAccountId, { associated: true });
    }

    return NextResponse.json({ holder: await getHolder(tokenId, normalizedAccountId) }, { status: 201 });
  });
}
