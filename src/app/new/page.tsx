import { db } from "@/db";
import { cards } from "@/db/schema";
import CardEditor from "@/components/CardEditor";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function NewCardPage({ searchParams }: { searchParams: Promise<{ title?: string }> }) {
  const { title } = await searchParams;
  const [all, cats] = await Promise.all([
    db.select({ title: cards.title, slug: cards.slug }).from(cards).orderBy(cards.title),
    db.select({ category: cards.category }).from(cards).groupBy(cards.category).orderBy(sql`count(*) desc`),
  ]);
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 font-serif text-3xl font-semibold">新規エントリ</h1>
      <CardEditor
        mode="create"
        initial={{ title: title ?? "", summary: "", content: title ? `# ${title}\n\n` : "", category: "General", tags: [] }}
        categories={cats.map((c) => c.category)}
        allTitles={all}
      />
    </main>
  );
}
