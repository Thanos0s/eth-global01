import { NextResponse } from "next/server";
import { handleRoute, requireToken } from "@/lib/api/helpers";
import { listEvents, listHolders } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ tokenId: string }> }) {
  return handleRoute(async () => {
    const { tokenId } = await params;
    const token = await requireToken(tokenId);
    const holders = await listHolders(tokenId);
    const events = await listEvents(tokenId);
    return NextResponse.json({ token, holders, events });
  });
}
