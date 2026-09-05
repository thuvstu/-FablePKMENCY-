import Link from "next/link";
import { getStats, listCards } from "@/lib/cards";
import { seedIfEmpty } from "@/lib/seed";
import { categoryClass } from "@/lib/wiki";

export const dynamic = "force-dynamic";

const LETTERS = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];

function Badge({ cat }: { cat: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${categoryClass(cat)}`}>
      {cat}
    </span>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; tag?: string; letter?: string }>;
}) {
  await seedIfEmpty();
  const sp = await searchParams;
  const filtering = Boolean(sp.q || sp.category || sp.tag || sp.letter);
  const [stats, entries] = await Promise.all([getStats(), listCards(sp)]);

  const grouped = new Map<string, typeof entries>();
  for (const e of entries) {
    const first = e.title[0]?.toUpperCase() ?? "#";
    const key = /[A-Z]/.test(first) ? first : "#";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(e);
  }
  const buildHref = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { ...sp, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {/* Masthead */}
      <section className="mb-8 border-b border-[#e6e0d4] pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-stone-500">The free encyclopedia of your own mind</p>
            <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Codex</h1>
            <p className="mt-2 max-w-2xl text-stone-600">
              Every card is an encyclopedia entry. Link entries with <code className="rounded bg-[#efe9de] px-1">[[double brackets]]</code>,
              arrange them on whiteboards, and watch the knowledge graph grow.
            </p>
          </div>
          <dl className="flex gap-6 text-center">
            {[
              ["Entries", stats.cardCount],
              ["Links", stats.linkCount],
              ["Boards", stats.boardCount],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs uppercase tracking-wider text-stone-500">{k}</dt>
                <dd className="font-serif text-3xl font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* A–Z bar */}
      <nav className="mb-6 flex flex-wrap gap-1 rounded-xl border border-[#e6e0d4] bg-white/60 p-2">
        <Link
          href={buildHref({ letter: undefined })}
          className={`rounded px-2 py-1 text-xs font-medium ${!sp.letter ? "bg-[#1f1b16] text-white" : "text-stone-600 hover:bg-[#ece6da]"}`}
        >
          All
        </Link>
        {LETTERS.map((l) => (
          <Link
            key={l}
            href={buildHref({ letter: l })}
            className={`rounded px-2 py-1 font-serif text-sm ${sp.letter === l ? "bg-[#1f1b16] text-white" : "text-stone-700 hover:bg-[#ece6da]"}`}
          >
            {l}
          </Link>
        ))}
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        {/* Main column */}
        <div>
          {filtering && (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-stone-600">
              <span>
                {entries.length} result{entries.length === 1 ? "" : "s"}
              </span>
              {sp.q && <span className="rounded-full bg-[#ece6da] px-2 py-0.5">“{sp.q}”</span>}
              {sp.category && <Badge cat={sp.category} />}
              {sp.tag && <span className="rounded-full bg-[#ece6da] px-2 py-0.5">#{sp.tag}</span>}
              <Link href="/" className="ml-2 text-[#b4532a] hover:underline">
                Clear
              </Link>
            </div>
          )}

          {!filtering && (
            <section className="mb-8">
              <h2 className="mb-3 font-serif text-xl font-semibold">Recently edited</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {stats.recent.map((c) => (
                  <Link
                    key={c.id}
                    href={`/wiki/${c.slug}`}
                    className="group rounded-xl border border-[#e6e0d4] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <Badge cat={c.category} />
                      <span className="text-[11px] text-stone-400">{new Date(c.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <h3 className="font-serif text-lg font-semibold leading-tight group-hover:text-[#b4532a]">{c.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-stone-600">{c.summary}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 font-serif text-xl font-semibold">{filtering ? "Entries" : "Index"}</h2>
            {entries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#d8d0c2] p-10 text-center text-stone-500">
                No entries match.{" "}
                {sp.q && (
                  <Link href={`/new?title=${encodeURIComponent(sp.q)}`} className="text-[#b4532a] hover:underline">
                    Create “{sp.q}”
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {[...grouped.entries()].map(([letter, list]) => (
                  <div key={letter} className="grid grid-cols-[2.5rem_1fr] gap-3">
                    <div className="font-serif text-3xl font-semibold text-[#b4532a]">{letter}</div>
                    <ul className="divide-y divide-[#eee8dd] rounded-xl border border-[#e6e0d4] bg-white">
                      {list.map((c) => (
                        <li key={c.id}>
                          <Link href={`/wiki/${c.slug}`} className="flex items-start gap-3 px-4 py-2.5 hover:bg-[#faf7f1]">
                            <div className="min-w-0 flex-1">
                              <div className="font-serif text-base font-semibold leading-tight">{c.title}</div>
                              <div className="line-clamp-1 text-sm text-stone-600">{c.summary}</div>
                            </div>
                            <Badge cat={c.category} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <div className="rounded-xl border border-[#e6e0d4] bg-white p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">Categories</h3>
            <ul className="space-y-1">
              {stats.categories.map((c) => (
                <li key={c.category}>
                  <Link
                    href={buildHref({ category: sp.category === c.category ? undefined : c.category })}
                    className={`flex items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-[#faf7f1] ${sp.category === c.category ? "bg-[#faf7f1] font-semibold" : ""}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ring-2 ${categoryClass(c.category).split(" ")[0]} ${categoryClass(c.category).split(" ")[2]}`} />
                      {c.category}
                    </span>
                    <span className="text-xs text-stone-400">{c.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-[#e6e0d4] bg-white p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">Most referenced</h3>
            <ol className="space-y-1.5">
              {stats.hubs.map((h, i) => (
                <li key={h.id} className="flex items-center gap-2 text-sm">
                  <span className="w-4 font-serif text-stone-400">{i + 1}</span>
                  <Link href={`/wiki/${h.slug}`} className="flex-1 truncate hover:text-[#b4532a] hover:underline">
                    {h.title}
                  </Link>
                  <span className="text-xs text-stone-400">{h.n} ←</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl border border-[#e6e0d4] bg-white p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">Tags</h3>
            <div className="flex flex-wrap gap-1.5">
              {stats.tags.map((t) => (
                <Link
                  key={t.tag}
                  href={buildHref({ tag: sp.tag === t.tag ? undefined : t.tag })}
                  className={`rounded-full border px-2 py-0.5 text-xs transition ${
                    sp.tag === t.tag ? "border-[#1f1b16] bg-[#1f1b16] text-white" : "border-[#ddd5c7] text-stone-600 hover:border-[#b4532a] hover:text-[#b4532a]"
                  }`}
                >
                  #{t.tag} <span className="opacity-60">{t.count}</span>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
