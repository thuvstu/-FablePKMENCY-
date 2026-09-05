import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { cards } from "@/db/schema";
import CardEditor from "@/components/CardEditor";
import { getCardBySlug } from "@/lib/cards";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function EditCardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = await getCardBySlug(slug);
  if (!card) notFound();
  const [all, cats] = await Promise.all([
    db.select({ title: cards.title, slug: cards.slug }).from(cards).orderBy(cards.title),
    db.select({ category: cards.category }).from(cards).groupBy(cards.category).orderBy(sql`count(*) desc`),
  ]);
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-baseline gap-3">
        <h1 className="font-serif text-3xl font-semibold">Edit entry</h1>
        <Link href={`/wiki/${card.slug}`} className="text-sm text-stone-500 hover:text-[#b4532a]">
          ← back to {card.title}
        </Link>
      </div>
      <CardEditor
        mode="edit"
        cardId={card.id}
        initial={{ title: card.title, summary: card.summary, content: card.content, category: card.category, tags: card.tags }}
        categories={cats.map((c) => c.category)}
        allTitles={all}
      />
    </main>
  );
}
