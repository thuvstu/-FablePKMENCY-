import Link from "next/link";
import { db } from "@/db";
import { cards, links, progressEvents, reviews } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { seedIfEmpty } from "@/lib/seed";
import { getDueQueue } from "@/lib/srs";
import { getStats } from "@/lib/cards";
import { extractWikiLinks, kindMeta, normalizeTitle, slugify } from "@/lib/wiki";
import { Flame, GitBranch, Link2Off, GraduationCap } from "lucide-react";

export const dynamic = "force-dynamic";

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function StatsPage() {
  await seedIfEmpty();

  const [basis, dueInfo, allCards, dayRows, kindRows, reviewAgg] = await Promise.all([
    getStats(),
    getDueQueue(),
    db.select({ title: cards.title, slug: cards.slug, content: cards.content }).from(cards),
    db.execute<{ day: string; count: number }>(
      sql`select to_char(created_at, 'YYYY-MM-DD') as day, count(*)::int as count from ${progressEvents} group by day`,
    ),
    db
      .select({ kind: cards.kind, count: sql<number>`count(*)::int` })
      .from(cards)
      .groupBy(cards.kind),
    db.execute<{ total: number; avgInterval: number | null; avgEase: number | null }>(sql`
      select count(*)::int as total,
        avg(interval_days)::float as "avgInterval",
        avg(ease_factor)::float as "avgEase"
      from ${reviews}`),
  ]);

  // ---- activity heatmap (12 weeks) ----
  const byDay = new Map(dayRows.rows.map((r) => [r.day, r.count]));
  const today = new Date();
  const days: { key: string; count: number; date: Date }[] = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000);
    const key = dayKey(d);
    days.push({ key, count: byDay.get(key) ?? 0, date: d });
  }
  // streak: consecutive days ending today (or yesterday) with activity
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) streak++;
    else if (i === days.length - 1) continue; // today may not have started yet
    else break;
  }
  const max = Math.max(1, ...days.map((d) => d.count));
  const weeks: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  // ---- dangling [[links]] ----
  const knownTitles = new Set(allCards.map((c) => normalizeTitle(c.title)));
  const knownSlugs = new Set(allCards.map((c) => c.slug));
  const dangling = new Map<string, string[]>();
  for (const c of allCards) {
    for (const t of extractWikiLinks(c.content)) {
      if (knownTitles.has(normalizeTitle(t)) || knownSlugs.has(slugify(t))) continue;
      if (!dangling.has(t)) dangling.set(t, []);
      dangling.get(t)!.push(c.title);
    }
  }
  const danglingList = [...dangling.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 12);

  const [{ linkCount }] = await db.select({ linkCount: sql<number>`count(*)::int` }).from(links);
  const density = basis.cardCount > 0 ? (linkCount / basis.cardCount).toFixed(1) : "0";

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Learning Analytics</p>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">統計</h1>
      </div>

      {/* headline metrics */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "ストリーク", value: `${streak} 日`, icon: <Flame size={16} className="text-orange-500" />, sub: "連続した活動日数" },
          { label: "エントリ数", value: basis.cardCount, icon: <GitBranch size={16} className="text-stone-500" />, sub: `リンク密度 ${density} / 件` },
          { label: "復習待ち", value: dueInfo.due.length, icon: <GraduationCap size={16} className="text-violet-500" />, sub: `今日 ${dueInfo.todayReviewed} 件済み` },
          { label: "未解決リンク", value: dangling.size, icon: <Link2Off size={16} className="text-red-500" />, sub: "書かれるのを待っている項目" },
        ].map((m) => (
          <div key={m.label} className="rounded-2xl border border-[#e6e0d4] bg-white p-4">
            <div className="flex items-center gap-2 text-xs text-stone-500">
              {m.icon} {m.label}
            </div>
            <div className="mt-1 font-serif text-3xl font-semibold">{m.value}</div>
            <div className="text-[11px] text-stone-400">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* heatmap */}
      <section className="mt-6 rounded-2xl border border-[#e6e0d4] bg-white p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">活動ヒートマップ（直近12週間）</h2>
          <span className="text-xs text-stone-400">作成・編集・復習の合計</span>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((d) => (
                <div
                  key={d.key}
                  title={`${d.key} — ${d.count} 活動`}
                  className="h-4 w-4 rounded-sm"
                  style={{
                    background:
                      d.count === 0 ? "#efe9de" : `rgba(180, 83, 42, ${0.25 + 0.75 * (d.count / max)})`,
                  }}
                />
              ))}
              {wi === weeks.length - 1 && <div className="mt-1 text-center text-[9px] text-stone-400">今日</div>}
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* categories */}
        <section className="rounded-2xl border border-[#e6e0d4] bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold">カテゴリ分布</h2>
          <div className="space-y-2">
            {basis.categories.map((c) => (
              <div key={c.category}>
                <div className="flex justify-between text-xs">
                  <span>{c.category}</span>
                  <span className="text-stone-400">{c.count}</span>
                </div>
                <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-[#efe9de]">
                  <div className="h-full bg-[#b4532a]" style={{ width: `${(c.count / Math.max(1, basis.cardCount)) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* kinds */}
        <section className="rounded-2xl border border-[#e6e0d4] bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold">エントリ型</h2>
          <div className="flex flex-wrap gap-2">
            {kindRows.map((k) => {
              const meta = kindMeta(k.kind);
              return (
                <Link
                  key={k.kind}
                  href={`/?kind=${k.kind}`}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ring-1 transition hover:opacity-80 ${meta.className}`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: meta.dot }} />
                  {meta.label}
                  <span className="font-semibold">{k.count}</span>
                </Link>
              );
            })}
          </div>
          <h2 className="mb-2 mt-6 text-sm font-semibold">SRS の健全性</h2>
          <dl className="space-y-1 text-sm text-stone-600">
            <div className="flex justify-between"><dt>累計レビュー</dt><dd className="font-medium">{reviewAgg.rows[0]?.total ?? 0}</dd></div>
            <div className="flex justify-between"><dt>平均間隔</dt><dd className="font-medium">{reviewAgg.rows[0]?.avgInterval ? `${reviewAgg.rows[0].avgInterval!.toFixed(1)} 日` : "—"}</dd></div>
            <div className="flex justify-between"><dt>平均易しさ係数</dt><dd className="font-medium">{reviewAgg.rows[0]?.avgEase ? reviewAgg.rows[0].avgEase!.toFixed(2) : "—"}</dd></div>
          </dl>
        </section>

        {/* dangling links */}
        <section className="rounded-2xl border border-[#e6e0d4] bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold">未解決リンク（赤リンク）</h2>
          <p className="mb-3 text-[11px] text-stone-400">存在しない項目へのリンク — 次に書くべきトピック。</p>
          {danglingList.length === 0 ? (
            <p className="text-sm text-stone-500">すべてのリンクが解決されています。素晴らしい。</p>
          ) : (
            <ul className="space-y-1.5">
              {danglingList.map(([t, from]) => (
                <li key={t} className="text-sm">
                  <Link href={`/new?title=${encodeURIComponent(t)}`} className="wikilink-missing font-medium">
                    {t}
                  </Link>
                  <span className="ml-2 text-xs text-stone-400">← {from.slice(0, 2).join("、")}{from.length > 2 ? ` 他${from.length - 2}件` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
