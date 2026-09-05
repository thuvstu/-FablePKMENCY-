import { getRevisions, restoreRevision } from "@/lib/cards";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const id = Number((await params).id);
  return Response.json(await getRevisions(id));
}

/** Restore a revision: POST { revisionId } */
export async function POST(req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const body = await req.json().catch(() => ({}));
  if (typeof body.revisionId !== "number") return Response.json({ error: "revisionId required" }, { status: 400 });
  const card = await restoreRevision(id, body.revisionId);
  if (!card) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(card);
}
