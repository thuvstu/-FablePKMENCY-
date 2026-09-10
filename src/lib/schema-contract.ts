/**
 * ============================================================================
 * CANONICAL SCHEMA CONTRACT — shared by
 *   · Codex   (Next.js + Drizzle + PostgreSQL)   … this repository
 *   · PersonalEncyclopedia (Android + Room + SQLite)
 * ============================================================================
 *
 * PE と Codex は DB エンジンが違うだけで、**同じ論理設計**を共有する。
 * その論理設計をここに一度だけ書き、両方言の DDL を機械生成する。
 *
 *   1 contract  ─┬─> postgresDDL()   … Codex 実体 (drizzle-kit push と一致)
 *                ├─> sqliteDDL()     … PE / 可搬バックアップ / オフライン複製
 *                └─> roomNotes()     … Room @Entity への写経ガイド
 *
 * 原則1（単一の真実+可搬性）と原則5（フォールバック）に直結する。
 * 方言差は下の TYPE_MAP に閉じ込め、それ以外は共有する。
 */

export type FieldType =
  | "id" // surrogate integer PK (autoincrement)
  | "uid" // cross-device stable identity (UUID text)
  | "text"
  | "text[]" // PG: text[] / SQLite: JSON array in TEXT
  | "int"
  | "real"
  | "bool" // PG: boolean / SQLite: INTEGER 0|1
  | "ts" // PG: timestamptz / SQLite: TEXT ISO-8601 (UTC)
  | "ts?" // nullable timestamp (tombstone)
  | "fk"; // integer FK -> cards.id etc.

export type Field = {
  name: string;
  type: FieldType;
  notNull?: boolean;
  default?: string | number | boolean | null;
  ref?: { table: string; column?: string; onDelete?: "cascade" };
  note?: string;
};

export type TableDef = {
  name: string;
  purpose: string;
  /** append-only = 上書き禁止（原則4：履歴は無制限・最新は導出） */
  appendOnly?: boolean;
  /** true なら PE ⇄ Codex 同期対象（原則1の可搬性の実体） */
  syncable?: boolean;
  fields: Field[];
  unique?: string[][];
  index?: string[][];
};

// ---------------------------------------------------------------------------
// The contract
// ---------------------------------------------------------------------------
export const CONTRACT: TableDef[] = [
  {
    name: "cards",
    purpose: "百科事典の項目＝アトミックノート（PE: entry + 型別拡張の統合形）",
    syncable: true,
    fields: [
      { name: "id", type: "id" },
      { name: "uid", type: "uid", notNull: true, note: "端末横断の同一性。採番IDは同期に使わない" },
      { name: "slug", type: "text", notNull: true, note: "URL用。表示都合なので同期の同一性には使わない" },
      { name: "title", type: "text", notNull: true },
      { name: "summary", type: "text", notNull: true, default: "" },
      { name: "content", type: "text", notNull: true, default: "", note: "Markdown + [[wiki-link]]" },
      { name: "category", type: "text", notNull: true, default: "General" },
      { name: "tags", type: "text[]", notNull: true, default: "[]" },
      { name: "kind", type: "text", notNull: true, default: "note", note: "PE の 13 entry_type に対応（9型に集約）" },
      { name: "aliases", type: "text[]", notNull: true, default: "[]", note: "PE entry_definition.reading 相当。表記揺れ検索" },
      { name: "is_favorite", type: "bool", notNull: true, default: false },
      { name: "created_at", type: "ts", notNull: true },
      { name: "updated_at", type: "ts", notNull: true, note: "Last-Write-Wins の判定軸" },
      { name: "deleted_at", type: "ts?", note: "tombstone。物理削除しないので削除も同期できる" },
    ],
    unique: [["uid"], ["slug"]],
    index: [["category"], ["updated_at"]],
  },
  {
    name: "links",
    purpose: "承認済みの有向リンク（知識グラフの辺）",
    syncable: true,
    fields: [
      { name: "id", type: "id" },
      { name: "source_id", type: "fk", notNull: true, ref: { table: "cards", onDelete: "cascade" } },
      { name: "target_id", type: "fk", notNull: true, ref: { table: "cards", onDelete: "cascade" } },
    ],
    unique: [["source_id", "target_id"]],
    index: [["target_id"]],
  },
  {
    name: "link_candidates",
    purpose: "承認待ちの接続候補（原則2：自動処理は直接書かない／却下は再提案しない）",
    syncable: true,
    fields: [
      { name: "id", type: "id" },
      { name: "source_id", type: "fk", notNull: true, ref: { table: "cards", onDelete: "cascade" } },
      { name: "target_id", type: "fk", notNull: true, ref: { table: "cards", onDelete: "cascade" } },
      { name: "similarity", type: "real", note: "決定論スコア（PE: ConnectionEngine）。AI不要" },
      { name: "status", type: "text", notNull: true, default: "pending", note: "pending | approved | rejected" },
      { name: "created_at", type: "ts", notNull: true },
    ],
    unique: [["source_id", "target_id"]],
    index: [["status"]],
  },
  {
    name: "whiteboards",
    purpose: "空間思考のキャンバス（PE: whiteboard）",
    syncable: true,
    fields: [
      { name: "id", type: "id" },
      { name: "uid", type: "uid", notNull: true },
      { name: "name", type: "text", notNull: true },
      { name: "description", type: "text", notNull: true, default: "" },
      { name: "created_at", type: "ts", notNull: true },
      { name: "updated_at", type: "ts", notNull: true },
      { name: "deleted_at", type: "ts?" },
    ],
    unique: [["uid"]],
  },
  {
    name: "whiteboard_cards",
    purpose: "ボード上のカード配置（PE: whiteboard_node）",
    syncable: true,
    fields: [
      { name: "id", type: "id" },
      { name: "whiteboard_id", type: "fk", notNull: true, ref: { table: "whiteboards", onDelete: "cascade" } },
      { name: "card_id", type: "fk", notNull: true, ref: { table: "cards", onDelete: "cascade" } },
      { name: "x", type: "real", notNull: true, default: 0 },
      { name: "y", type: "real", notNull: true, default: 0 },
      { name: "width", type: "real", notNull: true, default: 260 },
      { name: "color", type: "text", notNull: true, default: "white" },
    ],
    unique: [["whiteboard_id", "card_id"]],
  },
  {
    name: "whiteboard_edges",
    purpose: "ボード上の矢印（関係のラベル付き明示）",
    syncable: true,
    fields: [
      { name: "id", type: "id" },
      { name: "whiteboard_id", type: "fk", notNull: true, ref: { table: "whiteboards", onDelete: "cascade" } },
      { name: "from_card_id", type: "fk", notNull: true, ref: { table: "cards", onDelete: "cascade" } },
      { name: "to_card_id", type: "fk", notNull: true, ref: { table: "cards", onDelete: "cascade" } },
      { name: "label", type: "text", notNull: true, default: "" },
    ],
    index: [["whiteboard_id"]],
  },
  {
    name: "card_revisions",
    purpose: "更新前スナップショット（原則4：履歴は無制限、最新は導出）",
    appendOnly: true,
    syncable: false,
    fields: [
      { name: "id", type: "id" },
      { name: "card_id", type: "fk", notNull: true, ref: { table: "cards", onDelete: "cascade" } },
      { name: "title", type: "text", notNull: true },
      { name: "summary", type: "text", notNull: true, default: "" },
      { name: "content", type: "text", notNull: true, default: "" },
      { name: "category", type: "text", notNull: true, default: "General" },
      { name: "tags", type: "text[]", notNull: true, default: "[]" },
      { name: "kind", type: "text", notNull: true, default: "note" },
      { name: "aliases", type: "text[]", notNull: true, default: "[]" },
      { name: "created_at", type: "ts", notNull: true },
    ],
    index: [["card_id"]],
  },
  {
    name: "reviews",
    purpose: "SM-2 の全復習イベント（PE: srs_review）。現在状態は最新行から導出",
    appendOnly: true,
    syncable: true,
    fields: [
      { name: "id", type: "id" },
      { name: "card_id", type: "fk", notNull: true, ref: { table: "cards", onDelete: "cascade" } },
      { name: "grade", type: "int", notNull: true, note: "0=again 1=hard 2=good 3=easy" },
      { name: "interval_days", type: "real", notNull: true },
      { name: "ease_factor", type: "real", notNull: true },
      { name: "repetition", type: "int", notNull: true },
      { name: "reviewed_at", type: "ts", notNull: true },
    ],
    index: [["card_id"]],
  },
  {
    name: "progress_events",
    purpose: "活動ログ（PE: progress_events）。ストリーク／ヒートマップの源",
    appendOnly: true,
    syncable: true,
    fields: [
      { name: "id", type: "id" },
      { name: "type", type: "text", notNull: true, note: "created | edited | reviewed | connected" },
      { name: "card_id", type: "int" },
      { name: "created_at", type: "ts", notNull: true },
    ],
    index: [["created_at"]],
  },
];

// ---------------------------------------------------------------------------
// Dialect mapping — 方言差はここだけに閉じ込める
// ---------------------------------------------------------------------------
const TYPE_MAP: Record<FieldType, { pg: string; sqlite: string; kotlin: string }> = {
  id: { pg: "serial PRIMARY KEY", sqlite: "INTEGER PRIMARY KEY AUTOINCREMENT", kotlin: "Long (@PrimaryKey(autoGenerate=true))" },
  uid: { pg: "text", sqlite: "TEXT", kotlin: "String" },
  text: { pg: "text", sqlite: "TEXT", kotlin: "String" },
  "text[]": { pg: "text[]", sqlite: "TEXT /* JSON array */", kotlin: "List<String> (@TypeConverter: JSON)" },
  int: { pg: "integer", sqlite: "INTEGER", kotlin: "Int?" },
  real: { pg: "real", sqlite: "REAL", kotlin: "Float" },
  bool: { pg: "boolean", sqlite: "INTEGER /* 0|1 */", kotlin: "Boolean" },
  ts: { pg: "timestamptz", sqlite: "TEXT /* ISO-8601 UTC */", kotlin: "Long (epochMillis) | String" },
  "ts?": { pg: "timestamptz", sqlite: "TEXT /* ISO-8601 UTC, nullable */", kotlin: "Long?" },
  fk: { pg: "integer", sqlite: "INTEGER", kotlin: "Long" },
};

function defaultLiteral(f: Field, dialect: "pg" | "sqlite"): string {
  if (f.type === "ts") return dialect === "pg" ? " DEFAULT now()" : " DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))";
  if (f.default === undefined) return "";
  if (f.type === "text[]") return dialect === "pg" ? " DEFAULT '{}'::text[]" : " DEFAULT '[]'";
  if (typeof f.default === "boolean") return dialect === "pg" ? ` DEFAULT ${f.default}` : ` DEFAULT ${f.default ? 1 : 0}`;
  if (typeof f.default === "number") return ` DEFAULT ${f.default}`;
  return ` DEFAULT '${String(f.default).replace(/'/g, "''")}'`;
}

function emit(dialect: "pg" | "sqlite"): string {
  const out: string[] = [
    `-- ============================================================`,
    `-- Codex × PersonalEncyclopedia canonical schema — ${dialect === "pg" ? "PostgreSQL" : "SQLite"}`,
    `-- generated from src/lib/schema-contract.ts (do not hand-edit)`,
    `-- ============================================================`,
    "",
  ];
  for (const t of CONTRACT) {
    out.push(`-- ${t.purpose}${t.appendOnly ? "  [append-only]" : ""}${t.syncable ? "  [syncable]" : ""}`);
    out.push(`CREATE TABLE IF NOT EXISTS ${t.name} (`);
    const cols = t.fields.map((f) => {
      const type = TYPE_MAP[f.type][dialect];
      const nn = f.notNull && f.type !== "id" ? " NOT NULL" : "";
      const def = defaultLiteral(f, dialect);
      const ref = f.ref ? ` REFERENCES ${f.ref.table}(${f.ref.column ?? "id"})${f.ref.onDelete === "cascade" ? " ON DELETE CASCADE" : ""}` : "";
      const note = f.note ? ` -- ${f.note}` : "";
      return `  ${f.name} ${type}${nn}${def}${ref},${note}`;
    });
    // strip trailing comma of last column (keep comment)
    const last = cols.length - 1;
    cols[last] = cols[last].replace(/,(\s*--.*)?$/, "$1");
    out.push(...cols);
    out.push(");");
    for (const u of t.unique ?? []) {
      out.push(`CREATE UNIQUE INDEX IF NOT EXISTS ${t.name}_${u.join("_")}_uq ON ${t.name} (${u.join(", ")});`);
    }
    for (const i of t.index ?? []) {
      out.push(`CREATE INDEX IF NOT EXISTS ${t.name}_${i.join("_")}_idx ON ${t.name} (${i.join(", ")});`);
    }
    out.push("");
  }
  if (dialect === "pg") {
    out.push("-- 決定論検索（原則3）: 拡張が無い環境では ILIKE にフォールバックする");
    out.push("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  } else {
    out.push("-- SQLite 側は FTS4/5 か LIKE で代替する（同じ重み付け順序を守る）");
  }
  return out.join("\n");
}

export const postgresDDL = () => emit("pg");
export const sqliteDDL = () => emit("sqlite");

/** Room (@Entity) へ写すときの型対応メモ。 */
export function roomNotes(): { table: string; column: string; sqlite: string; kotlin: string; note?: string }[] {
  return CONTRACT.flatMap((t) =>
    t.fields.map((f) => ({
      table: t.name,
      column: f.name,
      sqlite: TYPE_MAP[f.type].sqlite,
      kotlin: TYPE_MAP[f.type].kotlin,
      note: f.note,
    })),
  );
}

export const SYNCABLE_TABLES = CONTRACT.filter((t) => t.syncable).map((t) => t.name);
export const CONTRACT_VERSION = 1;
