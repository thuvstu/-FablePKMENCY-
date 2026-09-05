import Link from "next/link";
import { db } from "@/db";
import { cards } from "@/db/schema";
import { desc } from "drizzle-orm";
import { seedIfEmpty } from "@/lib/seed";
import { categoryClass, kindMeta } from "@/lib/wiki";
import { Clock, Star } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  await seedIfEmpty();
  const all = await db.select().from(cards).orderBy(desc(cards.updatedAt)).limit(200);

  const groups = new Map<string, typeof all>();
  for (const c of all) {
    const key = c.updatedAt.toISOString().slice(0, 7); // YYYY-MM
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }
  const monthLabel = (key: string) => {
    const [y, m] = key.split("-");
    return `${y}年${Number(m)}月`;
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-stone-500">
          <Clock size={13} /> Chrono view
        </p>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">タイムライン</h1>
        <p className="mt-1 text-stone-600">知識が蓄積されていく様子を時系列で眺める。</p>
      </div>

      <div className="relative space-y-8 border-l-2 border-[#e6e0d4] pl-6">
        {[...groups.entries()].map(([key, list]) => (
          <section key={key}>
            <div className="absolute -left-[9px] mt-1.5 h-4 w-4 rounded-full border-2 border-[#b4532a] bg-[#faf7f1]" />
            <h2 className="font-serif text-xl font-semibold text-[#b4532a]">
              {monthLabel(key)} <span className="text-sm font-normal text-stone-400">{list.length} 件</span>
            </h2>
            <ul className="mt-3 space-y-1.5">
              {list.map((c) => {
                const k = kindMeta(c.kind);
                return (
                  <li key={c.id}>
                    <Link
                      href={`/wiki/${c.slug}`}
                      className="group flex items-center gap-3 rounded-xl border border-transparent bg-white p-3 shadow-sm ring-1 ring-[#eee8dd] transition hover:ring-[#b4532a]/40"
                    >
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ring-1 ${k.className}`}>
                        <span className="h-2 w-2 rounded-full" style={{ background: k.dot }} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 font-serif text-[15px] font-semibold leading-tight group-hover:text-[#b4532a]">
                          {c.title}
                          {c.isFavorite && <Star size={11} className="fill-amber-400 text-amber-400" />}
                        </div>
                        <div className="line-clamp-1 text-xs text-stone-500">{c.summary}</div>
                      </div>
                      <span className={`hidden rounded-full px-2 py-0.5 text-[10px] ring-1 sm:inline ${categoryClass(c.category)}`}>{c.category}</span>
                      <span className="text-[10px] text-stone-400">
                        {c.updatedAt.getMonth() + 1}/{c.updatedAt.getDate()}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
