import Link from "next/link";
import { CONTRACT, CONTRACT_VERSION, postgresDDL, sqliteDDL } from "@/lib/schema-contract";
import { Database, Download, Layers, History as HistoryIcon, RefreshCw } from "lucide-react";

export const dynamic = "force-dynamic";

export default function SchemaPage() {
  const pg = postgresDDL();
  const lite = sqliteDDL();

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-stone-500">
          <Layers size={13} /> Shared schema contract v{CONTRACT_VERSION}
        </p>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">スキーマ契約</h1>
        <p className="mt-1 max-w-3xl text-stone-600">
          PersonalEncyclopedia（Room / SQLite）と Codex（Drizzle / PostgreSQL）は<strong>同じ論理設計</strong>を共有します。
          設計は <code className="rounded bg-[#efe9de] px-1">src/lib/schema-contract.ts</code> に一度だけ書き、両方言の DDL はそこから生成されます。
          方言差は型マップ1箇所に閉じ込めてあります。
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <a href="/api/schema?format=postgres" className="flex items-center gap-1.5 rounded-lg border border-[#ddd5c7] bg-white px-3 py-1.5 hover:border-[#b4532a]">
            <Download size={14} /> PostgreSQL DDL
          </a>
          <a href="/api/schema?format=sqlite" className="flex items-center gap-1.5 rounded-lg border border-[#ddd5c7] bg-white px-3 py-1.5 hover:border-[#b4532a]">
            <Download size={14} /> SQLite DDL（PE / 可搬複製用）
          </a>
          <a href="/api/schema" className="flex items-center gap-1.5 rounded-lg border border-[#ddd5c7] bg-white px-3 py-1.5 hover:border-[#b4532a]">
            <Database size={14} /> JSON 契約（Room 型対応つき）
          </a>
          <Link href="/sync" className="flex items-center gap-1.5 rounded-lg bg-[#1f1b16] px-3 py-1.5 text-white hover:bg-black">
            <RefreshCw size={14} /> 同期エンドポイント
          </Link>
        </div>
      </div>

      {/* table map */}
      <div className="mb-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {CONTRACT.map((t) => (
          <div key={t.name} className="rounded-xl border border-[#e6e0d4] bg-white p-4">
            <div className="flex items-center gap-2">
              <code className="font-mono text-sm font-semibold">{t.name}</code>
              {t.appendOnly && (
                <span className="flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] text-violet-800 ring-1 ring-violet-300">
                  <HistoryIcon size={9} /> append-only
                </span>
              )}
              {t.syncable && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-800 ring-1 ring-emerald-300">syncable</span>
              )}
            </div>
            <p className="mt-1 text-xs text-stone-600">{t.purpose}</p>
            <ul className="mt-2 space-y-0.5">
              {t.fields.map((f) => (
                <li key={f.name} className="flex items-baseline gap-2 text-[11px]">
                  <code className="font-mono text-stone-800">{f.name}</code>
                  <span className="text-stone-400">{f.type}</span>
                  {f.note && <span className="truncate text-stone-400">— {f.note}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* generated DDL side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        {[
          { label: "PostgreSQL（Codex 実体）", body: pg },
          { label: "SQLite（PE / オフライン複製）", body: lite },
        ].map((d) => (
          <section key={d.label}>
            <h2 className="mb-2 text-sm font-semibold">{d.label}</h2>
            <pre className="thin-scroll max-h-[60vh] overflow-auto rounded-xl bg-[#2a2520] p-4 text-[11px] leading-relaxed text-[#f4efe6]">
              <code>{d.body}</code>
            </pre>
          </section>
        ))}
      </div>
    </main>
  );
}
