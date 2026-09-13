import { NextRequest, NextResponse } from "next/server";
import { createAuthNonce } from "@/lib/db/repo";
import { handleRoute, readJson } from "@/lib/api/helpers";
import { z } from "zod";

const schema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const body = await readJson<unknown>(req);
    const { address } = schema.parse(body);
    const nonce = createAuthNonce(address);
    const message = `Prism 8 Authentication\n\nAddress: ${address}\nNonce: ${nonce}\nTimestamp: ${new Date().toISOString()}\n\nSigning this message does not trigger a blockchain transaction or cost any gas.`;
    return NextResponse.json({ nonce, message });
  });
}
