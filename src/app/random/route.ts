import { db } from "@/db";
import { cards } from "@/db/schema";
import { isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export async function GET() {
  const [row] = await db.select({ slug: cards.slug }).from(cards).where(isNull(cards.deletedAt)).orderBy(sql`random()`).limit(1);
  redirect(row ? `/wiki/${row.slug}` : "/");
}
