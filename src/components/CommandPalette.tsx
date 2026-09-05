"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  FilePlus2,
  GraduationCap,
  LayoutDashboard,
  Network,
  BarChart3,
  Clock,
  Settings,
  Shuffle,
  Star,
  Search,
} from "lucide-react";
import { kindMeta } from "@/lib/wiki";

type Hit = { id: number; title: string; slug: string; summary: string; category: string; kind: string; isFavorite: boolean };

type Action = { id: string; label: string; hint?: string; href: string; icon: React.ReactNode };

const ACTIONS: Action[] = [
  { id: "home", label: "百科事典トップ", href: "/", icon: <BookOpen size={15} /> },
  { id: "boards", label: "ホワイトボード一覧", href: "/boards", icon: <LayoutDashboard size={15} /> },
  { id: "graph", label: "知識グラフ", href: "/graph", icon: <Network size={15} /> },
  { id: "review", label: "復習セッションを開始", href: "/review", icon: <GraduationCap size={15} /> },
  { id: "stats", label: "学習統計", href: "/stats", icon: <BarChart3 size={15} /> },
  { id: "timeline", label: "タイムライン", href: "/timeline", icon: <Clock size={15} /> },
  { id: "random", label: "ランダムなエントリ", href: "/random", icon: <Shuffle size={15} /> },
  { id: "favorites", label: "お気に入り", href: "/?fav=1", icon: <Star size={15} /> },
  { id: "settings", label: "データ管理（エクスポート/インポート）", href: "/settings", icon: <Settings size={15} /> },
];

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
      if (e.key === "/" && !open) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          e.preventDefault();
          setOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQ("");
      setHits([]);
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open || !q.trim()) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/cards?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((rows: Hit[]) => setHits(rows.slice(0, 8)))
        .catch(() => {});
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  useEffect(() => setCursor(0), [q]);

  const filteredActions = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return ACTIONS;
    return ACTIONS.filter((a) => a.label.toLowerCase().includes(s));
  }, [q]);

  type Row =
    | { type: "hit"; hit: Hit }
    | { type: "action"; action: Action }
    | { type: "create"; title: string };

  const rows: Row[] = useMemo(() => {
    const r: Row[] = [];
    if (q.trim()) r.push({ type: "create", title: q.trim() });
    for (const h of hits) r.push({ type: "hit", hit: h });
    for (const a of filteredActions) r.push({ type: "action", action: a });
    return r;
  }, [q, hits, filteredActions]);

  const go = useCallback(
    (row: Row) => {
      setOpen(false);
      if (row.type === "hit") router.push(`/wiki/${row.hit.slug}`);
      else if (row.type === "action") router.push(row.action.href);
      else router.push(`/new?title=${encodeURIComponent(row.title)}`);
    },
    [router],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/30 px-4 pt-[15vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#e6e0d4] bg-[#fdfbf7] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[#ece6da] px-4">
          <Search size={16} className="text-stone-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(rows.length - 1, c + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === "Enter" && rows[cursor]) {
                e.preventDefault();
                go(rows[cursor]);
              }
            }}
            placeholder="検索・作成・移動…"
            className="w-full bg-transparent py-3.5 text-[15px] outline-none placeholder:text-stone-400"
          />
          <kbd className="rounded border border-[#ddd5c7] bg-white px-1.5 py-0.5 text-[10px] text-stone-400">esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-1.5 thin-scroll">
          {rows.length === 0 && <div className="px-3 py-6 text-center text-sm text-stone-400">該当なし</div>}
          {rows.map((row, i) => {
            const active = i === cursor;
            if (row.type === "create")
              return (
                <button
                  key="create"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(row)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm ${active ? "bg-[#1f1b16] text-white" : ""}`}
                >
                  <FilePlus2 size={15} className={active ? "text-amber-300" : "text-[#b4532a]"} />
                  <span>
                    「<span className="font-semibold">{row.title}</span>」を新規作成
                  </span>
                </button>
              );
            if (row.type === "hit") {
              const k = kindMeta(row.hit.kind);
              return (
                <button
                  key={row.hit.id}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(row)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left ${active ? "bg-[#1f1b16] text-white" : ""}`}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: k.dot }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {row.hit.title}
                      {row.hit.isFavorite && <Star size={11} className="fill-amber-400 text-amber-400" />}
                    </span>
                    <span className={`block truncate text-xs ${active ? "text-white/60" : "text-stone-400"}`}>{row.hit.summary}</span>
                  </span>
                  <span className={`text-[10px] ${active ? "text-white/50" : "text-stone-400"}`}>{row.hit.category}</span>
                </button>
              );
            }
            return (
              <button
                key={row.action.id}
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(row)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm ${active ? "bg-[#1f1b16] text-white" : "text-stone-600"}`}
              >
                <span className={active ? "text-amber-300" : "text-stone-400"}>{row.action.icon}</span>
                {row.action.label}
              </button>
            );
          })}
        </div>
        <div className="border-t border-[#ece6da] px-4 py-2 text-[10px] text-stone-400">
          ↑↓ で移動 · Enter で開く · <kbd className="rounded border border-[#ddd5c7] bg-white px-1">⌘K</kbd> でいつでも起動
        </div>
      </div>
    </div>
  );
}
