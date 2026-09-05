import { db } from "@/db";
import { cards, links, whiteboardCards, whiteboards } from "@/db/schema";
import { and, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { extractWikiLinks, normalizeTitle, slugify } from "./wiki";

export type CardInput = {
  title: string;
  summary?: string;
  content?: string;
  category?: string;
  tags?: string[];
};

async function uniqueSlug(title: string, excludeId?: number) {
  const base = slugify(title);
  let slug = base;
  let n = 2;
  for (;;) {
    const existing = await db
      .select({ id: cards.id })
      .from(cards)
      .where(eq(cards.slug, slug))
      .limit(1);
    if (existing.length === 0 || existing[0].id === excludeId) return slug;
    slug = `${base}-${n++}`;
  }
}

/** Resolve [[Title]] references to card ids (case-insensitive by title or slug). */
export async function resolveLinkTargets(content: string): Promise<Map<string, number>> {
  const titles = extractWikiLinks(content);
  const map = new Map<string, number>();
  if (titles.length === 0) return map;
  const lowered = titles.map(normalizeTitle);
  const slugs = titles.map(slugify);
  const rows = await db
    .select({ id: cards.id, title: cards.title, slug: cards.slug })
    .from(cards)
    .where(or(inArray(sql`lower(${cards.title})`, lowered), inArray(cards.slug, slugs)));
  for (const t of titles) {
    const hit =
      rows.find((r) => normalizeTitle(r.title) === normalizeTitle(t)) ??
      rows.find((r) => r.slug === slugify(t));
    if (hit) map.set(t, hit.id);
  }
  return map;
}

export async function syncLinks(cardId: number, content: string) {
  const targets = await resolveLinkTargets(content);
  await db.delete(links).where(eq(links.sourceId, cardId));
  const ids = [...new Set([...targets.values()])].filter((id) => id !== cardId);
  if (ids.length) {
    await db
      .insert(links)
      .values(ids.map((targetId) => ({ sourceId: cardId, targetId })))
      .onConflictDoNothing();
  }
}

/** After a card is created/renamed, other cards that referenced its title now resolve. */
export async function relinkReferrers(title: string) {
  const pattern = `%[[${title}%`;
  const referrers = await db
    .select({ id: cards.id, content: cards.content })
    .from(cards)
    .where(ilike(cards.content, pattern));
  for (const r of referrers) await syncLinks(r.id, r.content);
}

export async function createCard(input: CardInput) {
  const title = input.title.trim();
  const slug = await uniqueSlug(title);
  const [card] = await db
    .insert(cards)
    .values({
      title,
      slug,
      summary: input.summary?.trim() ?? "",
      content: input.content ?? "",
      category: input.category?.trim() || "General",
      tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
    })
    .returning();
  await syncLinks(card.id, card.content);
  await relinkReferrers(card.title);
  return card;
}

export async function updateCard(id: number, input: Partial<CardInput>) {
  const [existing] = await db.select().from(cards).where(eq(cards.id, id)).limit(1);
  if (!existing) return null;
  const title = input.title?.trim() || existing.title;
  const slug = title !== existing.title ? await uniqueSlug(title, id) : existing.slug;
  const [card] = await db
    .update(cards)
    .set({
      title,
      slug,
      summary: input.summary?.trim() ?? existing.summary,
      content: input.content ?? existing.content,
      category: input.category?.trim() || existing.category,
      tags: input.tags ? input.tags.map((t) => t.trim()).filter(Boolean) : existing.tags,
      updatedAt: new Date(),
    })
    .where(eq(cards.id, id))
    .returning();
  await syncLinks(card.id, card.content);
  if (title !== existing.title) await relinkReferrers(title);
  return card;
}

export async function deleteCard(id: number) {
  await db.delete(cards).where(eq(cards.id, id));
}

export async function getCardBySlug(slug: string) {
  const [card] = await db.select().from(cards).where(eq(cards.slug, slug)).limit(1);
  return card ?? null;
}

export async function getCardContext(cardId: number, category: string, tags: string[]) {
  const outgoing = await db
    .select({ id: cards.id, title: cards.title, slug: cards.slug, summary: cards.summary, category: cards.category })
    .from(links)
    .innerJoin(cards, eq(cards.id, links.targetId))
    .where(eq(links.sourceId, cardId));
  const backlinks = await db
    .select({ id: cards.id, title: cards.title, slug: cards.slug, summary: cards.summary, category: cards.category })
    .from(links)
    .innerJoin(cards, eq(cards.id, links.sourceId))
    .where(eq(links.targetId, cardId));
  const relatedRaw = await db
    .select({ id: cards.id, title: cards.title, slug: cards.slug, summary: cards.summary, category: cards.category, tags: cards.tags })
    .from(cards)
    .where(
      and(
        ne(cards.id, cardId),
        tags.length
          ? or(eq(cards.category, category), sql`${cards.tags} && ${sql.raw(`ARRAY[${tags.map((t) => `'${t.replace(/'/g, "''")}'`).join(",")}]::text[]`)}`)
          : eq(cards.category, category),
      ),
    )
    .limit(40);
  const linkedIds = new Set([...outgoing, ...backlinks].map((c) => c.id));
  const related = relatedRaw
    .filter((c) => !linkedIds.has(c.id))
    .map((c) => ({ ...c, score: (c.category === category ? 1 : 0) + c.tags.filter((t) => tags.includes(t)).length * 2 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  const boards = await db
    .select({ id: whiteboards.id, name: whiteboards.name })
    .from(whiteboardCards)
    .innerJoin(whiteboards, eq(whiteboards.id, whiteboardCards.whiteboardId))
    .where(eq(whiteboardCards.cardId, cardId));
  return { outgoing, backlinks, related, boards };
}

export async function listCards(opts: { q?: string; category?: string; tag?: string; letter?: string } = {}) {
  const conds = [];
  if (opts.q) {
    const p = `%${opts.q}%`;
    conds.push(or(ilike(cards.title, p), ilike(cards.summary, p), ilike(cards.content, p)));
  }
  if (opts.category) conds.push(eq(cards.category, opts.category));
  if (opts.tag) conds.push(sql`${opts.tag} = ANY(${cards.tags})`);
  if (opts.letter) {
    if (opts.letter === "#") conds.push(sql`upper(left(${cards.title},1)) !~ '[A-Z]'`);
    else conds.push(ilike(cards.title, `${opts.letter}%`));
  }
  return db
    .select()
    .from(cards)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(cards.title);
}

export async function getStats() {
  const [{ cardCount }] = await db.select({ cardCount: sql<number>`count(*)::int` }).from(cards);
  const [{ linkCount }] = await db.select({ linkCount: sql<number>`count(*)::int` }).from(links);
  const [{ boardCount }] = await db.select({ boardCount: sql<number>`count(*)::int` }).from(whiteboards);
  const categories = await db
    .select({ category: cards.category, count: sql<number>`count(*)::int` })
    .from(cards)
    .groupBy(cards.category)
    .orderBy(desc(sql`count(*)`));
  const tagRows = await db.execute<{ tag: string; count: number }>(
    sql`select t as tag, count(*)::int as count from ${cards}, unnest(${cards.tags}) as t group by t order by count desc, t asc limit 30`,
  );
  const recent = await db.select().from(cards).orderBy(desc(cards.updatedAt)).limit(6);
  const hubs = await db
    .select({ id: cards.id, title: cards.title, slug: cards.slug, category: cards.category, n: sql<number>`count(${links.id})::int` })
    .from(cards)
    .leftJoin(links, eq(links.targetId, cards.id))
    .groupBy(cards.id)
    .orderBy(desc(sql`count(${links.id})`))
    .limit(5);
  return { cardCount, linkCount, boardCount, categories, tags: tagRows.rows, recent, hubs };
}
