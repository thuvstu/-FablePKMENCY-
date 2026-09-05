"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { History, RotateCcw } from "lucide-react";
import type { CardRevision } from "@/db/schema";

export default function RevisionList({ cardId, slug, revisions }: { cardId: number; slug: string; revisions: CardRevision[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {revisions.map((r, i) => (
        <div key={r.id} className="flex items-start gap-4 rounded-xl border border-[#e6e0d4] bg-white p-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#ece6da] text-stone-500">
            <History size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-serif text-base font-semibold">{r.title}</span>
              <span className={`rounded-full px-2 py-px text-[10px] ring-1 ${i === 0 ? "bg-emerald-100 text-emerald-800 ring-emerald-300" : "bg-stone-100 text-stone-500 ring-stone-200"}`}>
                {i === 0 ? "最新" : `v${revisions.length - i}`}
              </span>
            </div>
            <p className="line-clamp-2 text-sm text-stone-500">{r.summary || "（要約なし）"}</p>
            <p className="mt-1 text-xs text-stone-400">
              {new Date(r.createdAt).toLocaleString("ja-JP")} · {r.content.length} 文字
            </p>
          </div>
          {i !== 0 && (
            <button
              disabled={busy === r.id}
              onClick={async () => {
                if (!confirm("この版に復元します。現在の内容も履歴に残ります。よろしいですか？")) return;
                setBusy(r.id);
                await fetch(`/api/cards/${cardId}/revisions`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ revisionId: r.id }),
                });
                setBusy(null);
                router.push(`/wiki/${slug}`);
                router.refresh();
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#ddd5c7] px-3 py-1.5 text-xs hover:bg-[#faf7f1] disabled:opacity-50"
            >
              <RotateCcw size={12} /> {busy === r.id ? "復元中…" : "復元"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
