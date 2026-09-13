import { NextRequest, NextResponse } from "next/server";
import { getAddress, verifyMessage } from "ethers";
import { consumeAuthNonce, createAuthSession } from "@/lib/db/repo";
import { handleRoute, readJson, ApiError } from "@/lib/api/helpers";
import { z } from "zod";

const OPERATOR_ALLOWLIST = new Set(
  (process.env.OPERATOR_ADDRESSES ?? "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean)
);

const schema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  nonce: z.string().uuid(),
  message: z.string().min(10),
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const body = await readJson<unknown>(req);
    const { address, nonce, message, signature } = schema.parse(body);

    let recovered: string;
    try {
      recovered = getAddress(verifyMessage(message, signature));
    } catch {
      throw new ApiError("Invalid signature", 401);
    }

    if (recovered.toLowerCase() !== address.toLowerCase()) {
      throw new ApiError("Signature address mismatch", 401);
    }

    if (!(await consumeAuthNonce(nonce, address))) {
      throw new ApiError("Invalid or expired nonce", 401);
    }

    const role = OPERATOR_ALLOWLIST.has(address.toLowerCase()) ? "operator" : "investor";
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    const sessionId = await createAuthSession({
      address: address.toLowerCase(),
      role,
      expiresAt,
      userAgent: req.headers.get("user-agent") ?? undefined,
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });

    const response = NextResponse.json({ sessionId, role, expiresAt });
    response.cookies.set("prism8_session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60,
      path: "/",
    });

    return response;
  });
}
