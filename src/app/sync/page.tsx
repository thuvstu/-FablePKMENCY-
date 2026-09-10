import Link from "next/link";
import { syncStatus } from "@/lib/sync";
import { CONTRACT_VERSION, SYNCABLE_TABLES } from "@/lib/schema-contract";
import { RefreshCw, ArrowDownToLine, ArrowUpFromLine, Smartphone, Layers, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

function Endpoint({
  method,
  path,
  children,
}: {
  method: string;
  path: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#e6e0d4] bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="rounded bg-[#1f1b16] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">{method}</span>
        <code className="font-mono text-sm font-semibold">{path}</code>
      </div>
      <div className="mt-2 text-sm text-stone-600">{children}</div>
    </div>
  );
}

export default async function SyncPage() {
  const status = await syncStatus();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-stone-500">
          <RefreshCw size={13} /> {status.protocol} · contract v{CONTRACT_VERSION}
        </p>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">同期（PE ⇄ Codex）</h1>
        <p className="mt-1 max-w-3xl text-stone-600">
          PersonalEncyclopedia（Android / Room / SQLite）と本体（PostgreSQL）は
          <strong>uid を同一性、updated_at を勝敗判定、tombstone を削除の伝播</strong>に使って複製し合います。
          方言に依存しない JSON（ISO-8601 UTC）でやり取りするので、Room 側は PostgreSQL を一切知る必要がありません。
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["エントリ", status.cards - status.tombstones],
          ["tombstone", status.tombstones],
          ["レビュー履歴", status.reviews],
          ["ボード", status.boards],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-[#e6e0d4] bg-white p-3 text-center">
            <div className="font-serif text-2xl font-semibold">{v}</div>
            <div className="text-[10px] text-stone-500">{k}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <Endpoint method="GET" path="/api/sync">
          複製状態のヘルスチェック。<code className="rounded bg-[#efe9de] px-1">lastCardUpdate</code>{" "}
          を次回 pull の <code className="rounded bg-[#efe9de] px-1">since</code> に使えます。
          <div className="mt-1 text-xs text-stone-400">現在: {status.lastCardUpdate ?? "—"}</div>
        </Endpoint>

        <Endpoint method="GET" path="/api/sync/pull?since=ISO8601">
          <span className="flex items-center gap-1.5 font-medium text-stone-700">
            <ArrowDownToLine size={13} /> 差分取得
          </span>
          since 以降に更新された cards / links / reviews / events / boards を返します（tombstone 込み）。
          since 省略で全件＝初回ブートストラップ。
        </Endpoint>

        <Endpoint method="POST" path="/api/sync/push">
          <span className="flex items-center gap-1.5 font-medium text-stone-700">
            <ArrowUpFromLine size={13} /> 差分反映（冪等・LWW）
          </span>
          同じ payload を何度送っても結果は変わりません。取り込んだリンクは
          <strong>承認済みフラグが無ければ候補として積まれます</strong>（原則2：毛玉化防止）。
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700">
            <Smartphone size={12} /> PE の entries エクスポート形式も自動判別して取り込みます（PE_KIND_MAP で型を写像）。
          </div>
        </Endpoint>

        <Endpoint method="GET" path="/api/schema?format=sqlite">
          <span className="flex items-center gap-1.5 font-medium text-stone-700">
            <Layers size={13} /> スキーマ契約
          </span>
          共有設計から生成した SQLite / PostgreSQL の DDL。
          <Link href="/schema" className="ml-1 text-[#b4532a] hover:underline">
            契約の一覧を見る →
          </Link>
        </Endpoint>
      </div>

      <section className="mt-6 rounded-xl border border-[#e6e0d4] bg-white p-5">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <ShieldCheck size={14} className="text-[#b4532a]" /> 競合と削除の扱い（決定論）
        </h2>
        <ul className="mt-2 space-y-1.5 text-sm text-stone-600">
          <li>
            <strong>同一性</strong>：<code className="rounded bg-[#efe9de] px-1">uid</code>（採番 id は同期に使わない）
          </li>
          <li>
            <strong>競合</strong>：<code className="rounded bg-[#efe9de] px-1">updated_at</code> が新しい方が勝ち。同値ならローカル維持
          </li>
          <li>
            <strong>削除</strong>：tombstone を送受信。未知のカードの削除通知も墓標として記録し、後から復活させない
          </li>
          <li>
            <strong>履歴</strong>：reviews / progress_events は append-only。自然キーで重複排除するので二重取り込みが起きない
          </li>
          <li>
            <strong>リンク</strong>：<code className="rounded bg-[#efe9de] px-1">approved: true</code> のみ辺として取り込み、それ以外は候補
          </li>
        </ul>
        <p className="mt-3 text-xs text-stone-400">同期対象テーブル: {SYNCABLE_TABLES.join(" / ")}</p>
      </section>

      <section className="mt-6 rounded-xl border border-[#e6e0d4] bg-[#faf7f1] p-5">
        <h2 className="text-sm font-semibold">最小の複製手順（cron 不要・一人運用）</h2>
        <pre className="thin-scroll mt-2 overflow-x-auto rounded-lg bg-[#2a2520] p-3 text-[11px] text-[#f4efe6]">
          <code>{`# 1. Codex から差分を取り出す（PE 側で保持した last_sync を渡す）
curl "$CODEX/api/sync/pull?since=$LAST_SYNC" > pull.json

# 2. PE のローカル変更を送り返す（冪等なので失敗したら再送すればよい）
curl -X POST "$CODEX/api/sync/push" -H 'Content-Type: application/json' -d @push.json

# 3. serverTime を last_sync として保存する`}</code>
        </pre>
      </section>
    </main>
  );
}
