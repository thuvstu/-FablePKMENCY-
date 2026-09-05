import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { cards } from "@/db/schema";
import { Markdown } from "@/components/Markdown";
import DeleteCardButton from "@/components/DeleteCardButton";
import FavoriteButton from "@/components/FavoriteButton";
import CandidateActions from "@/components/CandidateActions";
import { getCardBySlug, getCardContext, listCandidatesForCard } from "@/lib/cards";
import { categoryClass, kindMeta, normalizeTitle, slugify } from "@/lib/wiki";
import { History, Link2Icon } from "lucide-react";

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
        <p className="mt-2 text-sm text-stone-400">まだありません。</p>
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

  const [ctx, all, pendingForCard] = await Promise.all([
    getCardContext(card.id, card.category, card.tags),
    db.select({ title: cards.title, slug: cards.slug }).from(cards),
    listCandidatesForCard(card.id),
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
          百科事典
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
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">目次</h3>
              {headings.length === 0 ? (
                <p className="text-xs text-stone-400">セクションなし。</p>
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
              <div>作成 {new Date(card.createdAt).toLocaleDateString("ja-JP")}</div>
              <div>更新 {new Date(card.updatedAt).toLocaleDateString("ja-JP")}</div>
            </div>
          </div>
        </aside>

        {/* Article */}
        <article className="min-w-0 rounded-2xl border border-[#e6e0d4] bg-white p-6 shadow-sm sm:p-10">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${kindMeta(card.kind).className}`}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: kindMeta(card.kind).dot }} />
              {kindMeta(card.kind).label}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${categoryClass(card.category)}`}>{card.category}</span>
            {card.tags.map((t) => (
              <Link key={t} href={`/?tag=${encodeURIComponent(t)}`} className="rounded-full border border-[#ddd5c7] px-2 py-0.5 text-xs text-stone-600 hover:border-[#b4532a] hover:text-[#b4532a]">
                #{t}
              </Link>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <FavoriteButton id={card.id} initial={card.isFavorite} />
              <Link
                href={`/wiki/${card.slug}/history`}
                title="履歴を見る"
                className="rounded-md border border-[#ddd5c7] px-2 py-1 text-stone-500 hover:bg-[#faf7f1]"
              >
                <History size={15} />
              </Link>
              <Link href={`/wiki/${card.slug}/edit`} className="rounded-md border border-[#ddd5c7] px-3 py-1 text-sm hover:bg-[#faf7f1]">
                編集
              </Link>
              <DeleteCardButton id={card.id} title={card.title} />
            </div>
          </div>

          {!hasH1 && <h1 className="mb-2 font-serif text-4xl font-semibold tracking-tight">{card.title}</h1>}
          {card.summary && <p className="mb-6 font-serif text-lg italic leading-relaxed text-stone-600">{card.summary}</p>}

          {card.content.trim() ? (
            <Markdown content={card.content} resolve={resolve} />
          ) : (
            <p className="text-stone-400">
              このエントリはまだ空です。{" "}
              <Link href={`/wiki/${card.slug}/edit`} className="text-[#b4532a] underline">
                執筆する
              </Link>
            </p>
          )}
        </article>

        {/* Context */}
        <aside className="space-y-4">
          {pendingForCard.length > 0 && (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-800">
                <Link2Icon size={12} /> 接続の候補（{pendingForCard.length}）
              </h3>
              <p className="mt-0.5 text-[11px] text-stone-500">承認すると知識グラフの辺になります</p>
              <ul className="mt-2 space-y-2.5">
                {pendingForCard.map((c) => {
                  const outgoing = c.sourceId === card.id;
                  return (
                    <li key={c.id} className="rounded-lg bg-white p-2.5 ring-1 ring-emerald-200">
                      <div className="text-sm">
                        <Link
                          href={`/wiki/${outgoing ? c.targetSlug : c.sourceSlug}`}
                          className="font-serif font-semibold hover:text-[#b4532a]"
                        >
                          {outgoing ? c.targetTitle : c.sourceTitle}
                        </Link>
                        <span className="ml-1.5 text-[10px] text-stone-400">{outgoing ? "この項目からの参照" : "ここへの参照"}</span>
                      </div>
                      <div className="mt-1.5">
                        <CandidateActions id={c.id} compact />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <MiniList title="被リンク" hint="このエントリを参照している項目" items={ctx.backlinks} />
          <MiniList title="リンク先" items={ctx.outgoing} />
          <MiniList title="関連項目" hint="カテゴリ・タグが共通" items={ctx.related} />
          <section className="rounded-xl border border-[#e6e0d4] bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">ホワイトボード</h3>
            {ctx.boards.length === 0 ? (
              <p className="mt-2 text-sm text-stone-400">
                未配置。{" "}
                <Link href="/boards" className="text-[#b4532a] hover:underline">
                  ボードを開く →
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
