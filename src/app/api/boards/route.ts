import { db } from "@/db";
import { whiteboards, whiteboardCards } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select({
      id: whiteboards.id,
      name: whiteboards.name,
      description: whiteboards.description,
      updatedAt: whiteboards.updatedAt,
      cardCount: sql<number>`count(${whiteboardCards.id})::int`,
    })
    .from(whiteboards)
    .leftJoin(whiteboardCards, eq(whiteboardCards.whiteboardId, whiteboards.id))
    .groupBy(whiteboards.id)
    .orderBy(desc(whiteboards.updatedAt));
  return Response.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }
  const [board] = await db
    .insert(whiteboards)
    .values({ name: body.name.trim(), description: (body.description ?? "").trim() })
    .returning();
  return Response.json(board, { status: 201 });
}
