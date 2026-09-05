"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Eye, RotateCcw } from "lucide-react";
import { Markdown } from "./Markdown";
import { categoryClass, kindMeta, slugify, normalizeTitle } from "@/lib/wiki";
import type { DueCard } from "@/lib/srs";

const GRADES = [
  { grade: 0, label: "もう一度", sub: "~30分後", cls: "bg-red-100 text-red-800 ring-red-300 hover:bg-red-200" },
  { grade: 1, label: "難しい", sub: "短め", cls: "bg-orange-100 text-orange-800 ring-orange-300 hover:bg-orange-200" },
  { grade: 2, label: "覚えた", sub: "標準", cls: "bg-emerald-100 text-emerald-800 ring-emerald-300 hover:bg-emerald-200" },
  { grade: 3, label: "簡単", sub: "長め", cls: "bg-sky-100 text-sky-800 ring-sky-300 hover:bg-sky-200" },
];

export default function ReviewSession({ queue, titles }: { queue: DueCard[]; titles: { title: string; slug: string }[] }) {
  const router = useRouter();
  const [cards, setCards] = useState(queue);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ title: string; grade: number }[]>([]);
  const [done, setDone] = useState(false);

  const byTitle = useMemo(() => new Map(titles.map((t) => [normalizeTitle(t.title), t.slug])), [titles]);
  const resolve = useMemo(() => (t: string) => byTitle.get(normalizeTitle(t)) ?? slugify(t), [byTitle]);

  const current = cards[index];

  async function grade(g: number) {
    if (!current || busy) return;
    setBusy(true);
    try {
      await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: current.id, grade: g }),
      });
    } finally {
      setBusy(false);
    }
    setResults((r) => [...r, { title: current.title, grade: g }]);
    const willAppend = g === 0; // "again": push the card back to the end
    if (willAppend) setCards((cs) => [...cs, current]);
    const newLength = cards.length + (willAppend ? 1 : 0);
    if (index + 1 >= newLength) {
      setDone(true);
    } else {
      setIndex((i) => i + 1);
      setRevealed(false);
    }
  }

  if (queue.length === 0) {
    return (
      <div className="rounded-2xl border border-[#e6e0d4] bg-white p-12 text-center">
        <p className="font-serif text-2xl font-semibold">今日の復習はありません</p>
        <p className="mt-2 text-sm text-stone-500">すべてのカードが期限内で復習済みです。新しいエントリを書くと自動的に復習キューに入ります。</p>
        <Link href="/new" className="mt-5 inline-block rounded-lg bg-[#b4532a] px-4 py-2 text-sm text-white hover:bg-[#9a4522]">
          新しいエントリを書く
        </Link>
      </div>
    );
  }

  if (done) {
    const counts = [0, 0, 0, 0];
    for (const r of results) counts[r.grade]++;
    return (
      <div className="rounded-2xl border border-[#e6e0d4] bg-white p-10 text-center">
        <p className="font-serif text-3xl font-semibold">セッション完了</p>
        <p className="mt-2 text-sm text-stone-500">{results.length} 件のカードを復習しました</p>
        <div className="mx-auto mt-6 grid max-w-md grid-cols-4 gap-2 text-sm">
          {GRADES.map((g, i) => (
            <div key={g.label} className={`rounded-xl px-2 py-3 ring-1 ${g.cls.split(" hover")[0]}`}>
              <div className="font-serif text-2xl font-semibold">{counts[i]}</div>
              <div className="text-xs">{g.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-center gap-3 text-sm">
          <button
            onClick={() => router.refresh()}
            className="flex items-center gap-1.5 rounded-lg border border-[#ddd5c7] px-4 py-2 hover:bg-[#faf7f1]"
          >
            <RotateCcw size={14} /> キューを再読込
          </button>
          <Link href="/stats" className="rounded-lg bg-[#1f1b16] px-4 py-2 text-white hover:bg-black">
            統計を見る
          </Link>
        </div>
      </div>
    );
  }

  const k = kindMeta(current.kind);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-sm text-stone-500">
        <span>
          {Math.min(index + 1, cards.length)} / {cards.length} 枚目
        </span>
        <span className="flex items-center gap-2">
          {current.isNew ? (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 ring-1 ring-violet-300">新規</span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-300">復習</span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-xs ring-1 ${k.className}`}>{k.label}</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#ece6da]">
        <div className="h-full bg-[#b4532a] transition-all" style={{ width: `${(index / cards.length) * 100}%` }} />
      </div>

      <div className="mt-6 rounded-2xl border border-[#e6e0d4] bg-white p-8 shadow-sm sm:p-10">
        <div className="mb-2 flex items-center gap-2 text-xs text-stone-400">
          <span className={`rounded-full px-2 py-0.5 ring-1 ${categoryClass(current.category)}`}>{current.category}</span>
          <Link href={`/wiki/${current.slug}`} className="ml-auto hover:text-[#b4532a]">
            エントリを開く →
          </Link>
        </div>
        <h2 className="font-serif text-3xl font-semibold leading-tight">{current.title}</h2>
        {current.summary && <p className="mt-3 font-serif text-lg italic text-stone-600">{current.summary}</p>}

        {!revealed ? (
          <button
            onClick={() => setRevealed(true)}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#d8d0c2] py-10 text-stone-500 transition hover:border-[#b4532a] hover:text-[#b4532a]"
          >
            <Eye size={18} /> 答えを見る（スペースキー）
          </button>
        ) : (
          <div className="mt-6 border-t border-[#eee8dd] pt-6">
            <Markdown content={current.content} resolve={resolve} compact />
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2.5">
        {GRADES.map((g) => (
          <button
            key={g.grade}
            disabled={!revealed || busy}
            onClick={() => grade(g.grade)}
            className={`rounded-xl px-2 py-3 text-sm font-medium ring-1 transition disabled:cursor-not-allowed disabled:opacity-40 ${g.cls}`}
          >
            <div>{g.label}</div>
            <div className="text-[10px] opacity-70">{g.sub}</div>
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] text-stone-400">キー: [1] もう一度 · [2] 難しい · [3] 覚えた · [4] 簡単</p>
      <GradeKeys enabled={revealed && !busy} onGrade={grade} onReveal={() => setRevealed(true)} revealed={revealed} />
    </div>
  );
}

function GradeKeys({ enabled, onGrade, onReveal, revealed }: { enabled: boolean; onGrade: (g: number) => void; onReveal: () => void; revealed: boolean }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === " " && !revealed) {
        e.preventDefault();
        onReveal();
        return;
      }
      if (!enabled) return;
      const map: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3 };
      if (e.key in map) {
        e.preventDefault();
        onGrade(map[e.key]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, revealed, onGrade, onReveal]);
  return null;
}
