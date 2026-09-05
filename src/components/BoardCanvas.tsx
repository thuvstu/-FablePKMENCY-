"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Markdown } from "./Markdown";
import { CARD_COLORS, categoryClass, colorStyle, normalizeTitle, slugify } from "@/lib/wiki";

export type PlacedCard = {
  id: number;
  cardId: number;
  x: number;
  y: number;
  width: number;
  color: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: string;
  tags: string[];
};
export type Edge = { id: number; fromCardId: number; toCardId: number; label: string };
type LibCard = { id: number; title: string; slug: string; summary: string; category: string; tags: string[] };

type Props = {
  board: { id: number; name: string; description: string };
  initialCards: PlacedCard[];
  initialEdges: Edge[];
  allTitles: { title: string; slug: string }[];
  focusCardId?: number;
};

const CARD_W = 260;

export default function BoardCanvas({ board, initialCards, initialEdges, allTitles, focusCardId }: Props) {
  const router = useRouter();
  const [placed, setPlaced] = useState<PlacedCard[]>(initialCards);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [tf, setTf] = useState({ x: 80, y: 80, k: 1 });
  const [selected, setSelected] = useState<number | null>(focusCardId ?? null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [connectFrom, setConnectFrom] = useState<number | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [lib, setLib] = useState<LibCard[]>([]);
  const [libQ, setLibQ] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [sizes, setSizes] = useState<Record<number, { w: number; h: number }>>({});
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(board.name);

  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ type: "pan" | "card"; cardId?: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const tfRef = useRef(tf);
  tfRef.current = tf;

  const byTitle = useMemo(() => new Map(allTitles.map((c) => [normalizeTitle(c.title), c.slug])), [allTitles]);
  const resolve = useCallback((t: string) => byTitle.get(normalizeTitle(t)) ?? slugify(t), [byTitle]);

  // ---- library ---------------------------------------------------------
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/cards?q=${encodeURIComponent(libQ)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then(setLib)
        .catch(() => {});
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [libQ]);

  // ---- measuring cards for edge anchors --------------------------------
  useEffect(() => {
    roRef.current = new ResizeObserver((entries) => {
      setSizes((prev) => {
        const next = { ...prev };
        for (const e of entries) {
          const id = Number((e.target as HTMLElement).dataset.cardid);
          next[id] = { w: e.target.clientWidth, h: e.target.clientHeight };
        }
        return next;
      });
    });
    return () => roRef.current?.disconnect();
  }, []);
  const observe = useCallback((el: HTMLDivElement | null) => {
    if (el) roRef.current?.observe(el);
  }, []);

  // ---- focus on a card from ?focus= -----------------------------------
  useEffect(() => {
    if (!focusCardId || !viewportRef.current) return;
    const c = initialCards.find((p) => p.cardId === focusCardId);
    if (!c) return;
    const vp = viewportRef.current.getBoundingClientRect();
    setTf({ k: 1, x: vp.width / 2 - c.x - CARD_W / 2, y: vp.height / 2 - c.y - 80 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- zoom with wheel (non-passive) -----------------------------------
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cur = tfRef.current;
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const factor = Math.exp(-e.deltaY * 0.0015);
        const k = Math.min(2.5, Math.max(0.2, cur.k * factor));
        const wx = (mx - cur.x) / cur.k;
        const wy = (my - cur.y) / cur.k;
        setTf({ k, x: mx - wx * k, y: my - wy * k });
      } else {
        setTf({ ...cur, x: cur.x - e.deltaX, y: cur.y - e.deltaY });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (f: number) => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;
    const k = Math.min(2.5, Math.max(0.2, tf.k * f));
    const wx = (mx - tf.x) / tf.k;
    const wy = (my - tf.y) / tf.k;
    setTf({ k, x: mx - wx * k, y: my - wy * k });
  };

  const fitAll = () => {
    const el = viewportRef.current;
    if (!el || placed.length === 0) return;
    const rect = el.getBoundingClientRect();
    const xs = placed.map((p) => p.x);
    const ys = placed.map((p) => p.y);
    const minX = Math.min(...xs) - 40;
    const minY = Math.min(...ys) - 40;
    const maxX = Math.max(...placed.map((p) => p.x + (sizes[p.cardId]?.w ?? CARD_W))) + 40;
    const maxY = Math.max(...placed.map((p) => p.y + (sizes[p.cardId]?.h ?? 120))) + 40;
    const k = Math.min(1.5, Math.max(0.2, Math.min(rect.width / (maxX - minX), rect.height / (maxY - minY))));
    setTf({ k, x: (rect.width - (maxX - minX) * k) / 2 - minX * k, y: (rect.height - (maxY - minY) * k) / 2 - minY * k });
  };

  // ---- persistence helpers ---------------------------------------------
  const persistPositions = useCallback(
    async (updates: { cardId: number; x?: number; y?: number; color?: string }[]) => {
      setSaving(true);
      await fetch(`/api/boards/${board.id}/cards`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      }).catch(() => {});
      setSaving(false);
    },
    [board.id],
  );

  // ---- pointer handling ------------------------------------------------
  const onPointerDownBg = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { type: "pan", sx: e.clientX, sy: e.clientY, ox: tf.x, oy: tf.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerDownCard = (e: React.PointerEvent, cardId: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (connectMode) {
      if (connectFrom === null) setConnectFrom(cardId);
      else if (connectFrom !== cardId) void addEdge(connectFrom, cardId);
      return;
    }
    const p = placed.find((c) => c.cardId === cardId)!;
    dragRef.current = { type: "card", cardId, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, moved: false };
    setSelected(cardId);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true;
    if (d.type === "pan") setTf((t) => ({ ...t, x: d.ox + dx, y: d.oy + dy }));
    else setPlaced((ps) => ps.map((p) => (p.cardId === d.cardId ? { ...p, x: d.ox + dx / tf.k, y: d.oy + dy / tf.k } : p)));
  };
  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.type === "pan" && !d.moved) {
      setSelected(null);
      setConnectFrom(null);
    }
    if (d.type === "card" && d.moved && d.cardId !== undefined) {
      const p = placed.find((c) => c.cardId === d.cardId);
      if (p) void persistPositions([{ cardId: p.cardId, x: Math.round(p.x), y: Math.round(p.y) }]);
    }
  };

  // ---- mutations --------------------------------------------------------
  const viewCenter = () => {
    const el = viewportRef.current;
    if (!el) return { x: 100, y: 100 };
    const r = el.getBoundingClientRect();
    return { x: (r.width / 2 - tf.x) / tf.k - CARD_W / 2, y: (r.height / 2 - tf.y) / tf.k - 60 };
  };

  async function addExisting(c: LibCard) {
    if (placed.some((p) => p.cardId === c.id)) {
      setSelected(c.id);
      return;
    }
    const pos = viewCenter();
    const jitter = () => (Math.random() - 0.5) * 60;
    const res = await fetch(`/api/boards/${board.id}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: c.id, x: Math.round(pos.x + jitter()), y: Math.round(pos.y + jitter()) }),
    });
    if (!res.ok) return;
    const { placed: pl, card } = await res.json();
    if (!pl) return;
    setPlaced((ps) => [...ps, { ...pl, title: card.title, slug: card.slug, summary: card.summary, content: card.content, category: card.category, tags: card.tags }]);
    setSelected(c.id);
  }

  async function createAndAdd() {
    const t = newTitle.trim();
    if (!t) return;
    const pos = viewCenter();
    const res = await fetch(`/api/boards/${board.id}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t, content: `# ${t}\n\n`, x: Math.round(pos.x), y: Math.round(pos.y), color: "yellow" }),
    });
    if (!res.ok) return;
    const { placed: pl, card } = await res.json();
    setPlaced((ps) => [...ps, { ...pl, title: card.title, slug: card.slug, summary: card.summary, content: card.content, category: card.category, tags: card.tags }]);
    setNewTitle("");
    setSelected(card.id);
    router.refresh();
  }

  async function removeFromBoard(cardId: number) {
    setPlaced((ps) => ps.filter((p) => p.cardId !== cardId));
    setEdges((es) => es.filter((e) => e.fromCardId !== cardId && e.toCardId !== cardId));
    setSelected(null);
    await fetch(`/api/boards/${board.id}/cards`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId }) });
  }

  async function recolor(cardId: number, color: string) {
    setPlaced((ps) => ps.map((p) => (p.cardId === cardId ? { ...p, color } : p)));
    await persistPositions([{ cardId, color }]);
  }

  async function addEdge(from: number, to: number) {
    setConnectFrom(null);
    if (edges.some((e) => e.fromCardId === from && e.toCardId === to)) return;
    const label = window.prompt("Name the relationship (optional):", "") ?? "";
    const res = await fetch(`/api/boards/${board.id}/edges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromCardId: from, toCardId: to, label }),
    });
    if (res.ok) {
      const created: Edge = await res.json();
      setEdges((es) => [...es, created]);
    }
  }

  async function editEdge(edge: Edge) {
    const label = window.prompt("Edge label (leave empty and OK to keep, type 'delete' to remove):", edge.label);
    if (label === null) return;
    if (label.trim().toLowerCase() === "delete") {
      setEdges((es) => es.filter((e) => e.id !== edge.id));
      await fetch(`/api/boards/${board.id}/edges`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: edge.id }) });
      return;
    }
    setEdges((es) => es.map((e) => (e.id === edge.id ? { ...e, label } : e)));
    await fetch(`/api/boards/${board.id}/edges`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: edge.id, label }) });
  }

  async function renameBoard() {
    if (name.trim() && name !== board.name) {
      await fetch(`/api/boards/${board.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      router.refresh();
    }
  }

  async function deleteBoard() {
    if (!confirm(`Delete board “${board.name}”? Cards themselves are kept.`)) return;
    await fetch(`/api/boards/${board.id}`, { method: "DELETE" });
    router.push("/boards");
    router.refresh();
  }

  // Keyboard: Delete removes selected card; Escape cancels connect; C toggles connect.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") {
        setConnectFrom(null);
        setConnectMode(false);
        setSelected(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selected !== null) void removeFromBoard(selected);
      if (e.key.toLowerCase() === "c") setConnectMode((m) => !m);
      if (e.key.toLowerCase() === "f") fitAll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, placed, sizes]);

  // ---- geometry ---------------------------------------------------------
  const center = (cardId: number) => {
    const p = placed.find((c) => c.cardId === cardId);
    if (!p) return null;
    const s = sizes[cardId] ?? { w: CARD_W, h: 100 };
    return { x: p.x + s.w / 2, y: p.y + s.h / 2, w: s.w, h: s.h };
  };
  const anchor = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number }) => {
    // intersect ray from a's center toward b with a's rectangle
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 0 && dy === 0) return { x: a.x, y: a.y };
    const sx = a.w / 2 / Math.abs(dx || 1e-6);
    const sy = a.h / 2 / Math.abs(dy || 1e-6);
    const s = Math.min(sx, sy);
    return { x: a.x + dx * s, y: a.y + dy * s };
  };

  const placedIds = new Set(placed.map((p) => p.cardId));
  const selectedCard = placed.find((p) => p.cardId === selected);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Sidebar: card library */}
      <aside className={`${sidebarOpen ? "w-80" : "w-0"} flex shrink-0 flex-col border-r border-[#e6e0d4] bg-white transition-all`}>
        {sidebarOpen && (
          <>
            <div className="border-b border-[#e6e0d4] p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">Card library</div>
              <input
                value={libQ}
                onChange={(e) => setLibQ(e.target.value)}
                placeholder="Search entries to place…"
                className="w-full rounded-md border border-[#ddd5c7] px-3 py-1.5 text-sm outline-none focus:border-[#b4532a]"
              />
              <form
                className="mt-2 flex gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  void createAndAdd();
                }}
              >
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="New card title…"
                  className="min-w-0 flex-1 rounded-md border border-[#ddd5c7] px-3 py-1.5 text-sm outline-none focus:border-[#b4532a]"
                />
                <button className="rounded-md bg-[#b4532a] px-2.5 text-sm text-white hover:bg-[#9a4522]">+</button>
              </form>
            </div>
            <ul className="thin-scroll flex-1 overflow-y-auto p-2">
              {lib.map((c) => {
                const on = placedIds.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => addExisting(c)}
                      className={`mb-1 w-full rounded-lg border p-2 text-left transition ${
                        on ? "border-[#e6e0d4] bg-[#faf7f1] opacity-70" : "border-transparent hover:border-[#ddd5c7] hover:bg-[#faf7f1]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="truncate font-serif text-sm font-semibold">{c.title}</span>
                        {on && <span className="ml-auto text-[10px] text-stone-400">on board</span>}
                      </div>
                      <div className="line-clamp-1 text-xs text-stone-500">{c.summary}</div>
                    </button>
                  </li>
                );
              })}
              {lib.length === 0 && <li className="p-3 text-sm text-stone-400">No cards match.</li>}
            </ul>
          </>
        )}
      </aside>

      {/* Canvas */}
      <div className="relative flex-1">
        {/* Toolbar */}
        <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen((s) => !s)}
            className="rounded-md border border-[#ddd5c7] bg-white px-2 py-1.5 text-sm shadow-sm hover:bg-[#faf7f1]"
            title="Toggle library"
          >
            {sidebarOpen ? "◀" : "▶"}
          </button>
          <div className="flex items-center gap-2 rounded-md border border-[#ddd5c7] bg-white px-3 py-1.5 shadow-sm">
            <Link href="/boards" className="text-xs text-stone-500 hover:text-[#b4532a]">
              Boards /
            </Link>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={renameBoard}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="w-56 bg-transparent font-serif text-sm font-semibold outline-none"
            />
          </div>
          <button
            onClick={() => {
              setConnectMode((m) => !m);
              setConnectFrom(null);
            }}
            className={`rounded-md border px-3 py-1.5 text-sm shadow-sm ${
              connectMode ? "border-[#b4532a] bg-[#b4532a] text-white" : "border-[#ddd5c7] bg-white hover:bg-[#faf7f1]"
            }`}
            title="Connect cards (C)"
          >
            ⟶ Connect{connectMode && (connectFrom ? ": pick target" : ": pick source")}
          </button>
          <span className="text-xs text-stone-400">{saving ? "Saving…" : "Saved"}</span>
        </div>

        <div className="absolute right-3 top-3 z-20 flex items-center gap-1">
          <button onClick={() => zoomBy(1 / 1.2)} className="rounded-md border border-[#ddd5c7] bg-white px-2.5 py-1.5 text-sm shadow-sm hover:bg-[#faf7f1]">
            −
          </button>
          <span className="w-12 text-center text-xs text-stone-500">{Math.round(tf.k * 100)}%</span>
          <button onClick={() => zoomBy(1.2)} className="rounded-md border border-[#ddd5c7] bg-white px-2.5 py-1.5 text-sm shadow-sm hover:bg-[#faf7f1]">
            +
          </button>
          <button onClick={fitAll} className="rounded-md border border-[#ddd5c7] bg-white px-2.5 py-1.5 text-sm shadow-sm hover:bg-[#faf7f1]" title="Fit (F)">
            Fit
          </button>
          <button onClick={deleteBoard} className="ml-2 rounded-md border border-[#ddd5c7] bg-white px-2.5 py-1.5 text-sm text-stone-500 shadow-sm hover:border-red-200 hover:bg-red-50 hover:text-red-700">
            Delete board
          </button>
        </div>

        {/* Help */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-md bg-white/80 px-3 py-1.5 text-[11px] text-stone-500 shadow-sm backdrop-blur">
          Drag background to pan · ⌘/Ctrl + scroll to zoom · Drag card header to move · <kbd>C</kbd> connect · <kbd>F</kbd> fit · <kbd>Del</kbd> remove
        </div>

        {/* Selected card inspector */}
        {selectedCard && (
          <div className="absolute bottom-3 right-3 z-20 w-64 rounded-xl border border-[#e6e0d4] bg-white p-3 shadow-lg">
            <div className="mb-1 font-serif text-sm font-semibold">{selectedCard.title}</div>
            <div className="mb-2 flex gap-1.5">
              {CARD_COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => recolor(selectedCard.cardId, c.id)}
                  title={c.label}
                  className={`h-5 w-5 rounded-full ring-2 ${selectedCard.color === c.id ? "ring-[#1f1b16]" : "ring-transparent"}`}
                  style={{ background: c.bg, border: `1px solid ${c.border}` }}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <Link href={`/wiki/${selectedCard.slug}`} className="rounded-md border border-[#ddd5c7] px-2 py-1 hover:bg-[#faf7f1]">
                Open entry
              </Link>
              <Link href={`/wiki/${selectedCard.slug}/edit`} className="rounded-md border border-[#ddd5c7] px-2 py-1 hover:bg-[#faf7f1]">
                Edit
              </Link>
              <button
                onClick={() => {
                  setConnectMode(true);
                  setConnectFrom(selectedCard.cardId);
                }}
                className="rounded-md border border-[#ddd5c7] px-2 py-1 hover:bg-[#faf7f1]"
              >
                Connect from
              </button>
              <button onClick={() => removeFromBoard(selectedCard.cardId)} className="rounded-md border border-transparent px-2 py-1 text-red-700 hover:bg-red-50">
                Remove
              </button>
            </div>
          </div>
        )}

        <div
          ref={viewportRef}
          className={`paper-grid absolute inset-0 touch-none select-none overflow-hidden ${connectMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}`}
          onPointerDown={onPointerDownBg}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ backgroundPosition: `${tf.x}px ${tf.y}px`, backgroundSize: `${24 * tf.k}px ${24 * tf.k}px` }}
        >
          <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${tf.x}px, ${tf.y}px) scale(${tf.k})` }}>
            {/* Edges */}
            <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#8a7f70" />
                </marker>
              </defs>
              {edges.map((e) => {
                const a = center(e.fromCardId);
                const b = center(e.toCardId);
                if (!a || !b) return null;
                const p1 = anchor(a, b);
                const p2 = anchor(b, a);
                const mx = (p1.x + p2.x) / 2;
                const my = (p1.y + p2.y) / 2;
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const c1 = { x: p1.x + dx * 0.4, y: p1.y };
                const c2 = { x: p2.x - dx * 0.4, y: p2.y };
                const d = Math.abs(dx) > Math.abs(dy) ? `M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}` : `M ${p1.x} ${p1.y} C ${p1.x} ${p1.y + dy * 0.4}, ${p2.x} ${p2.y - dy * 0.4}, ${p2.x} ${p2.y}`;
                return (
                  <g key={e.id} className="pointer-events-auto cursor-pointer" onClick={() => editEdge(e)}>
                    <path d={d} fill="none" stroke="transparent" strokeWidth="14" />
                    <path d={d} fill="none" stroke="#8a7f70" strokeWidth="1.8" markerEnd="url(#arrow)" />
                    {e.label && (
                      <>
                        <rect x={mx - e.label.length * 3.4 - 6} y={my - 10} width={e.label.length * 6.8 + 12} height={20} rx={10} fill="#faf7f1" stroke="#ddd5c7" />
                        <text x={mx} y={my + 4} textAnchor="middle" fontSize="11" fill="#5b5248">
                          {e.label}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Cards */}
            {placed.map((p) => {
              const col = colorStyle(p.color);
              const isSel = selected === p.cardId;
              const isFrom = connectFrom === p.cardId;
              const open = expanded.has(p.cardId);
              return (
                <div
                  key={p.cardId}
                  ref={observe}
                  data-cardid={p.cardId}
                  className={`absolute rounded-xl shadow-md transition-shadow ${isSel || isFrom ? "shadow-xl ring-2 ring-[#b4532a]" : "hover:shadow-lg"}`}
                  style={{ left: p.x, top: p.y, width: CARD_W, background: col.bg, border: `1px solid ${col.border}` }}
                  onPointerDown={(e) => onPointerDownCard(e, p.cardId)}
                >
                  <div className="flex cursor-move items-start gap-2 px-3 pt-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-serif text-[15px] font-semibold leading-tight">{p.title}</div>
                      <span className={`mt-1 inline-block rounded-full px-1.5 py-px text-[10px] ring-1 ${categoryClass(p.category)}`}>{p.category}</span>
                    </div>
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() =>
                        setExpanded((s) => {
                          const n = new Set(s);
                          if (n.has(p.cardId)) n.delete(p.cardId);
                          else n.add(p.cardId);
                          return n;
                        })
                      }
                      className="rounded px-1 text-xs text-stone-500 hover:bg-black/5"
                      title={open ? "Collapse" : "Expand"}
                    >
                      {open ? "▴" : "▾"}
                    </button>
                  </div>
                  <div className="px-3 pb-3 pt-1.5" onPointerDown={(e) => open && e.stopPropagation()}>
                    {open ? (
                      <div className="max-h-72 cursor-auto overflow-y-auto thin-scroll">
                        <Markdown content={p.content} resolve={resolve} compact />
                      </div>
                    ) : (
                      <p className="line-clamp-3 text-xs leading-snug text-stone-600">{p.summary || p.content.replace(/^#.*$/m, "").trim().slice(0, 140)}</p>
                    )}
                  </div>
                </div>
              );
            })}

            {placed.length === 0 && (
              <div className="absolute left-40 top-40 w-96 rounded-2xl border border-dashed border-[#c9c0b0] bg-white/70 p-6 text-center text-stone-500">
                <div className="font-serif text-lg font-semibold text-stone-700">Empty board</div>
                <p className="mt-1 text-sm">Pick entries from the library on the left, or create a new card to start thinking spatially.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
