import { db } from "@/db";
import { cardRevisions, cards, links, progressEvents, reviews, whiteboards } from "@/db/schema";
import { sql } from "drizzle-orm";
import DataPanel from "@/components/DataPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const counts = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(cards),
    db.select({ n: sql<number>`count(*)::int` }).from(links),
    db.select({ n: sql<number>`count(*)::int` }).from(cardRevisions),
    db.select({ n: sql<number>`count(*)::int` }).from(reviews),
    db.select({ n: sql<number>`count(*)::int` }).from(progressEvents),
    db.select({ n: sql<number>`count(*)::int` }).from(whiteboards),
  ]);
  const labels = ["エントリ", "リンク", "履歴スナップショット", "レビュー履歴", "活動イベント", "ホワイトボード"];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Data Sovereignty</p>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">データ管理</h1>
        <p className="mt-1 text-stone-600">
          データがツールより長生きするために。いつでも全量をオープン形式で取り出せます。
        </p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {counts.map((c, i) => (
          <div key={i} className="rounded-xl border border-[#e6e0d4] bg-white p-3 text-center">
            <div className="font-serif text-xl font-semibold">{c[0].n}</div>
            <div className="text-[10px] text-stone-500">{labels[i]}</div>
          </div>
        ))}
      </div>

      <DataPanel />
    </main>
  );
}
