import { db } from "@/db";
import { cards, links, progressEvents, reviews, whiteboardCards, whiteboardEdges, whiteboards } from "@/db/schema";
import { and, eq, gt, or, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { relinkReferrers, syncLinks } from "./cards";
import { CONTRACT_VERSION } from "./schema-contract";
import { slugify } from "./wiki";

/**
 * ============================================================================
 * PE ⇄ Codex replication
 * ============================================================================
 * · Identity  : `uid` (never the autoincrement id) — 原則1
 * · Conflicts : Last-Write-Wins on `updated_at`, ties keep the local row.
 * · Deletes   : tombstones (`deleted_at`) so removals propagate — 原則4
 * · Links     : incoming links are *proposals* unless flagged approved — 原則2
 * · History   : reviews / progress_events are append-only, merged by natural key
 * The wire format is dialect-neutral JSON (ISO-8601 UTC), so a Room/SQLite
 * client can produce it without any PostgreSQL knowledge.
 */

export type SyncCard = {
  uid: string;
  slug?: string;
  title: string;
  summary?: string;
  content?: string;
  category?: string;
  tags?: string[];
  kind?: string;
  aliases?: string[];
  isFavorite?: boolean;
  createdAt?: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type SyncLink = { source: string; target: string; approved?: boolean };
export type SyncReview = { cardUid: string; grade: number; intervalDays: number; easeFactor: number; repetition: number; reviewedAt: string };
export type SyncEvent = { type: string; cardUid?: string | null; createdAt: string };
export type SyncBoard = {
  uid: string;
  name: string;
  description?: string;
  updatedAt: string;
  deletedAt?: string | null;
  cards?: { cardUid: string; x: number; y: number; width?: number; color?: string }[];
  edges?: { from: string; to: string; label?: string }[];
};

export type SyncPayload = {
  protocol?: string;
  contractVersion?: number;
  cards?: SyncCard[];
  links?: SyncLink[];
  reviews?: SyncReview[];
  events?: SyncEvent[];
  boards?: SyncBoard[];
};

export type PushResult = {
  applied: { cards: number; links: number; candidates: number; reviews: number; events: number; boards: number };
  skipped: { cardsOlder: number; unknownRefs: number };
  serverTime: string;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/**
 * Timestamps make a lossy round trip (PostgreSQL keeps microseconds, JSON/JS
 * only milliseconds), so append-only dedup matches inside a small window
 * instead of demanding exact equality.
 */
const DEDUP_TOLERANCE_MS = 2;
function withinMs(column: PgColumn, at: Date) {
  const lo = new Date(at.getTime() - DEDUP_TOLERANCE_MS);
  const hi = new Date(at.getTime() + DEDUP_TOLERANCE_MS);
  return sql`${column} >= ${lo} and ${column} <= ${hi}`;
}

// ---------------------------------------------------------------------------
// PULL — everything changed since `since` (ISO-8601). Tombstones included.
// ---------------------------------------------------------------------------
export async function pullChanges(since?: string): Promise<SyncPayload & { serverTime: string }> {
  const sinceDate = since ? new Date(since) : null;
  const validSince = sinceDate && !Number.isNaN(sinceDate.getTime()) ? sinceDate : null;

  const cardRows = validSince
    ? await db.select().from(cards).where(gt(cards.updatedAt, validSince))
    : await db.select().from(cards);
  const uidById = new Map((await db.select({ id: cards.id, uid: cards.uid }).from(cards)).map((c) => [c.id, c.uid]));

  const linkRows = await db.select().from(links);
  const reviewRows = validSince
    ? await db.select().from(reviews).where(gt(reviews.reviewedAt, validSince))
    : await db.select().from(reviews);
  const eventRows = validSince
    ? await db.select().from(progressEvents).where(gt(progressEvents.createdAt, validSince))
    : await db.select().from(progressEvents);
  const boardRows = validSince
    ? await db.select().from(whiteboards).where(gt(whiteboards.updatedAt, validSince))
    : await db.select().from(whiteboards);
  const placements = await db.select().from(whiteboardCards);
  const bEdges = await db.select().from(whiteboardEdges);

  return {
    protocol: "codex-sync/1",
    contractVersion: CONTRACT_VERSION,
    serverTime: new Date().toISOString(),
    cards: cardRows.map((c) => ({
      uid: c.uid,
      slug: c.slug,
      title: c.title,
      summary: c.summary,
      content: c.content,
      category: c.category,
      tags: c.tags,
      kind: c.kind,
      aliases: c.aliases,
      isFavorite: c.isFavorite,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      deletedAt: iso(c.deletedAt),
    })),
    links: linkRows
      .map((l) => ({ source: uidById.get(l.sourceId) ?? "", target: uidById.get(l.targetId) ?? "", approved: true }))
      .filter((l) => l.source && l.target),
    reviews: reviewRows
      .map((r) => ({
        cardUid: uidById.get(r.cardId) ?? "",
        grade: r.grade,
        intervalDays: r.intervalDays,
        easeFactor: r.easeFactor,
        repetition: r.repetition,
        reviewedAt: r.reviewedAt.toISOString(),
      }))
      .filter((r) => r.cardUid),
    // `progress_events.card_id` is a logical FK (PE pattern): it can point at a
    // purged card. Such orphans cannot round trip their reference, so they are
    // not replicated — otherwise every sync would re-insert a card-less copy.
    events: eventRows
      .filter((e) => e.cardId === null || uidById.has(e.cardId))
      .map((e) => ({
        type: e.type,
        cardUid: e.cardId ? (uidById.get(e.cardId) ?? null) : null,
        createdAt: e.createdAt.toISOString(),
      })),
    boards: boardRows.map((b) => ({
      uid: b.uid,
      name: b.name,
      description: b.description,
      updatedAt: b.updatedAt.toISOString(),
      deletedAt: iso(b.deletedAt),
      cards: placements
        .filter((p) => p.whiteboardId === b.id)
        .map((p) => ({ cardUid: uidById.get(p.cardId) ?? "", x: p.x, y: p.y, width: p.width, color: p.color }))
        .filter((p) => p.cardUid),
      edges: bEdges
        .filter((e) => e.whiteboardId === b.id)
        .map((e) => ({ from: uidById.get(e.fromCardId) ?? "", to: uidById.get(e.toCardId) ?? "", label: e.label }))
        .filter((e) => e.from && e.to),
    })),
  };
}

// ---------------------------------------------------------------------------
// PUSH — merge a remote replica's changes (idempotent, LWW).
// ---------------------------------------------------------------------------
async function freeSlug(desired: string, uid: string): Promise<string> {
  const base = slugify(desired);
  let slug = base;
  let n = 2;
  for (;;) {
    const hit = await db.select({ uid: cards.uid }).from(cards).where(eq(cards.slug, slug)).limit(1);
    if (!hit.length || hit[0].uid === uid) return slug;
    slug = `${base}-${n++}`;
  }
}

export async function pushChanges(payload: SyncPayload): Promise<PushResult> {
  const result: PushResult = {
    applied: { cards: 0, links: 0, candidates: 0, reviews: 0, events: 0, boards: 0 },
    skipped: { cardsOlder: 0, unknownRefs: 0 },
    serverTime: new Date().toISOString(),
  };

  // ---- cards (LWW on updatedAt) ----
  for (const c of payload.cards ?? []) {
    if (!c?.uid || typeof c.title !== "string") continue;
    const remoteUpdated = new Date(c.updatedAt ?? Date.now());
    if (Number.isNaN(remoteUpdated.getTime())) continue;
    const [local] = await db.select().from(cards).where(eq(cards.uid, c.uid)).limit(1);

    if (local && local.updatedAt >= remoteUpdated) {
      result.skipped.cardsOlder++;
      continue;
    }

    const values = {
      title: c.title.trim(),
      summary: c.summary ?? "",
      content: c.content ?? "",
      category: c.category?.trim() || "General",
      tags: Array.isArray(c.tags) ? c.tags : [],
      kind: c.kind || "note",
      aliases: Array.isArray(c.aliases) ? c.aliases : [],
      isFavorite: Boolean(c.isFavorite),
      updatedAt: remoteUpdated,
      deletedAt: c.deletedAt ? new Date(c.deletedAt) : null,
    };

    if (local) {
      const slug = c.deletedAt ? local.slug : await freeSlug(c.slug || c.title, c.uid);
      await db.update(cards).set({ ...values, slug }).where(eq(cards.id, local.id));
      if (values.deletedAt) {
        // deletion propagates: drop derived rows just like a local delete
        await db.delete(links).where(or(eq(links.sourceId, local.id), eq(links.targetId, local.id)));
        await db.delete(whiteboardCards).where(eq(whiteboardCards.cardId, local.id));
      } else {
        await syncLinks(local.id, values.content); // proposals, not direct edges (原則2)
      }
    } else {
      if (values.deletedAt) {
        // tombstone for a card we never had: record it so we don't resurrect it
        await db.insert(cards).values({
          uid: c.uid,
          slug: `${slugify(c.title)}--deleted-${c.uid.slice(0, 8)}`,
          ...values,
          createdAt: c.createdAt ? new Date(c.createdAt) : remoteUpdated,
        });
        result.applied.cards++;
        continue;
      }
      const slug = await freeSlug(c.slug || c.title, c.uid);
      const [created] = await db
        .insert(cards)
        .values({ uid: c.uid, slug, ...values, createdAt: c.createdAt ? new Date(c.createdAt) : remoteUpdated })
        .returning();
      await syncLinks(created.id, values.content);
      await relinkReferrers(created.title);
    }
    result.applied.cards++;
  }

  const idByUid = new Map((await db.select({ id: cards.id, uid: cards.uid }).from(cards)).map((c) => [c.uid, c.id]));

  // ---- links: approved ones are edges, everything else stays a proposal ----
  for (const l of payload.links ?? []) {
    const s = idByUid.get(l.source ?? "");
    const t = idByUid.get(l.target ?? "");
    if (!s || !t || s === t) {
      result.skipped.unknownRefs++;
      continue;
    }
    if (l.approved) {
      await db.insert(links).values({ sourceId: s, targetId: t }).onConflictDoNothing();
      result.applied.links++;
    } else {
      const [dup] = await db
        .select({ id: sql<number>`1` })
        .from(links)
        .where(and(eq(links.sourceId, s), eq(links.targetId, t)))
        .limit(1);
      if (!dup) {
        await db.execute(sql`insert into link_candidates (source_id, target_id) values (${s}, ${t}) on conflict do nothing`);
        result.applied.candidates++;
      }
    }
  }
  // approval supersedes extraction
  await db.execute(
    sql`delete from link_candidates c using links l
        where l.source_id = c.source_id and l.target_id = c.target_id and c.status = 'pending'`,
  );

  // ---- reviews: append-only, dedup by (card, reviewedAt) ----
  for (const r of payload.reviews ?? []) {
    const cardId = idByUid.get(r.cardUid ?? "");
    if (!cardId) {
      result.skipped.unknownRefs++;
      continue;
    }
    const at = new Date(r.reviewedAt);
    if (Number.isNaN(at.getTime())) continue;
    // DB 側 now() はマイクロ秒、JSON は ISO ミリ秒。丸め差を吸収する許容窓で突き合わせる。
    const [dup] = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(eq(reviews.cardId, cardId), withinMs(reviews.reviewedAt, at)))
      .limit(1);
    if (dup) continue;
    await db.insert(reviews).values({
      cardId,
      grade: r.grade,
      intervalDays: r.intervalDays,
      easeFactor: r.easeFactor,
      repetition: r.repetition,
      reviewedAt: at,
    });
    result.applied.reviews++;
  }

  // ---- activity events: append-only, dedup by (type, card, createdAt) ----
  for (const e of payload.events ?? []) {
    const at = new Date(e.createdAt);
    if (Number.isNaN(at.getTime())) continue;
    const cardId = e.cardUid ? (idByUid.get(e.cardUid) ?? null) : null;
    const dup = await db
      .select({ id: progressEvents.id })
      .from(progressEvents)
      .where(
        and(
          eq(progressEvents.type, e.type),
          withinMs(progressEvents.createdAt, at),
          cardId === null ? sql`${progressEvents.cardId} is null` : eq(progressEvents.cardId, cardId),
        ),
      )
      .limit(1);
    if (dup.length) continue;
    await db.insert(progressEvents).values({ type: e.type, cardId, createdAt: at });
    result.applied.events++;
  }

  // ---- boards (LWW) ----
  for (const b of payload.boards ?? []) {
    if (!b?.uid || !b.name) continue;
    const remoteUpdated = new Date(b.updatedAt ?? Date.now());
    if (Number.isNaN(remoteUpdated.getTime())) continue;
    const [local] = await db.select().from(whiteboards).where(eq(whiteboards.uid, b.uid)).limit(1);
    if (local && local.updatedAt >= remoteUpdated) continue;

    let boardId: number;
    if (local) {
      await db
        .update(whiteboards)
        .set({
          name: b.name,
          description: b.description ?? "",
          updatedAt: remoteUpdated,
          deletedAt: b.deletedAt ? new Date(b.deletedAt) : null,
        })
        .where(eq(whiteboards.id, local.id));
      boardId = local.id;
    } else {
      const [created] = await db
        .insert(whiteboards)
        .values({
          uid: b.uid,
          name: b.name,
          description: b.description ?? "",
          updatedAt: remoteUpdated,
          deletedAt: b.deletedAt ? new Date(b.deletedAt) : null,
        })
        .returning();
      boardId = created.id;
    }
    // placements/edges are positional state: replace wholesale for this board
    await db.delete(whiteboardCards).where(eq(whiteboardCards.whiteboardId, boardId));
    await db.delete(whiteboardEdges).where(eq(whiteboardEdges.whiteboardId, boardId));
    const places = (b.cards ?? [])
      .map((p) => ({ ...p, cardId: idByUid.get(p.cardUid ?? "") }))
      .filter((p): p is typeof p & { cardId: number } => Boolean(p.cardId));
    if (places.length) {
      await db
        .insert(whiteboardCards)
        .values(places.map((p) => ({ whiteboardId: boardId, cardId: p.cardId, x: p.x, y: p.y, width: p.width ?? 260, color: p.color ?? "white" })))
        .onConflictDoNothing();
    }
    const edges = (b.edges ?? [])
      .map((e) => ({ label: e.label ?? "", from: idByUid.get(e.from ?? ""), to: idByUid.get(e.to ?? "") }))
      .filter((e): e is { label: string; from: number; to: number } => Boolean(e.from && e.to));
    if (edges.length) {
      await db
        .insert(whiteboardEdges)
        .values(edges.map((e) => ({ whiteboardId: boardId, fromCardId: e.from, toCardId: e.to, label: e.label })));
    }
    result.applied.boards++;
  }

  return result;
}

// ---------------------------------------------------------------------------
// PE (Room/SQLite) adapter — accepts PersonalEncyclopedia's own export shape
// and normalises it into the neutral sync payload.
// ---------------------------------------------------------------------------
const PE_KIND_MAP: Record<string, string> = {
  thought: "idea",
  definition: "word",
  webpage: "link",
  book: "work",
  video: "work",
  person: "person",
  place: "place",
  event: "event",
  quote: "quote",
  paper: "work",
  document: "link",
  ai_conv: "note",
  note: "note",
};

type PeEntry = {
  id?: number | string;
  uuid?: string;
  uid?: string;
  type?: string;
  title?: string;
  summary?: string;
  content?: string;
  tags?: string[] | string;
  createdAt?: number | string;
  updatedAt?: number | string;
  deletedAt?: number | string | null;
  term?: string;
  reading?: string;
  definition?: string;
  sourceUrl?: string;
};

function peTime(v: number | string | null | undefined): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number") return new Date(v).toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Detect + convert a PersonalEncyclopedia export into a SyncPayload. */
export function fromPersonalEncyclopedia(payload: unknown): SyncPayload | null {
  const data = payload as { entries?: PeEntry[]; entry?: PeEntry[]; app?: string };
  const entries = Array.isArray(data?.entries) ? data.entries : Array.isArray(data?.entry) ? data.entry : null;
  if (!entries) return null;

  const cardsOut: SyncCard[] = [];
  for (const e of entries) {
    const title = (e.title ?? e.term ?? "").toString().trim();
    if (!title) continue;
    const uid = (e.uuid ?? e.uid ?? (e.id !== undefined ? `pe-${e.id}` : "")).toString();
    if (!uid) continue;
    const tags = Array.isArray(e.tags) ? e.tags : typeof e.tags === "string" ? e.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
    const body = [e.content, e.definition, e.sourceUrl ? `\n\n出典: ${e.sourceUrl}` : ""].filter(Boolean).join("\n\n");
    cardsOut.push({
      uid,
      title,
      summary: (e.summary ?? "").toString(),
      content: body,
      category: "General",
      tags,
      kind: PE_KIND_MAP[(e.type ?? "note").toString()] ?? "note",
      aliases: [e.reading, e.term].filter((a): a is string => Boolean(a && a !== title)),
      createdAt: peTime(e.createdAt),
      updatedAt: peTime(e.updatedAt) ?? peTime(e.createdAt) ?? new Date().toISOString(),
      deletedAt: peTime(e.deletedAt) ?? null,
    });
  }
  return { protocol: "personal-encyclopedia/entries", cards: cardsOut };
}

export async function syncStatus() {
  const [{ n: cardCount }] = await db.select({ n: sql<number>`count(*)::int` }).from(cards);
  const [{ n: tombstones }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(cards)
    .where(sql`${cards.deletedAt} is not null`);
  const [{ n: reviewCount }] = await db.select({ n: sql<number>`count(*)::int` }).from(reviews);
  const [{ n: boardCount }] = await db.select({ n: sql<number>`count(*)::int` }).from(whiteboards);
  const [latest] = await db.select({ at: sql<Date>`max(${cards.updatedAt})` }).from(cards);
  return {
    protocol: "codex-sync/1",
    contractVersion: CONTRACT_VERSION,
    cards: cardCount,
    tombstones,
    reviews: reviewCount,
    boards: boardCount,
    lastCardUpdate: latest?.at ? new Date(latest.at).toISOString() : null,
    serverTime: new Date().toISOString(),
  };
}
