import { db } from "@/db";
import { whiteboardEdges, whiteboards } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const boardId = Number((await params).id);
  const body = await req.json().catch(() => ({}));
  if (typeof body.fromCardId !== "number" || typeof body.toCardId !== "number" || body.fromCardId === body.toCardId) {
    return Response.json({ error: "fromCardId and toCardId required" }, { status: 400 });
  }
  const [edge] = await db
    .insert(whiteboardEdges)
    .values({ whiteboardId: boardId, fromCardId: body.fromCardId, toCardId: body.toCardId, label: body.label ?? "" })
    .returning();
  await db.update(whiteboards).set({ updatedAt: new Date() }).where(eq(whiteboards.id, boardId));
  return Response.json(edge, { status: 201 });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const boardId = Number((await params).id);
  const body = await req.json().catch(() => ({}));
  if (typeof body.id !== "number") return Response.json({ error: "id required" }, { status: 400 });
  const [edge] = await db
    .update(whiteboardEdges)
    .set({ label: String(body.label ?? "") })
    .where(and(eq(whiteboardEdges.id, body.id), eq(whiteboardEdges.whiteboardId, boardId)))
    .returning();
  return Response.json(edge ?? null);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const boardId = Number((await params).id);
  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== "number") return Response.json({ error: "id required" }, { status: 400 });
  await db.delete(whiteboardEdges).where(and(eq(whiteboardEdges.id, id), eq(whiteboardEdges.whiteboardId, boardId)));
  return Response.json({ ok: true });
}
