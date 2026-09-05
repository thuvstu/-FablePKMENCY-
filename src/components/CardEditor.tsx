"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Markdown } from "./Markdown";
import { normalizeTitle, slugify } from "@/lib/wiki";

type Props = {
  mode: "create" | "edit";
  cardId?: number;
  initial: { title: string; summary: string; content: string; category: string; tags: string[] };
  categories: string[];
  allTitles: { title: string; slug: string }[];
};

export default function CardEditor({ mode, cardId, initial, categories, allTitles }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [summary, setSummary] = useState(initial.summary);
  const [content, setContent] = useState(initial.content);
  const [category, setCategory] = useState(initial.category);
  const [tags, setTags] = useState(initial.tags.join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(true);
  const [suggest, setSuggest] = useState<{ open: boolean; query: string; start: number }>({ open: false, query: "", start: 0 });
  const taRef = useRef<HTMLTextAreaElement>(null);

  const byTitle = useMemo(() => new Map(allTitles.map((c) => [normalizeTitle(c.title), c.slug])), [allTitles]);
  const bySlug = useMemo(() => new Set(allTitles.map((c) => c.slug)), [allTitles]);
  const resolve = (t: string) => byTitle.get(normalizeTitle(t)) ?? (bySlug.has(slugify(t)) ? slugify(t) : null);

  const matches = useMemo(() => {
    if (!suggest.open) return [];
    const q = suggest.query.toLowerCase();
    return allTitles.filter((c) => c.title.toLowerCase().includes(q)).slice(0, 8);
  }, [suggest, allTitles]);

  // Detect "[[query" before the caret to open the autocomplete.
  function onContentChange(v: string) {
    setContent(v);
    const ta = taRef.current;
    if (!ta) return;
    const caret = ta.selectionStart;
    const before = v.slice(0, caret);
    const open = before.lastIndexOf("[[");
    const close = before.lastIndexOf("]]");
    if (open !== -1 && open > close) {
      const q = before.slice(open + 2);
      if (!q.includes("\n")) {
        setSuggest({ open: true, query: q, start: open });
        return;
      }
    }
    setSuggest({ open: false, query: "", start: 0 });
  }

  function insertLink(t: string) {
    const ta = taRef.current;
    if (!ta) return;
    const caret = ta.selectionStart;
    const next = content.slice(0, suggest.start) + `[[${t}]]` + content.slice(caret);
    setContent(next);
    setSuggest({ open: false, query: "", start: 0 });
    requestAnimationFrame(() => {
      const pos = suggest.start + t.length + 4;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function save() {
    if (!title.trim()) {
      setError("A title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const body = {
      title,
      summary,
      content,
      category,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    const res = await fetch(mode === "create" ? "/api/cards" : `/api/cards/${cardId}`, {
      method: mode === "create" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Failed to save.");
      return;
    }
    const card = await res.json();
    router.push(`/wiki/${card.slug}`);
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Entry title"
          className="w-full rounded-lg border border-[#ddd5c7] bg-white px-4 py-3 font-serif text-2xl font-semibold outline-none focus:border-[#b4532a]"
        />
        <input
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="One-sentence summary (shown in the index)"
          className="w-full rounded-lg border border-[#ddd5c7] bg-white px-4 py-2 text-sm outline-none focus:border-[#b4532a]"
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-500">Category</label>
            <input
              list="categories"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-[#ddd5c7] bg-white px-3 py-2 text-sm outline-none focus:border-[#b4532a]"
            />
            <datalist id="categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-500">Tags (comma separated)</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="memory, learning"
              className="w-full rounded-lg border border-[#ddd5c7] bg-white px-3 py-2 text-sm outline-none focus:border-[#b4532a]"
            />
          </div>
        </div>

        <div className="relative">
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-wider text-stone-500">Content (Markdown)</label>
            <span className="text-[11px] text-stone-400">
              Type <code>[[</code> to link an entry · ⌘S to save
            </span>
          </div>
          <textarea
            ref={taRef}
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            onKeyDown={(e) => {
              if (suggest.open && e.key === "Escape") setSuggest({ open: false, query: "", start: 0 });
              if (suggest.open && e.key === "Enter" && matches[0]) {
                e.preventDefault();
                insertLink(matches[0].title);
              }
              if (e.key === "Tab") {
                e.preventDefault();
                const ta = e.currentTarget;
                const s = ta.selectionStart;
                const next = content.slice(0, s) + "  " + content.slice(ta.selectionEnd);
                setContent(next);
                requestAnimationFrame(() => ta.setSelectionRange(s + 2, s + 2));
              }
            }}
            rows={22}
            spellCheck={false}
            placeholder={"# Title\n\nWrite in Markdown. Link to other entries with [[Entry Title]]."}
            className="w-full resize-y rounded-lg border border-[#ddd5c7] bg-white px-4 py-3 font-mono text-sm leading-relaxed outline-none focus:border-[#b4532a]"
          />
          {suggest.open && (
            <div className="absolute left-4 top-full z-20 -mt-1 w-80 rounded-lg border border-[#ddd5c7] bg-white p-1 shadow-xl">
              <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-stone-400">Link to entry</div>
              {matches.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-stone-500">
                  No match — <span className="text-red-700">[[{suggest.query}]]</span> will be a red link.
                </div>
              ) : (
                matches.map((m, i) => (
                  <button
                    key={m.slug}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertLink(m.title);
                    }}
                    className={`block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-[#faf7f1] ${i === 0 ? "bg-[#faf7f1]" : ""}`}
                  >
                    {m.title}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-[#b4532a] px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#9a4522] disabled:opacity-50"
          >
            {saving ? "Saving…" : mode === "create" ? "Create entry" : "Save changes"}
          </button>
          <button onClick={() => router.back()} className="rounded-lg px-4 py-2 text-sm text-stone-600 hover:bg-[#ece6da]">
            Cancel
          </button>
          <label className="ml-auto flex items-center gap-2 text-sm text-stone-600 lg:hidden">
            <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} /> Preview
          </label>
        </div>
      </div>

      <div className={`${preview ? "" : "hidden lg:block"} rounded-2xl border border-[#e6e0d4] bg-white p-6 sm:p-8`}>
        <div className="mb-4 text-[11px] uppercase tracking-wider text-stone-400">Live preview</div>
        {!/^#\s+/m.test(content) && <h1 className="mb-2 font-serif text-3xl font-semibold">{title || "Untitled"}</h1>}
        {summary && <p className="mb-4 font-serif italic text-stone-600">{summary}</p>}
        <Markdown content={content} resolve={resolve} />
      </div>
    </div>
  );
}
