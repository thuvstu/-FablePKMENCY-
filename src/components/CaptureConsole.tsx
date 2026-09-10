"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Zap, ClipboardPaste, ListPlus, Link2, Check, Loader2 } from "lucide-react";
import { KINDS } from "@/lib/wiki";

type Captured = { id: number; slug: string; title: string; kind: string; at: number };

/**
 * PC 入力専用コンソール（PE の web クライアント相当）。
 * 原則: Input-Easy — 摩擦が生まれた瞬間にシステムは死ぬ。
 *  · Enter だけで保存、フォーカスは入力欄に戻り続ける
 *  · URL を貼ったら link 型、複数行を貼ったら一括作成
 *  · 分類は後回しでよい（未分類を許容）
 */
export default function CaptureConsole({ categories }: { categories: string[] }) {
  const [mode, setMode] = useState<"quick" | "bulk">("quick");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("note");
  const [category, setCategory] = useState("General");
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<Captured[]>([]);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const bulkRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (mode === "quick") titleRef.current?.focus();
    else bulkRef.current?.focus();
  }, [mode]);

  // URL を貼っただけで link 型に切り替える（後整理前提）
  useEffect(() => {
    if (/^https?:\/\/\S+$/.test(title.trim()) && kind === "note") setKind("link");
  }, [title, kind]);

  async function saveQuick() {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    setError(null);
    const isUrl = /^https?:\/\/\S+$/.test(t);
    const payload = isUrl
      ? {
          title: decodeURIComponent(t.replace(/^https?:\/\//, "").replace(/\/$/, "")).slice(0, 80),
          content: `${body.trim()}\n\n出典: ${t}`.trim(),
          kind: "link",
          category,
        }
      : { title: t, content: body.trim(), kind, category };
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存に失敗しました");
      setLog((l) => [{ id: json.id, slug: json.slug, title: json.title, kind: json.kind, at: Date.now() }, ...l].slice(0, 20));
      setTitle("");
      setBody("");
      setKind("note");
      titleRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function saveBulk() {
    const lines = bulk
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines, category, kind }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存に失敗しました");
      setLog((l) => [...(json.created ?? []).map((c: Captured) => ({ ...c, at: Date.now() })), ...l].slice(0, 20));
      setBulk("");
      bulkRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div>
        <div className="mb-3 flex gap-1 rounded-lg border border-[#e6e0d4] bg-white p-1 text-sm">
          {[
            { id: "quick" as const, label: "クイック入力", icon: <Zap size={14} /> },
            { id: "bulk" as const, label: "一括（1行1件）", icon: <ListPlus size={14} /> },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 transition ${
                mode === m.id ? "bg-[#1f1b16] text-white" : "text-stone-600 hover:bg-[#faf7f1]"
              }`}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {mode === "quick" ? (
          <div className="rounded-2xl border border-[#e6e0d4] bg-white p-5">
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void saveQuick();
                }
              }}
              placeholder="タイトル、または URL を貼り付け（Enter で保存）"
              className="w-full rounded-lg border border-[#ddd5c7] px-4 py-3 font-serif text-xl outline-none focus:border-[#b4532a]"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void saveQuick();
                }
              }}
              rows={7}
              placeholder="本文（任意）。Markdown と [[wiki リンク]] が使えます。⌘/Ctrl+Enter で保存。"
              className="mt-2 w-full resize-y rounded-lg border border-[#ddd5c7] px-4 py-3 font-mono text-sm outline-none focus:border-[#b4532a]"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="rounded-lg border border-[#ddd5c7] px-3 py-1.5 text-sm outline-none focus:border-[#b4532a]"
              >
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
              <input
                list="cap-categories"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-40 rounded-lg border border-[#ddd5c7] px-3 py-1.5 text-sm outline-none focus:border-[#b4532a]"
              />
              <datalist id="cap-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <button
                onClick={saveQuick}
                disabled={busy || !title.trim()}
                className="ml-auto flex items-center gap-1.5 rounded-lg bg-[#b4532a] px-5 py-2 text-sm font-medium text-white hover:bg-[#9a4522] disabled:opacity-40"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <ClipboardPaste size={14} />} 保存して次へ
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#e6e0d4] bg-white p-5">
            <textarea
              ref={bulkRef}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              rows={14}
              placeholder={"1行 = 1エントリ。\nタイトルだけ書けば OK（後で整理する前提）。\n\n例:\n認知的負荷理論\nhttps://example.com/article\n忘却曲線 | エビングハウスが1885年に測定した記憶の減衰"}
              className="w-full resize-y rounded-lg border border-[#ddd5c7] px-4 py-3 font-mono text-sm outline-none focus:border-[#b4532a]"
            />
            <p className="mt-1.5 text-[11px] text-stone-400">
              <code>タイトル | 要約</code> の形式で書くと要約も入ります。URL 行は自動で「Web・資料」型になります。
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-stone-500">{bulk.split("\n").filter((l) => l.trim()).length} 件</span>
              <button
                onClick={saveBulk}
                disabled={busy || !bulk.trim()}
                className="ml-auto flex items-center gap-1.5 rounded-lg bg-[#b4532a] px-5 py-2 text-sm font-medium text-white hover:bg-[#9a4522] disabled:opacity-40"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <ListPlus size={14} />} 一括作成
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>

      <aside className="space-y-4">
        <div className="rounded-xl border border-[#e6e0d4] bg-white p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500">
            <Check size={12} /> このセッションの記録（{log.length}）
          </h3>
          {log.length === 0 ? (
            <p className="text-sm text-stone-400">まだありません。Enter だけで保存できます。</p>
          ) : (
            <ul className="space-y-1.5">
              {log.map((c) => (
                <li key={`${c.id}-${c.at}`} className="flex items-center gap-2 text-sm">
                  <Check size={12} className="shrink-0 text-emerald-600" />
                  <Link href={`/wiki/${c.slug}`} className="truncate hover:text-[#b4532a] hover:underline">
                    {c.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-[#e6e0d4] bg-[#faf7f1] p-4 text-xs text-stone-600">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500">
            <Link2 size={12} /> ブックマークレット
          </h3>
          <p className="mb-2">ブラウザのブックマークバーに登録すると、見ているページをそのまま取り込めます。</p>
          <code className="block max-h-32 overflow-auto rounded bg-[#2a2520] p-2 font-mono text-[10px] leading-relaxed text-[#f4efe6]">
            {`javascript:(()=>{fetch(location.origin.replace(location.origin,'${""}')||'',{})})();`.replace(
              /.*/,
              `javascript:(async()=>{const r=await fetch('CODEX_ORIGIN/api/capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:document.title,content:(window.getSelection()+''),url:location.href,kind:'link'})});alert(r.ok?'Codex に保存しました':'保存に失敗しました')})()`,
            )}
          </code>
          <p className="mt-1.5 text-[10px] text-stone-400">CODEX_ORIGIN をこのサイトの URL に置き換えてください。</p>
        </div>

        <div className="rounded-xl border border-[#e6e0d4] bg-white p-4 text-xs text-stone-500">
          <p className="font-medium text-stone-700">入力は摩擦ゼロで、整理は後で。</p>
          <p className="mt-1">
            タグ・接続・カテゴリは記録時に強制しません。書いた <code className="rounded bg-[#efe9de] px-1">[[リンク]]</code> は
            <Link href="/connections" className="text-[#b4532a] hover:underline">
              接続の候補
            </Link>
            に積まれ、承認するまでグラフを汚しません。
          </p>
        </div>
      </aside>
    </div>
  );
}
