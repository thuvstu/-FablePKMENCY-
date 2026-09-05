import { db } from "@/db";
import { cards } from "@/db/schema";
import { deleteCard, updateCard } from "@/lib/cards";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const [card] = await db.select().from(cards).where(eq(cards.id, id)).limit(1);
  if (!card) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(card);
}

export async function PUT(req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid body" }, { status: 400 });
  if (typeof body.title === "string" && !body.title.trim()) {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }
  const card = await updateCard(id, {
    title: body.title,
    summary: body.summary,
    content: body.content,
    category: body.category,
    tags: Array.isArray(body.tags) ? body.tags : undefined,
  });
  if (!card) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(card);
}

export async function DELETE(_: Request, { params }: Ctx) {
  const id = Number((await params).id);
  await deleteCard(id);
  return Response.json({ ok: true });
}
