import { pullChanges } from "@/lib/sync";

export const dynamic = "force-dynamic";

/** GET /api/sync/pull?since=2026-01-01T00:00:00Z — changes for a replica. */
export async function GET(req: Request) {
  const since = new URL(req.url).searchParams.get("since") ?? undefined;
  return Response.json(await pullChanges(since));
}
