import { db } from "@/db";
import { cards, reviews } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { logEvent } from "./cards";

// ---------------------------------------------------------------------------
// SM-2 (PersonalEncyclopedia brain layer, distilled).
// History principle: the `reviews` table stores EVERY review event; the
// current SRS state of a card is always derived from the latest row.
// grade: 0=again(もう一度) 1=hard(難しい) 2=good(正解) 3=easy(簡単)
// ---------------------------------------------------------------------------

export type SrsState = { intervalDays: number; easeFactor: number; repetition: number; lastReviewedAt: Date | null };

export function nextState(prev: SrsState, grade: number): SrsState {
  let { intervalDays, easeFactor, repetition } = prev;
  if (grade === 0) {
    repetition = 0;
    intervalDays = 1 / 48; // ~30 minutes
  } else {
    repetition += 1;
    if (repetition === 1) intervalDays = 1;
    else if (repetition === 2) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easeFactor * 10) / 10;
    // SM-2 ease adjustment, mapped from 4-button grades
    const q = grade; // 1=hard, 2=good, 3=easy
    easeFactor = easeFactor + (0.1 - (3 - q) * (0.08 + (3 - q) * 0.02));
    easeFactor = Math.max(1.3, easeFactor);
    if (grade === 1) intervalDays = Math.max(1, Math.round(intervalDays * 0.6 * 10) / 10);
    if (grade === 3) intervalDays = Math.round(intervalDays * 1.3 * 10) / 10;
  }
  return { intervalDays, easeFactor, repetition, lastReviewedAt: new Date() };
}

export function nextDueAt(state: SrsState): Date {
  const base = state.lastReviewedAt ?? new Date();
  return new Date(base.getTime() + state.intervalDays * 86_400_000);
}

export async function latestStates(cardIds?: number[]) {
  // Latest review per card via DISTINCT ON — history stays untouched.
  const rows = await db.execute<{
    card_id: number;
    grade: number;
    interval_days: number;
    ease_factor: number;
    repetition: number;
    reviewed_at: Date;
  }>(sql`
    select distinct on (card_id) card_id, grade, interval_days, ease_factor, repetition, reviewed_at
    from reviews
    ${cardIds && cardIds.length ? sql`where card_id in (${sql.join(cardIds.map((id) => sql`${id}`), sql`, `)})` : sql``}
    order by card_id, reviewed_at desc, id desc
  `);
  const map = new Map<number, SrsState & { grade: number }>();
  for (const r of rows.rows) {
    map.set(r.card_id, {
      intervalDays: r.interval_days,
      easeFactor: r.ease_factor,
      repetition: r.repetition,
      lastReviewedAt: r.reviewed_at ? new Date(r.reviewed_at) : null,
      grade: r.grade,
    });
  }
  return map;
}

export type DueCard = {
  id: number;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: string;
  kind: string;
  isNew: boolean;
  overdueHours: number;
};

export async function getDueQueue(limit = 40): Promise<{ due: DueCard[]; todayReviewed: number; totalReviewed: number }> {
  const all = await db
    .select({
      id: cards.id,
      title: cards.title,
      slug: cards.slug,
      summary: cards.summary,
      content: cards.content,
      category: cards.category,
      kind: cards.kind,
    })
    .from(cards);
  const states = await latestStates();
  const now = Date.now();
  const due: DueCard[] = [];
  for (const c of all) {
    const st = states.get(c.id);
    if (!st) {
      due.push({ ...c, isNew: true, overdueHours: 0 });
      continue;
    }
    const dueAt = (st.lastReviewedAt?.getTime() ?? 0) + st.intervalDays * 86_400_000;
    if (dueAt <= now) {
      due.push({ ...c, isNew: false, overdueHours: Math.max(0, (now - dueAt) / 3_600_000) });
    }
  }
  due.sort((a, b) => (a.isNew === b.isNew ? b.overdueHours - a.overdueHours : a.isNew ? 1 : -1));
  const [{ todayReviewed }] = await db.execute<{ todayReviewed: number }>(
    sql`select count(*)::int as "todayReviewed" from reviews where reviewed_at >= date_trunc('day', now())`,
  ).then((r) => r.rows as { todayReviewed: number }[]);
  const [{ totalReviewed }] = await db.execute<{ totalReviewed: number }>(
    sql`select count(*)::int as "totalReviewed" from reviews`,
  ).then((r) => r.rows as { totalReviewed: number }[]);
  return { due: due.slice(0, limit), todayReviewed, totalReviewed };
}

export async function submitReview(cardId: number, grade: number) {
  const states = await latestStates([cardId]);
  const prev = states.get(cardId) ?? { intervalDays: 0, easeFactor: 2.5, repetition: 0, lastReviewedAt: null };
  const next = nextState(prev, Math.min(3, Math.max(0, Math.round(grade))));
  const [row] = await db
    .insert(reviews)
    .values({ cardId, grade, intervalDays: next.intervalDays, easeFactor: next.easeFactor, repetition: next.repetition })
    .returning();
  await logEvent("reviewed", cardId);
  return { review: row, nextDueAt: nextDueAt({ ...next, lastReviewedAt: row.reviewedAt }) };
}

export async function reviewHistory(cardId: number) {
  return db.select().from(reviews).where(eq(reviews.cardId, cardId)).orderBy(desc(reviews.reviewedAt)).limit(50);
}
