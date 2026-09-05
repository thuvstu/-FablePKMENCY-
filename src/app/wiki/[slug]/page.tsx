import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { cards } from "@/db/schema";
import { Markdown } from "@/components/Markdown";
import DeleteCardButton from "@/components/DeleteCardButton";
import { getCardBySlug, getCardContext } from "@/lib/cards";
import { categoryClass, normalizeTitle, slugify } from "@/lib/wiki";

export const dynamic = "force-dynamic";

function MiniList({
  title,
  hint,
  items,
}: {
  title: string;
  hint?: string;
  items: { id: number; title: string; slug: string; summary: string; category: string }[];
}) {
  return (
    <section className="rounded-xl border border-[#e6e0d4] bg-white p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
        {title} <span className="text-stone-400">({items.length})</span>
      </h3>
      {hint && <p className="mt-0.5 text-[11px] text-stone-400">{hint}</p>}
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-stone-400">None yet.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((c) => (
            <li key={c.id}>
              <Link href={`/wiki/${c.slug}`} className="group block">
                <div className="font-serif text-[15px] font-semibold leading-tight group-hover:text-[#b4532a]">{c.title}</div>
                <div className="line-clamp-2 text-xs text-stone-500">{c.summary}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function WikiPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = await getCardBySlug(slug);
  if (!card) notFound();

  const [ctx, all] = await Promise.all([
    getCardContext(card.id, card.category, card.tags),
    db.select({ title: cards.title, slug: cards.slug }).from(cards),
  ]);
  const byTitle = new Map(all.map((c) => [normalizeTitle(c.title), c.slug]));
  const bySlug = new Set(all.map((c) => c.slug));
  const resolve = (t: string) => byTitle.get(normalizeTitle(t)) ?? (bySlug.has(slugify(t)) ? slugify(t) : null);

  const headings = card.content
    .split("\n")
    .map((l) => /^(#{2,3})\s+(.*)$/.exec(l))
    .filter((m): m is RegExpExecArray => Boolean(m))
    .map((m) => ({ level: m[1].length, text: m[2].replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_, a, b) => b ?? a), id: slugify(m[2]) }));

  const hasH1 = /^#\s+/m.test(card.content);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-4 flex items-center gap-2 text-sm text-stone-500">
        <Link href="/" className="hover:text-[#b4532a]">
          Encyclopedia
        </Link>
        <span>/</span>
        <Link href={`/?category=${encodeURIComponent(card.category)}`} className="hover:text-[#b4532a]">
          {card.category}
        </Link>
        <span>/</span>
        <span className="text-stone-800">{card.title}</span>
      </div>

      <div className="grid gap-8 lg:grid-cols-[200px_1fr_300px]">
        {/* TOC */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-4">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">Contents</h3>
              {headings.length === 0 ? (
                <p className="text-xs text-stone-400">No sections.</p>
              ) : (
                <ul className="space-y-1 border-l border-[#e6e0d4] text-sm">
                  {headings.map((h, i) => (
                    <li key={i} style={{ paddingLeft: h.level === 3 ? 20 : 10 }}>
                      <a href={`#${h.id}`} className="-ml-px block border-l border-transparent text-stone-600 hover:border-[#b4532a] hover:text-[#b4532a]">
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="text-xs text-stone-400">
              <div>Created {new Date(card.createdAt).toLocaleDateString()}</div>
              <div>Updated {new Date(card.updatedAt).toLocaleDateString()}</div>
            </div>
          </div>
        </aside>

        {/* Article */}
        <article className="min-w-0 rounded-2xl border border-[#e6e0d4] bg-white p-6 shadow-sm sm:p-10">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${categoryClass(card.category)}`}>{card.category}</span>
            {card.tags.map((t) => (
              <Link key={t} href={`/?tag=${encodeURIComponent(t)}`} className="rounded-full border border-[#ddd5c7] px-2 py-0.5 text-xs text-stone-600 hover:border-[#b4532a] hover:text-[#b4532a]">
                #{t}
              </Link>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <Link href={`/wiki/${card.slug}/edit`} className="rounded-md border border-[#ddd5c7] px-3 py-1 text-sm hover:bg-[#faf7f1]">
                Edit
              </Link>
              <DeleteCardButton id={card.id} title={card.title} />
            </div>
          </div>

          {!hasH1 && <h1 className="mb-2 font-serif text-4xl font-semibold tracking-tight">{card.title}</h1>}
          {card.summary && <p className="mb-6 font-serif text-lg italic leading-relaxed text-stone-600">{card.summary}</p>}

          {card.content.trim() ? (
            <Markdown content={card.content} resolve={resolve} />
          ) : (
            <p className="text-stone-400">This entry is empty. <Link href={`/wiki/${card.slug}/edit`} className="text-[#b4532a] underline">Write it.</Link></p>
          )}
        </article>

        {/* Context */}
        <aside className="space-y-4">
          <MiniList title="Linked from" hint="Backlinks — entries that reference this one" items={ctx.backlinks} />
          <MiniList title="Links to" items={ctx.outgoing} />
          <MiniList title="Related" hint="Shared category or tags" items={ctx.related} />
          <section className="rounded-xl border border-[#e6e0d4] bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">On whiteboards</h3>
            {ctx.boards.length === 0 ? (
              <p className="mt-2 text-sm text-stone-400">
                Not placed yet.{" "}
                <Link href="/boards" className="text-[#b4532a] hover:underline">
                  Open a board →
                </Link>
              </p>
            ) : (
              <ul className="mt-2 space-y-1">
                {ctx.boards.map((b) => (
                  <li key={b.id}>
                    <Link href={`/boards/${b.id}?focus=${card.id}`} className="flex items-center gap-2 text-sm hover:text-[#b4532a]">
                      <span className="grid h-5 w-5 place-items-center rounded bg-[#ece6da] text-[10px]">▦</span>
                      {b.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
