import Link from "next/link";
import { notFound } from "next/navigation";
import RevisionList from "@/components/RevisionList";
import { getCardBySlug, getRevisions } from "@/lib/cards";
import { History } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HistoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = await getCardBySlug(slug);
  if (!card) notFound();
  const revisions = await getRevisions(card.id);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-stone-500">
          <History size={13} /> Version history
        </p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          「{card.title}」の履歴
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          更新のたびに旧版が保存されます。履歴は決して書き換わりません — 復元しても現在の状態が新しい版として残ります。
        </p>
        <Link href={`/wiki/${card.slug}`} className="mt-2 inline-block text-sm text-[#b4532a] hover:underline">
          ← エントリに戻る
        </Link>
      </div>
      <RevisionList cardId={card.id} slug={card.slug} revisions={revisions} />
    </main>
  );
}
