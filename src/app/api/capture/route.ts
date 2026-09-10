import { createCard } from "@/lib/cards";

export const dynamic = "force-dynamic";

const URL_RE = /^https?:\/\/\S+$/;

/**
 * PC 入力専用エンドポイント（PE web クライアント相当）。
 * 単一: { title, content?, url?, kind?, category?, tags? }
 * 一括: { lines: string[], category?, kind? }   ("タイトル | 要約" 対応)
 * 摩擦ゼロを優先し、分類は任意。ブックマークレットからも叩ける。
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }

  // ---- bulk: one entry per line ----
  if (Array.isArray(body.lines)) {
    const created = [];
    for (const raw of body.lines as unknown[]) {
      const line = String(raw ?? "").trim();
      if (!line) continue;
      const [head, ...rest] = line.split("|");
      const titleRaw = head.trim();
      const summary = rest.join("|").trim();
      if (!titleRaw) continue;
      const isUrl = URL_RE.test(titleRaw);
      const card = await createCard({
        title: isUrl ? titleRaw.replace(/^https?:\/\//, "").replace(/\/$/, "").slice(0, 80) : titleRaw,
        summary,
        content: isUrl ? `出典: ${titleRaw}` : "",
        category: typeof body.category === "string" ? body.category : undefined,
        kind: isUrl ? "link" : typeof body.kind === "string" ? body.kind : "note",
      });
      created.push({ id: card.id, slug: card.slug, title: card.title, kind: card.kind });
    }
    return Response.json({ ok: true, count: created.length, created }, { status: 201 });
  }

  // ---- single ----
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!title && !url) return Response.json({ error: "title or url required" }, { status: 400 });

  const finalTitle = title || url.replace(/^https?:\/\//, "").replace(/\/$/, "").slice(0, 80);
  const parts = [typeof body.content === "string" ? body.content.trim() : "", url ? `出典: ${url}` : ""].filter(Boolean);

  const card = await createCard({
    title: finalTitle,
    summary: typeof body.summary === "string" ? body.summary : "",
    content: parts.join("\n\n"),
    category: typeof body.category === "string" ? body.category : undefined,
    kind: url && !body.kind ? "link" : typeof body.kind === "string" ? body.kind : "note",
    tags: Array.isArray(body.tags) ? body.tags : [],
  });

  return Response.json({ id: card.id, slug: card.slug, title: card.title, kind: card.kind }, { status: 201 });
}
