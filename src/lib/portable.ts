import { db } from "@/db";
import { cards as cardsTable, whiteboardCards, whiteboardEdges, whiteboards } from "@/db/schema";
import { createCard } from "./cards";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Data sovereignty (KNOS principle: データがツールより長生きする).
// Everything can be exported to open formats and re-imported losslessly.
// ---------------------------------------------------------------------------

type ExportCard = {
  slug: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  tags: string[];
  kind: string;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function exportAll() {
  const allCards = await db.select().from(cardsTable).orderBy(cardsTable.title);
  const slugById = new Map(allCards.map((c) => [c.id, c.slug]));
  const boards = await db.select().from(whiteboards);
  const bCards = await db.select().from(whiteboardCards);
  const bEdges = await db.select().from(whiteboardEdges);
  return {
    app: "codex",
    version: 2,
    exportedAt: new Date().toISOString(),
    cards: allCards.map(
      (c): ExportCard => ({
        slug: c.slug,
        title: c.title,
        summary: c.summary,
        content: c.content,
        category: c.category,
        tags: c.tags,
        kind: c.kind,
        isFavorite: c.isFavorite,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }),
    ),
    boards: boards.map((b) => ({
      name: b.name,
      description: b.description,
      cards: bCards
        .filter((p) => p.whiteboardId === b.id)
        .map((p) => ({ slug: slugById.get(p.cardId) ?? "", x: p.x, y: p.y, width: p.width, color: p.color })),
      edges: bEdges
        .filter((e) => e.whiteboardId === b.id)
        .map((e) => ({ from: slugById.get(e.fromCardId) ?? "", to: slugById.get(e.toCardId) ?? "", label: e.label })),
    })),
  };
}

export type ImportResult = { cards: number; boards: number; skipped: number; errors: string[] };

/** Import our export format, or a plain array of {title, content, ...}. */
export async function importAll(payload: unknown): Promise<ImportResult> {
  const result: ImportResult = { cards: 0, boards: 0, skipped: 0, errors: [] };
  const data = (payload ?? {}) as {
    cards?: Partial<ExportCard>[];
    boards?: { name?: string; description?: string; cards?: { slug?: string; x?: number; y?: number; width?: number; color?: string }[]; edges?: { from?: string; to?: string; label?: string }[] }[];
  };
  const cardList = Array.isArray(data.cards) ? data.cards : Array.isArray(payload) ? (payload as Partial<ExportCard>[]) : [];

  const existing = await db.select({ slug: cardsTable.slug, id: cardsTable.id }).from(cardsTable);
  const idBySlug = new Map(existing.map((e) => [e.slug, e.id]));

  for (const c of cardList) {
    try {
      if (!c || typeof c.title !== "string" || !c.title.trim()) {
        result.skipped++;
        continue;
      }
      if (c.slug && idBySlug.has(c.slug)) {
        result.skipped++;
        continue;
      }
      const created = await createCard({
        title: c.title,
        summary: c.summary ?? "",
        content: c.content ?? "",
        category: c.category,
        tags: Array.isArray(c.tags) ? c.tags : [],
        kind: c.kind,
      });
      idBySlug.set(created.slug, created.id);
      if (c.slug) idBySlug.set(c.slug, created.id); // alias old slug for board refs
      result.cards++;
    } catch (e) {
      result.errors.push(`${c?.title ?? "?"}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  for (const b of data.boards ?? []) {
    try {
      if (!b?.name) continue;
      const [board] = await db.insert(whiteboards).values({ name: b.name, description: b.description ?? "" }).returning();
      const placements = (b.cards ?? [])
        .filter((p) => p.slug && idBySlug.has(p.slug))
        .map((p) => ({
          whiteboardId: board.id,
          cardId: idBySlug.get(p.slug!)!,
          x: p.x ?? 100,
          y: p.y ?? 100,
          width: p.width ?? 260,
          color: p.color ?? "white",
        }));
      if (placements.length) await db.insert(whiteboardCards).values(placements).onConflictDoNothing();
      const edges = (b.edges ?? [])
        .filter((e) => e.from && e.to && idBySlug.has(e.from) && idBySlug.has(e.to))
        .map((e) => ({ whiteboardId: board.id, fromCardId: idBySlug.get(e.from!)!, toCardId: idBySlug.get(e.to!)!, label: e.label ?? "" }));
      if (edges.length) await db.insert(whiteboardEdges).values(edges);
      result.boards++;
    } catch (e) {
      result.errors.push(`board ${b?.name ?? "?"}: ${e instanceof Error ? e.message : "error"}`);
    }
  }
  return result;
}

/** Escape a JS string for use as a SQLite SQL literal. */
function lit(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

/** SQLite-compatible .sql dump (SQLiPKM lineage: data must outlive the tool). */
export async function toSqliteDump(): Promise<string> {
  const exp = await exportAll();
  const out: string[] = [
    "-- Codex SQLite export",
    `-- exportedAt: ${exp.exportedAt}`,
    "PRAGMA foreign_keys=OFF;",
    "BEGIN TRANSACTION;",
    "",
    "CREATE TABLE IF NOT EXISTS cards (",
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "  slug TEXT NOT NULL UNIQUE,",
    "  title TEXT NOT NULL,",
    "  summary TEXT NOT NULL DEFAULT '',",
    "  content TEXT NOT NULL DEFAULT '',",
    "  category TEXT NOT NULL DEFAULT 'General',",
    "  tags TEXT NOT NULL DEFAULT '[]',",
    "  kind TEXT NOT NULL DEFAULT 'note',",
    "  is_favorite INTEGER NOT NULL DEFAULT 0,",
    "  created_at TEXT NOT NULL,",
    "  updated_at TEXT NOT NULL",
    ");",
    "CREATE TABLE IF NOT EXISTS links (id INTEGER PRIMARY KEY AUTOINCREMENT, source_slug TEXT NOT NULL, target_slug TEXT NOT NULL);",
    "CREATE TABLE IF NOT EXISTS whiteboards (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '');",
    "CREATE TABLE IF NOT EXISTS whiteboard_cards (id INTEGER PRIMARY KEY AUTOINCREMENT, whiteboard_id INTEGER NOT NULL, card_slug TEXT NOT NULL, x REAL, y REAL, width REAL, color TEXT);",
    "CREATE TABLE IF NOT EXISTS whiteboard_edges (id INTEGER PRIMARY KEY AUTOINCREMENT, whiteboard_id INTEGER NOT NULL, from_slug TEXT NOT NULL, to_slug TEXT NOT NULL, label TEXT NOT NULL DEFAULT '');",
    "",
  ];
  for (const c of exp.cards) {
    out.push(
      `INSERT INTO cards (slug,title,summary,content,category,tags,kind,is_favorite,created_at,updated_at) VALUES (${lit(c.slug)},${lit(c.title)},${lit(c.summary)},${lit(c.content)},${lit(c.category)},${lit(JSON.stringify(c.tags))},${lit(c.kind)},${c.isFavorite ? 1 : 0},${lit(c.createdAt)},${lit(c.updatedAt)});`,
    );
  }
  const links = await db.execute<{ source: string; target: string }>(sql`
    select s.slug as source, t.slug as target
    from links l join cards s on s.id = l.source_id join cards t on t.id = l.target_id`);
  for (const l of links.rows) out.push(`INSERT INTO links (source_slug,target_slug) VALUES (${lit(l.source)},${lit(l.target)});`);
  exp.boards.forEach((b, i) => {
    out.push(`INSERT INTO whiteboards (id,name,description) VALUES (${i + 1},${lit(b.name)},${lit(b.description)});`);
    for (const p of b.cards) {
      out.push(`INSERT INTO whiteboard_cards (whiteboard_id,card_slug,x,y,width,color) VALUES (${i + 1},${lit(p.slug)},${p.x},${p.y},${p.width},${lit(p.color)});`);
    }
    for (const e of b.edges) {
      out.push(`INSERT INTO whiteboard_edges (whiteboard_id,from_slug,to_slug,label) VALUES (${i + 1},${lit(e.from)},${lit(e.to)},${lit(e.label)});`);
    }
  });
  out.push("COMMIT;", "");
  return out.join("\n");
}

/** Single Markdown document with YAML front matter per entry (レガシー互換の読み物形式). */
export async function toMarkdownBook(): Promise<string> {
  const all = await db.select().from(cardsTable).orderBy(cardsTable.title);
  const parts: string[] = [
    "---",
    `title: Codex Export`,
    `exportedAt: ${new Date().toISOString()}`,
    `entries: ${all.length}`,
    "---",
    "",
  ];
  for (const c of all) {
    parts.push(
      "---",
      `slug: ${c.slug}`,
      `category: ${c.category}`,
      `kind: ${c.kind}`,
      `tags: [${c.tags.map((t) => `"${t}"`).join(", ")}]`,
      `favorite: ${c.isFavorite}`,
      `updated: ${c.updatedAt.toISOString()}`,
      "---",
      "",
      `<!-- @codex-entry -->`,
      c.content.trim() || `# ${c.title}`,
      "",
    );
  }
  return parts.join("\n");
}
