import { fromPersonalEncyclopedia, pushChanges, type SyncPayload } from "@/lib/sync";

export const dynamic = "force-dynamic";

/**
 * POST /api/sync/push
 * Accepts the neutral `codex-sync/1` payload, or a PersonalEncyclopedia
 * entries export (auto-detected and adapted).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }
  const adapted = fromPersonalEncyclopedia(body);
  const payload: SyncPayload = adapted ?? (body as SyncPayload);
  const result = await pushChanges(payload);
  return Response.json({ ...result, source: adapted ? "personal-encyclopedia" : "codex-sync/1" });
}
