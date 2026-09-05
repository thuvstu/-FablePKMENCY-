import { NextRequest } from "next/server";
import { createCard, listCards } from "@/lib/cards";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const rows = await listCards({
    q: sp.get("q") ?? undefined,
    category: sp.get("category") ?? undefined,
    tag: sp.get("tag") ?? undefined,
  });
  return Response.json(
    rows.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      summary: c.summary,
      category: c.category,
      tags: c.tags,
      kind: c.kind,
      aliases: c.aliases,
      isFavorite: c.isFavorite,
    })),
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }
  const card = await createCard({
    title: body.title,
    summary: body.summary,
    content: body.content,
    category: body.category,
    tags: Array.isArray(body.tags) ? body.tags : [],
    kind: typeof body.kind === "string" ? body.kind : undefined,
    aliases: Array.isArray(body.aliases) ? body.aliases : [],
  });
  return Response.json(card, { status: 201 });
}
