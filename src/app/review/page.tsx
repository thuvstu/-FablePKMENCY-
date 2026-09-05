import { db } from "@/db";
import { cards } from "@/db/schema";
import ReviewSession from "@/components/ReviewSession";
import { getDueQueue } from "@/lib/srs";
import { GraduationCap } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const [{ due, todayReviewed, totalReviewed }, titles] = await Promise.all([
    getDueQueue(),
    db.select({ title: cards.title, slug: cards.slug }).from(cards),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-stone-500">
            <GraduationCap size={13} /> Spaced Repetition (SM-2)
          </p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">復習</h1>
          <p className="mt-1 text-stone-600">
            エントリがフラッシュカードになります。書いた知識を、忘れる前に引き出す。
          </p>
        </div>
        <div className="flex gap-4 text-center text-sm">
          <div>
            <div className="font-serif text-2xl font-semibold text-[#b4532a]">{due.length}</div>
            <div className="text-xs text-stone-500">期限到来</div>
          </div>
          <div>
            <div className="font-serif text-2xl font-semibold">{todayReviewed}</div>
            <div className="text-xs text-stone-500">今日の復習</div>
          </div>
          <div>
            <div className="font-serif text-2xl font-semibold">{totalReviewed}</div>
            <div className="text-xs text-stone-500">累計</div>
          </div>
        </div>
      </div>
      <ReviewSession queue={due} titles={titles} />
    </main>
  );
}
