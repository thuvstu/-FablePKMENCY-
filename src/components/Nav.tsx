"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpen, LayoutDashboard, Network, GraduationCap, BarChart3, Shuffle, Search, Plus, Link2 } from "lucide-react";

const items = [
  { href: "/", label: "百科事典", icon: BookOpen },
  { href: "/boards", label: "ボード", icon: LayoutDashboard },
  { href: "/graph", label: "グラフ", icon: Network },
  { href: "/review", label: "復習", icon: GraduationCap, badge: "review" as const },
  { href: "/connections", label: "接続", icon: Link2, badge: "candidates" as const },
  { href: "/stats", label: "統計", icon: BarChart3 },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [due, setDue] = useState<number | null>(null);
  const [pendingCandidates, setPendingCandidates] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/review")
      .then((r) => r.json())
      .then((d) => setDue(d.due?.length ?? 0))
      .catch(() => {});
    fetch("/api/candidates")
      .then((r) => r.json())
      .then((d) => setPendingCandidates(d.count ?? 0))
      .catch(() => {});
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-[#e6e0d4] bg-[#faf7f1]/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#1f1b16]">
            <BookOpen size={16} className="text-amber-200" />
          </span>
          <span className="font-serif text-xl font-semibold tracking-tight">Codex</span>
          <span className="hidden text-[10px] text-stone-500 sm:inline">個人百科事典</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {items.map((it) => {
            const active = it.href === "/" ? pathname === "/" || pathname.startsWith("/wiki") : pathname.startsWith(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition ${
                  active ? "bg-[#1f1b16] text-[#faf7f1]" : "text-stone-700 hover:bg-[#ece6da]"
                }`}
              >
                <it.icon size={14} />
                {it.label}
                {it.badge === "review" && due !== null && due > 0 && (
                  <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[#b4532a] px-1 text-[10px] font-semibold text-white">
                    {due > 99 ? "99+" : due}
                  </span>
                )}
                {it.badge === "candidates" && pendingCandidates !== null && pendingCandidates > 0 && (
                  <span className="grid h-4 min-w-4 place-items-center rounded-full bg-emerald-600 px-1 text-[10px] font-semibold text-white">
                    {pendingCandidates > 99 ? "99+" : pendingCandidates}
                  </span>
                )}
              </Link>
            );
          })}
          <Link href="/random" title="ランダム" className="rounded-md p-2 text-stone-500 hover:bg-[#ece6da]">
            <Shuffle size={15} />
          </Link>
        </nav>

        <form
          className="ml-auto flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : "/");
          }}
        >
          <button
            type="button"
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
            className="flex items-center gap-2 rounded-md border border-[#ddd5c7] bg-white px-3 py-1.5 text-sm text-stone-400 hover:border-[#b4532a] hover:text-stone-600"
          >
            <Search size={14} />
            <span className="hidden lg:inline">検索・作成…</span>
            <kbd className="hidden rounded border border-[#e6e0d4] bg-[#faf7f1] px-1 text-[10px] lg:inline">⌘K</kbd>
          </button>
          <Link
            href="/new"
            className="flex items-center gap-1 rounded-md bg-[#b4532a] px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#9a4522]"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">新規カード</span>
          </Link>
        </form>
      </div>
    </header>
  );
}
