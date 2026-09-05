import Link from "next/link";
import { db } from "@/db";
import { whiteboards, whiteboardCards, whiteboardEdges } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import NewBoardForm from "@/components/NewBoardForm";
import { seedIfEmpty } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function BoardsPage() {
  await seedIfEmpty();
  const boards = await db
    .select({
      id: whiteboards.id,
      name: whiteboards.name,
      description: whiteboards.description,
      updatedAt: whiteboards.updatedAt,
      cardCount: sql<number>`count(distinct ${whiteboardCards.id})::int`,
      edgeCount: sql<number>`count(distinct ${whiteboardEdges.id})::int`,
    })
    .from(whiteboards)
    .leftJoin(whiteboardCards, eq(whiteboardCards.whiteboardId, whiteboards.id))
    .leftJoin(whiteboardEdges, eq(whiteboardEdges.whiteboardId, whiteboards.id))
    .groupBy(whiteboards.id)
    .orderBy(desc(whiteboards.updatedAt));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Spatial thinking</p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">Whiteboards</h1>
          <p className="mt-1 max-w-xl text-stone-600">
            Infinite canvases. Drop encyclopedia entries onto them, drag them around, and draw labelled connections.
          </p>
        </div>
        <NewBoardForm />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {boards.map((b) => (
          <Link
            key={b.id}
            href={`/boards/${b.id}`}
            className="group relative overflow-hidden rounded-2xl border border-[#e6e0d4] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="paper-grid relative h-32 border-b border-[#e6e0d4]">
              {/* faux mini cards */}
              <div className="absolute left-5 top-5 h-8 w-20 rounded bg-[#fff6c9] ring-1 ring-[#f1de83]" />
              <div className="absolute left-32 top-10 h-8 w-20 rounded bg-[#e1efff] ring-1 ring-[#a5c8f5]" />
              <div className="absolute left-16 top-20 h-8 w-20 rounded bg-[#e4f3e0] ring-1 ring-[#a9d6a0]" />
              <svg className="absolute inset-0 h-full w-full" fill="none" stroke="#a8a29e" strokeWidth="1.5">
                <line x1="100" y1="36" x2="128" y2="52" />
                <line x1="60" y1="52" x2="90" y2="80" />
              </svg>
            </div>
            <div className="p-4">
              <h2 className="font-serif text-lg font-semibold leading-tight group-hover:text-[#b4532a]">{b.name}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-stone-600">{b.description || "No description."}</p>
              <div className="mt-3 flex gap-3 text-xs text-stone-400">
                <span>{b.cardCount} cards</span>
                <span>{b.edgeCount} connections</span>
                <span className="ml-auto">{new Date(b.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
