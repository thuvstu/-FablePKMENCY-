import { db } from "@/db";
import { cards, whiteboardCards, whiteboardEdges, whiteboards } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const [board] = await db.select().from(whiteboards).where(eq(whiteboards.id, id)).limit(1);
  if (!board) return Response.json({ error: "Not found" }, { status: 404 });
  const placed = await db
    .select({
      id: whiteboardCards.id,
      cardId: whiteboardCards.cardId,
      x: whiteboardCards.x,
      y: whiteboardCards.y,
      width: whiteboardCards.width,
      color: whiteboardCards.color,
      title: cards.title,
      slug: cards.slug,
      summary: cards.summary,
      content: cards.content,
      category: cards.category,
      tags: cards.tags,
    })
    .from(whiteboardCards)
    .innerJoin(cards, eq(cards.id, whiteboardCards.cardId))
    .where(eq(whiteboardCards.whiteboardId, id));
  const edges = await db.select().from(whiteboardEdges).where(eq(whiteboardEdges.whiteboardId, id));
  return Response.json({ board, cards: placed, edges });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const body = await req.json().catch(() => ({}));
  const [board] = await db
    .update(whiteboards)
    .set({
      ...(typeof body.name === "string" && body.name.trim() ? { name: body.name.trim() } : {}),
      ...(typeof body.description === "string" ? { description: body.description } : {}),
      updatedAt: new Date(),
    })
    .where(eq(whiteboards.id, id))
    .returning();
  if (!board) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(board);
}

export async function DELETE(_: Request, { params }: Ctx) {
  const id = Number((await params).id);
  await db.delete(whiteboards).where(eq(whiteboards.id, id));
  return Response.json({ ok: true });
}
