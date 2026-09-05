import { exportAll, toMarkdownBook, toSqliteDump } from "@/lib/portable";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const format = new URL(req.url).searchParams.get("format") ?? "json";
  if (format === "sqlite") {
    return new Response(await toSqliteDump(), {
      headers: {
        "Content-Type": "application/sql; charset=utf-8",
        "Content-Disposition": `attachment; filename="codex-export.sql"`,
      },
    });
  }
  if (format === "md" || format === "markdown") {
    return new Response(await toMarkdownBook(), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="codex-export.md"`,
      },
    });
  }
  return new Response(JSON.stringify(await exportAll(), null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="codex-export.json"`,
    },
  });
}
