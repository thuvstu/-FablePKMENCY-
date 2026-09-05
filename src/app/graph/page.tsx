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
        <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Every [[link]] is an edge</p>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Knowledge graph</h1>
        <p className="mt-1 text-stone-600">
          {nodes.length} entries · {edges.length} links. Node size reflects how many entries connect to it. Hover to highlight neighbours, drag to rearrange, click to open.
        </p>
      </div>
      <GraphView nodes={nodes} edges={edges} />
    </main>
  );
}
