"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Download, FileUp, RefreshCw, Database, FileJson, FileText, Layers } from "lucide-react";

export default function DataPanel() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function doImport(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error ?? "失敗しました");
      setMsg(`インポート完了: カード ${r.cards} 件・ボード ${r.boards} 件（スキップ ${r.skipped} 件${r.errors?.length ? `・エラー ${r.errors.length} 件` : ""}）`);
      router.refresh();
    } catch (e) {
      setMsg(`エラー: ${e instanceof Error ? e.message : "JSON を解析できませんでした"}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function relink() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/maintenance/relink", { method: "POST" });
    const r = await res.json();
    setMsg(`リンク索引を再構築しました（${r.relinked} エントリ）`);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#e6e0d4] bg-white p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Download size={15} className="text-[#b4532a]" /> エクスポート（データ主権）
        </h2>
        <p className="mt-1 text-xs text-stone-500">
          すべてのデータをオープンな形式で書き出します。ツールが消えても知識は残ります。
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <a
            href="/api/export?format=json"
            className="flex items-center gap-2 rounded-xl border border-[#ddd5c7] p-3 text-sm hover:border-[#b4532a] hover:bg-[#faf7f1]"
          >
            <FileJson size={16} className="text-stone-500" />
            <div>
              <div className="font-medium">JSON（完全版）</div>
              <div className="text-[11px] text-stone-400">カード+ボード。再インポート可</div>
            </div>
          </a>
          <a
            href="/api/export?format=sqlite"
            className="flex items-center gap-2 rounded-xl border border-[#ddd5c7] p-3 text-sm hover:border-[#b4532a] hover:bg-[#faf7f1]"
          >
            <Database size={16} className="text-stone-500" />
            <div>
              <div className="font-medium">SQLite ダンプ</div>
              <div className="text-[11px] text-stone-400">sqlite3 へそのまま流し込める .sql</div>
            </div>
          </a>
          <a
            href="/api/export?format=md"
            className="flex items-center gap-2 rounded-xl border border-[#ddd5c7] p-3 text-sm hover:border-[#b4532a] hover:bg-[#faf7f1]"
          >
            <FileText size={16} className="text-stone-500" />
            <div>
              <div className="font-medium">Markdown 書籍</div>
              <div className="text-[11px] text-stone-400">frontmatter 付きの読み物形式</div>
            </div>
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e6e0d4] bg-white p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <FileUp size={15} className="text-[#b4532a]" /> インポート
        </h2>
        <p className="mt-1 text-xs text-stone-500">
          エクスポート JSON、または <code className="rounded bg-[#efe9de] px-1">{`[{ "title": "...", "content": "...", "tags": [...] }]`}</code>{" "}
          形式の配列を読み込みます。既存スラッグはスキップされ、[[wikiリンク]] は自動で張り直されます。
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
        />
        <button
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="mt-3 rounded-lg bg-[#1f1b16] px-4 py-2 text-sm text-white hover:bg-black disabled:opacity-50"
        >
          {busy ? "処理中…" : "JSON ファイルを選択"}
        </button>
      </section>

      <section className="rounded-2xl border border-[#e6e0d4] bg-white p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <RefreshCw size={15} className="text-[#b4532a]" /> メンテナンス
        </h2>
        <p className="mt-1 text-xs text-stone-500">
          リンクグラフの索引を再構築します（壊れたバックリンクの修復）。tombstone の掃除は、他の複製と同期が済んでから実行してください。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            disabled={busy}
            onClick={relink}
            className="rounded-lg border border-[#ddd5c7] px-4 py-2 text-sm hover:bg-[#faf7f1] disabled:opacity-50"
          >
            リンク索引を再構築
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              if (!confirm("削除済みエントリの墓標(tombstone)を完全に消します。未同期の複製があると、その端末で復活します。続行しますか？")) return;
              setBusy(true);
              const res = await fetch("/api/maintenance/purge", { method: "POST" });
              const r = await res.json();
              setMsg(`tombstone を ${r.purged} 件削除しました`);
              setBusy(false);
              router.refresh();
            }}
            className="rounded-lg border border-[#ddd5c7] px-4 py-2 text-sm text-stone-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
          >
            tombstone を掃除
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e6e0d4] bg-white p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Layers size={15} className="text-[#b4532a]" /> 連携（PersonalEncyclopedia）
        </h2>
        <p className="mt-1 text-xs text-stone-500">
          SQLite（PE / Room）と PostgreSQL（本体）は同じ論理設計を共有します。DDL は契約から生成されます。
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link href="/schema" className="rounded-lg border border-[#ddd5c7] px-3 py-1.5 hover:bg-[#faf7f1]">
            スキーマ契約を見る
          </Link>
          <Link href="/sync" className="rounded-lg border border-[#ddd5c7] px-3 py-1.5 hover:bg-[#faf7f1]">
            同期エンドポイント
          </Link>
          <a href="/api/schema?format=sqlite" className="rounded-lg border border-[#ddd5c7] px-3 py-1.5 hover:bg-[#faf7f1]">
            SQLite DDL をダウンロード
          </a>
        </div>
      </section>

      {msg && <div className="rounded-xl border border-[#ddd5c7] bg-amber-50 px-4 py-3 text-sm text-stone-700">{msg}</div>}
    </div>
  );
}
