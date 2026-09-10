import { db } from "@/db";
import { cards } from "@/db/schema";
import { sql } from "drizzle-orm";
import { alive } from "@/lib/cards";
import CaptureConsole from "@/components/CaptureConsole";
import { Zap } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CapturePage() {
  const cats = await db
    .select({ category: cards.category })
    .from(cards)
    .where(alive)
    .groupBy(cards.category)
    .orderBy(sql`count(*) desc`);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-stone-500">
          <Zap size={13} /> PC capture console
        </p>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">入力コンソール</h1>
        <p className="mt-1 max-w-3xl text-stone-600">
          PC から「入れるだけ」に特化した画面です（PersonalEncyclopedia の web クライアント相当）。
          読む・整理する・つなぐは他の画面に任せ、ここでは<strong>記録の摩擦をゼロ</strong>にします。
        </p>
      </div>
      <CaptureConsole categories={cats.map((c) => c.category)} />
    </main>
  );
}
