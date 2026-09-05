import { db } from "@/db";
import { cards, links } from "@/db/schema";
import GraphView from "@/components/GraphView";
import { seedIfEmpty } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function GraphPage() {
  await seedIfEmpty();
  const [nodes, edges] = await Promise.all([
    db.select({ id: cards.id, title: cards.title, slug: cards.slug, category: cards.category }).from(cards),
    db.select({ source: links.sourceId, target: links.targetId }).from(links),
  ]);
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-stone-500">すべての [[リンク]] が辺になる</p>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">知識グラフ</h1>
        <p className="mt-1 text-stone-600">
          {nodes.length} 項目 · {edges.length} リンク。ノードの大きさは接続数。ホバーで隣接ノードを強調、ドラッグで移動、クリックで項目を開く。
        </p>
      </div>
      <GraphView nodes={nodes} edges={edges} />
    </main>
  );
}
