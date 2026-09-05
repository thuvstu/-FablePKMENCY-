import { notFound } from "next/navigation";
import { db } from "@/db";
import { cards, whiteboardCards, whiteboardEdges, whiteboards } from "@/db/schema";
import { eq } from "drizzle-orm";
import BoardCanvas from "@/components/BoardCanvas";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ focus?: string }>;
}) {
  const id = Number((await params).id);
  const { focus } = await searchParams;
  if (!Number.isFinite(id)) notFound();
  const [board] = await db.select().from(whiteboards).where(eq(whiteboards.id, id)).limit(1);
  if (!board) notFound();

  const [placed, edges, allTitles] = await Promise.all([
    db
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
      .where(eq(whiteboardCards.whiteboardId, id)),
    db
      .select({ id: whiteboardEdges.id, fromCardId: whiteboardEdges.fromCardId, toCardId: whiteboardEdges.toCardId, label: whiteboardEdges.label })
      .from(whiteboardEdges)
      .where(eq(whiteboardEdges.whiteboardId, id)),
    db.select({ title: cards.title, slug: cards.slug }).from(cards),
  ]);

  return (
    <BoardCanvas
      key={board.id}
      board={{ id: board.id, name: board.name, description: board.description }}
      initialCards={placed}
      initialEdges={edges}
      allTitles={allTitles}
      focusCardId={focus ? Number(focus) : undefined}
    />
  );
}
