import { CONTRACT, CONTRACT_VERSION, SYNCABLE_TABLES, postgresDDL, roomNotes, sqliteDDL } from "@/lib/schema-contract";

export const dynamic = "force-dynamic";

/**
 * The canonical schema contract, served so the PE (Room/SQLite) side can
 * generate matching DDL without copy-pasting. ?format=sqlite|postgres|json
 */
export async function GET(req: Request) {
  const format = new URL(req.url).searchParams.get("format") ?? "json";
  if (format === "sqlite") {
    return new Response(sqliteDDL(), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": 'attachment; filename="codex-schema.sqlite.sql"' },
    });
  }
  if (format === "postgres" || format === "pg") {
    return new Response(postgresDDL(), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": 'attachment; filename="codex-schema.postgres.sql"' },
    });
  }
  return Response.json({
    contractVersion: CONTRACT_VERSION,
    syncableTables: SYNCABLE_TABLES,
    tables: CONTRACT,
    room: roomNotes(),
  });
}
