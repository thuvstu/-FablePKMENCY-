import { db } from "@/db";
import { cards } from "@/db/schema";
import { sql } from "drizzle-orm";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export async function GET() {
  const [row] = await db.select({ slug: cards.slug }).from(cards).orderBy(sql`random()`).limit(1);
  redirect(row ? `/wiki/${row.slug}` : "/");
}
