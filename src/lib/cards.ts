import { db } from "@/db";
import { cardRevisions, cards, linkCandidates, links, progressEvents, whiteboardCards, whiteboards } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { extractWikiLinks, normalizeTitle, slugify } from "./wiki";

export type CardInput = {
  title: string;
  summary?: string;
  content?: string;
  category?: string;
  tags?: string[];
  kind?: string;
  aliases?: string[];
};

export type EventType = "created" | "edited" | "reviewed" | "connected";

/** Append to the unbounded activity log (feeds streaks / heatmap). */
export async function logEvent(type: EventType, cardId?: number) {
  await db.insert(progressEvents).values({ type, cardId: cardId ?? null });
}

/** Immutable snapshot used for history & restore. */
async function snapshot(card: typeof cards.$inferSelect) {
  await db.insert(cardRevisions).values({
    cardId: card.id,
    title: card.title,
    summary: card.summary,
    content: card.content,
    category: card.category,
    tags: card.tags,
    kind: card.kind,
    aliases: card.aliases,
  });
}

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

/**
 * Approval-gated sync (PE principle 2): extracted [[links]] never touch the
 * approved `links` table. They accumulate as pending candidates unless the
 * pair is already approved or was rejected/withdrawn before.
 */
export async function syncLinks(cardId: number, content: string) {
  const targets = await resolveLinkTargets(content);
  const wanted = new Set([...targets.values()].filter((id) => id !== cardId));

  // Withdraw pending proposals whose [[reference]] disappeared from the text.
  const stale = await db
    .select()
    .from(linkCandidates)
    .where(and(eq(linkCandidates.sourceId, cardId), eq(linkCandidates.status, "pending")));
  for (const c of stale) {
    if (!wanted.has(c.targetId)) {
      await db.delete(linkCandidates).where(eq(linkCandidates.id, c.id));
    }
  }

  if (!wanted.size) return;
  const [approved, proposed] = await Promise.all([
    db.select({ targetId: links.targetId }).from(links).where(eq(links.sourceId, cardId)),
    db
      .select({ targetId: linkCandidates.targetId })
      .from(linkCandidates)
      .where(eq(linkCandidates.sourceId, cardId)), // any status: never re-propose
  ]);
  const skip = new Set([...approved.map((l) => l.targetId), ...proposed.map((c) => c.targetId)]);
  const fresh = [...wanted].filter((id) => !skip.has(id));
  if (fresh.length) {
    await db
      .insert(linkCandidates)
      .values(fresh.map((targetId) => ({ sourceId: cardId, targetId })))
      .onConflictDoNothing();
  }
}

/** Curated seeds / explicit imports: links are user-authored, so pre-approved. */
export async function approveExtractedLinks(cardId: number, content: string) {
  const targets = await resolveLinkTargets(content);
  const ids = [...new Set([...targets.values()])].filter((id) => id !== cardId);
  if (ids.length) {
    await db
      .insert(links)
      .values(ids.map((targetId) => ({ sourceId: cardId, targetId })))
      .onConflictDoNothing();
  }
}

/** Promote a pending candidate into the approved link graph. */
export async function approveCandidate(candidateId: number) {
  const [c] = await db.select().from(linkCandidates).where(eq(linkCandidates.id, candidateId)).limit(1);
  if (!c || c.status !== "pending") return null;
  await db.insert(links).values({ sourceId: c.sourceId, targetId: c.targetId }).onConflictDoNothing();
  await db.delete(linkCandidates).where(eq(linkCandidates.id, candidateId));
  await logEvent("connected", c.targetId);
  return c;
}

export async function rejectCandidate(candidateId: number) {
  await db
    .update(linkCandidates)
    .set({ status: "rejected" })
    .where(and(eq(linkCandidates.id, candidateId), eq(linkCandidates.status, "pending")));
}

export async function listCandidates(status = "pending") {
  const t = alias(cards, "t");
  return db
    .select({
      id: linkCandidates.id,
      createdAt: linkCandidates.createdAt,
      status: linkCandidates.status,
      sourceId: cards.id,
      sourceTitle: cards.title,
      sourceSlug: cards.slug,
      targetId: t.id,
      targetTitle: t.title,
      targetSlug: t.slug,
    })
    .from(linkCandidates)
    .innerJoin(cards, eq(cards.id, linkCandidates.sourceId))
    .innerJoin(t, eq(t.id, linkCandidates.targetId))
    .where(eq(linkCandidates.status, status))
    .orderBy(desc(linkCandidates.createdAt));
}

export async function listCandidatesForCard(cardId: number, status = "pending") {
  const t = alias(cards, "t");
  return db
    .select({
      id: linkCandidates.id,
      createdAt: linkCandidates.createdAt,
      status: linkCandidates.status,
      sourceId: cards.id,
      sourceTitle: cards.title,
      sourceSlug: cards.slug,
      targetId: t.id,
      targetTitle: t.title,
      targetSlug: t.slug,
    })
    .from(linkCandidates)
    .innerJoin(cards, eq(cards.id, linkCandidates.sourceId))
    .innerJoin(t, eq(t.id, linkCandidates.targetId))
    .where(
      and(
        eq(linkCandidates.status, status),
        or(eq(linkCandidates.sourceId, cardId), eq(linkCandidates.targetId, cardId)),
      ),
    )
    .orderBy(desc(linkCandidates.createdAt));
}

export async function countPendingCandidates() {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(linkCandidates)
    .where(eq(linkCandidates.status, "pending"));
  return n;
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

/** Rebuild the entire link graph (maintenance operation). */
export async function relinkAll() {
  const all = await db.select({ id: cards.id, content: cards.content }).from(cards);
  for (const c of all) await syncLinks(c.id, c.content);
  return all.length;
}

export async function createCard(input: CardInput, opts?: { approveLinks?: boolean; deferReferrers?: boolean }) {
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
      kind: input.kind || "note",
      aliases: (input.aliases ?? []).map((a) => a.trim()).filter(Boolean),
    })
    .returning();
  if (opts?.approveLinks) {
    // Curated content (seed): its [[links]] are user-authored, so approved.
    await approveExtractedLinks(card.id, card.content);
  } else {
    await syncLinks(card.id, card.content);
  }
  // Bulk imports defer the referrer pass to a single sweep at the end —
  // otherwise each creation re-proposes links among already-imported cards.
  if (!opts?.deferReferrers) await relinkReferrers(card.title);
  await snapshot(card);
  await logEvent("created", card.id);
  return card;
}

export async function updateCard(id: number, input: Partial<CardInput> & { isFavorite?: boolean }) {
  const [existing] = await db.select().from(cards).where(eq(cards.id, id)).limit(1);
  if (!existing) return null;

  // Favorite flips do not create history revisions or edit events.
  const definedKeys = Object.keys(input).filter((k) => input[k as keyof typeof input] !== undefined);
  if (input.isFavorite !== undefined && definedKeys.every((k) => k === "isFavorite")) {
    const [card] = await db.update(cards).set({ isFavorite: input.isFavorite }).where(eq(cards.id, id)).returning();
    return card;
  }

  await snapshot(existing); // keep the old state before overwriting
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
      kind: input.kind ?? existing.kind,
      aliases: input.aliases ? input.aliases.map((a) => a.trim()).filter(Boolean) : existing.aliases,
      isFavorite: input.isFavorite ?? existing.isFavorite,
      updatedAt: new Date(),
    })
    .where(eq(cards.id, id))
    .returning();
  await syncLinks(card.id, card.content);
  if (title !== existing.title) await relinkReferrers(title);
  await logEvent("edited", card.id);
  return card;
}

export async function deleteCard(id: number) {
  await db.delete(cards).where(eq(cards.id, id));
}

export async function getCardBySlug(slug: string) {
  const [card] = await db.select().from(cards).where(eq(cards.slug, slug)).limit(1);
  return card ?? null;
}

export async function getRevisions(cardId: number) {
  return db
    .select()
    .from(cardRevisions)
    .where(eq(cardRevisions.cardId, cardId))
    .orderBy(desc(cardRevisions.createdAt));
}

export async function restoreRevision(cardId: number, revisionId: number) {
  const [rev] = await db
    .select()
    .from(cardRevisions)
    .where(and(eq(cardRevisions.id, revisionId), eq(cardRevisions.cardId, cardId)))
    .limit(1);
  if (!rev) return null;
  // updateCard snapshots the current state first, so restore is reversible.
  return updateCard(cardId, {
    title: rev.title,
    summary: rev.summary,
    content: rev.content,
    category: rev.category,
    tags: rev.tags,
    kind: rev.kind,
    aliases: rev.aliases,
  });
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

/**
 * Deterministic search (PE principle 3): pg_trgm similarity + field weights.
 * Title > alias > summary > content, exactly like the old ILIKE ranking but
 * typo- and notation-tolerant. Falls back to plain ILIKE if the pg_trgm
 * extension is unavailable (フォールバック必須).
 */
export async function listCards(
  opts: { q?: string; category?: string; tag?: string; letter?: string; kind?: string; favorite?: boolean } = {},
) {
  const conds = [];
  if (opts.category) conds.push(eq(cards.category, opts.category));
  if (opts.tag) conds.push(sql`${opts.tag} = ANY(${cards.tags})`);
  if (opts.kind) conds.push(eq(cards.kind, opts.kind));
  if (opts.favorite) conds.push(eq(cards.isFavorite, true));
  if (opts.letter) {
    if (opts.letter === "#") conds.push(sql`upper(left(${cards.title},1)) !~ '[A-Z]'`);
    else conds.push(ilike(cards.title, `${opts.letter}%`));
  }

  if (opts.q) {
    const q = opts.q;
    const qLower = q.toLowerCase();
    const p = `%${q}%`;
    const noTrgm = Symbol("no-trgm");
    try {
      const rows = await db
        .select({
          card: cards,
          score: sql<number>`(
            coalesce(similarity(lower(${cards.title}), ${qLower}), 0) * 3.0
            + coalesce((select max(similarity(lower(a), ${qLower})) from unnest(${cards.aliases}) as a), 0) * 2.5
            + coalesce(similarity(lower(${cards.summary}), ${qLower}), 0) * 1.5
            + coalesce(similarity(lower(left(${cards.content}, 2000)), ${qLower}), 0) * 1.0
          ) * (case
            when ${cards.title} ilike ${p} then 2.0
            when exists (select 1 from unnest(${cards.aliases}) as a where a ilike ${p}) then 1.8
            when ${cards.summary} ilike ${p} then 1.4
            else 1.0
          end)`.as("score"),
        })
        .from(cards)
        .where(
          and(
            ...conds,
            or(
              ilike(cards.title, p),
              ilike(cards.summary, p),
              ilike(cards.content, p),
              sql`exists (select 1 from unnest(${cards.aliases}) as a where a ilike ${p})`,
              sql`similarity(lower(${cards.title}), ${qLower}) > 0.18`,
              sql`(select max(similarity(lower(a), ${qLower})) from unnest(${cards.aliases}) as a) > 0.3`,
            ),
          ),
        )
        .orderBy(sql`score desc`, cards.title);
      return rows.map((r) => r.card);
    } catch (e) {
      // pg_trgm missing → ILIKE only (graceful degradation)
      if (e !== noTrgm) {
        console.warn("trigram search unavailable, falling back to ILIKE:", e instanceof Error ? e.message : e);
      }
    }
    conds.push(
      or(ilike(cards.title, p), ilike(cards.summary, p), ilike(cards.content, p), sql`exists (select 1 from unnest(${cards.aliases}) as a where a ilike ${p})`),
    );
  }

  const rows = await db
    .select()
    .from(cards)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(cards.title);
  if (opts.q) {
    const q = normalizeTitle(opts.q);
    const rank = (c: (typeof rows)[number]) =>
      normalizeTitle(c.title).includes(q)
        ? 0
        : c.aliases.some((a) => normalizeTitle(a).includes(q))
          ? 1
          : normalizeTitle(c.summary).includes(q)
            ? 2
            : 3;
    rows.sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
  }
  return rows;
}

export async function getStats() {
  const [{ cardCount }] = await db.select({ cardCount: sql<number>`count(*)::int` }).from(cards);
  const [{ linkCount }] = await db.select({ linkCount: sql<number>`count(*)::int` }).from(links);
  const [{ boardCount }] = await db.select({ boardCount: sql<number>`count(*)::int` }).from(whiteboards);
  const [{ favoriteCount }] = await db
    .select({ favoriteCount: sql<number>`count(*)::int` })
    .from(cards)
    .where(eq(cards.isFavorite, true));
  const categories = await db
    .select({ category: cards.category, count: sql<number>`count(*)::int` })
    .from(cards)
    .groupBy(cards.category)
    .orderBy(desc(sql`count(*)`));
  const tagRows = await db.execute<{ tag: string; count: number }>(
    sql`select t as tag, count(*)::int as count from ${cards}, unnest(${cards.tags}) as t group by t order by count desc, t asc limit 30`,
  );
  const recent = await db.select().from(cards).orderBy(desc(cards.updatedAt)).limit(6);
  const favorites = await db
    .select({ id: cards.id, title: cards.title, slug: cards.slug, summary: cards.summary, category: cards.category })
    .from(cards)
    .where(eq(cards.isFavorite, true))
    .orderBy(cards.title)
    .limit(8);
  const hubs = await db
    .select({ id: cards.id, title: cards.title, slug: cards.slug, category: cards.category, n: sql<number>`count(${links.id})::int` })
    .from(cards)
    .leftJoin(links, eq(links.targetId, cards.id))
    .groupBy(cards.id)
    .orderBy(desc(sql`count(${links.id})`))
    .limit(5);
  return { cardCount, linkCount, boardCount, favoriteCount, categories, tags: tagRows.rows, recent, favorites, hubs };
}
