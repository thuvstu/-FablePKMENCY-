import Link from "next/link";
import { listCandidates, countPendingCandidates } from "@/lib/cards";
import CandidateActions from "@/components/CandidateActions";
import ApproveAllButton from "@/components/ApproveAllButton";
import { Link2, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const [pending, count] = await Promise.all([listCandidates("pending"), countPendingCandidates()]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-stone-500">
            <Link2 size={13} /> Approval gate
          </p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">接続の候補</h1>
          <p className="mt-1 max-w-2xl text-stone-600">
            <code className="rounded bg-[#efe9de] px-1">[[…]]</code> で書かれたリンクは、まずここに「候補」として積まれます。
            あなたが承認して初めて知識グラフの辺になります — 自動連結による毛玉化を防ぐための承認制です。
          </p>
        </div>
        {count > 0 && <ApproveAllButton />}
      </div>

      {pending.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d8d0c2] bg-white p-12 text-center text-stone-500">
          <p className="font-serif text-xl font-semibold text-stone-700">未承認の候補はありません</p>
          <p className="mt-1 text-sm">エントリに [[別の項目]] へのリンクを書くと、ここに候補が現れます。</p>
        </div>
      ) : (
        <ul className="divide-y divide-[#eee8dd] rounded-2xl border border-[#e6e0d4] bg-white">
          {pending.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Link href={`/wiki/${c.sourceSlug}`} className="font-serif font-semibold hover:text-[#b4532a]">
                    {c.sourceTitle}
                  </Link>
                  <ArrowRight size={13} className="shrink-0 text-stone-400" />
                  <Link href={`/wiki/${c.targetSlug}`} className="font-serif font-semibold hover:text-[#b4532a]">
                    {c.targetTitle}
                  </Link>
                </div>
                <div className="mt-0.5 text-[11px] text-stone-400">
                  提案: {new Date(c.createdAt).toLocaleString("ja-JP")} · 本文中の [[{c.targetTitle}]] に由来
                </div>
              </div>
              <CandidateActions id={c.id} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
