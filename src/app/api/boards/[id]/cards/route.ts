import { db } from "@/db";
import { cards, whiteboardCards, whiteboardEdges, whiteboards } from "@/db/schema";
import { createCard } from "@/lib/cards";
import { and, eq, or } from "drizzle-orm";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

async function touch(boardId: number) {
  await db.update(whiteboards).set({ updatedAt: new Date() }).where(eq(whiteboards.id, boardId));
}

/** Place an existing card (cardId) or create a brand-new card (title) on the board. */
export async function POST(req: Request, { params }: Ctx) {
  const boardId = Number((await params).id);
  const body = await req.json().catch(() => ({}));
  let cardId: number | undefined = typeof body.cardId === "number" ? body.cardId : undefined;
  if (!cardId && typeof body.title === "string" && body.title.trim()) {
    const c = await createCard({ title: body.title, content: body.content ?? "", category: body.category });
    cardId = c.id;
  }
  if (!cardId) return Response.json({ error: "cardId or title required" }, { status: 400 });

  const [placed] = await db
    .insert(whiteboardCards)
    .values({
      whiteboardId: boardId,
      cardId,
      x: Number(body.x ?? 100),
      y: Number(body.y ?? 100),
      color: typeof body.color === "string" ? body.color : "white",
    })
    .onConflictDoNothing()
    .returning();
  await touch(boardId);
  const [card] = await db.select().from(cards).where(eq(cards.id, cardId)).limit(1);
  return Response.json({ placed: placed ?? null, card }, { status: 201 });
}

/** Bulk update positions / colors: { updates: [{ cardId, x, y, color?, width? }] } */
export async function PATCH(req: Request, { params }: Ctx) {
  const boardId = Number((await params).id);
  const body = await req.json().catch(() => ({}));
  const updates: { cardId: number; x?: number; y?: number; color?: string; width?: number }[] = Array.isArray(body.updates)
    ? body.updates
    : [];
  for (const u of updates) {
    await db
      .update(whiteboardCards)
      .set({
        ...(typeof u.x === "number" ? { x: u.x } : {}),
        ...(typeof u.y === "number" ? { y: u.y } : {}),
        ...(typeof u.color === "string" ? { color: u.color } : {}),
        ...(typeof u.width === "number" ? { width: u.width } : {}),
      })
      .where(and(eq(whiteboardCards.whiteboardId, boardId), eq(whiteboardCards.cardId, u.cardId)));
  }
  await touch(boardId);
  return Response.json({ ok: true, count: updates.length });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const boardId = Number((await params).id);
  const { cardId } = await req.json().catch(() => ({}));
  if (typeof cardId !== "number") return Response.json({ error: "cardId required" }, { status: 400 });
  await db.delete(whiteboardCards).where(and(eq(whiteboardCards.whiteboardId, boardId), eq(whiteboardCards.cardId, cardId)));
  await db
    .delete(whiteboardEdges)
    .where(and(eq(whiteboardEdges.whiteboardId, boardId), or(eq(whiteboardEdges.fromCardId, cardId), eq(whiteboardEdges.toCardId, cardId))));
  await touch(boardId);
  return Response.json({ ok: true });
}
