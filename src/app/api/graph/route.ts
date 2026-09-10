import { db } from "@/db";
import { cards, links } from "@/db/schema";
import { isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const nodes = await db
    .select({ id: cards.id, title: cards.title, slug: cards.slug, category: cards.category })
    .from(cards)
    .where(isNull(cards.deletedAt));
  const edges = await db.select({ source: links.sourceId, target: links.targetId }).from(links);
  return Response.json({ nodes, edges });
}
