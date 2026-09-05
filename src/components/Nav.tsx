"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const items = [
  { href: "/", label: "Encyclopedia" },
  { href: "/boards", label: "Whiteboards" },
  { href: "/graph", label: "Graph" },
  { href: "/random", label: "Random" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <header className="sticky top-0 z-40 border-b border-[#e6e0d4] bg-[#faf7f1]/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#1f1b16] font-serif text-lg font-semibold text-[#faf7f1]">
            C
          </span>
          <span className="font-serif text-xl font-semibold tracking-tight">Codex</span>
          <span className="hidden text-xs text-stone-500 sm:inline">PKM × Encyclopedia</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {items.map((it) => {
            const active = it.href === "/" ? pathname === "/" || pathname.startsWith("/wiki") : pathname.startsWith(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  active ? "bg-[#1f1b16] text-[#faf7f1]" : "text-stone-700 hover:bg-[#ece6da]"
                }`}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>

        <form
          className="ml-auto flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : "/");
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search entries…"
            className="w-40 rounded-md border border-[#ddd5c7] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#b4532a] focus:ring-2 focus:ring-[#b4532a]/20 sm:w-64"
          />
          <Link
            href="/new"
            className="rounded-md bg-[#b4532a] px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#9a4522]"
          >
            + New card
          </Link>
        </form>
      </div>
    </header>
  );
}
