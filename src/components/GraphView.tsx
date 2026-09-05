"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Node = { id: number; title: string; slug: string; category: string; x: number; y: number; vx: number; vy: number; deg: number };
type Edge = { source: number; target: number };

const PALETTE: Record<string, string> = {
  Science: "#0284c7",
  Philosophy: "#7c3aed",
  History: "#d97706",
  Technology: "#059669",
  Mathematics: "#e11d48",
  Art: "#c026d3",
  Psychology: "#0d9488",
  Method: "#ea580c",
  General: "#78716c",
};

export default function GraphView({
  nodes: rawNodes,
  edges,
}: {
  nodes: { id: number; title: string; slug: string; category: string }[];
  edges: Edge[];
}) {
  const W = 1200;
  const H = 760;
  const [nodes, setNodes] = useState<Node[]>(() => {
    const deg = new Map<number, number>();
    for (const e of edges) {
      deg.set(e.source, (deg.get(e.source) ?? 0) + 1);
      deg.set(e.target, (deg.get(e.target) ?? 0) + 1);
    }
    return rawNodes.map((n, i) => {
      const a = (i / Math.max(1, rawNodes.length)) * Math.PI * 2;
      const r = 200 + (i % 3) * 60;
      return { ...n, x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r, vx: 0, vy: 0, deg: deg.get(n.id) ?? 0 };
    });
  });
  const [hover, setHover] = useState<number | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [tf, setTf] = useState({ x: 0, y: 0, k: 1 });
  const router = useRouter();
  const movedRef = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const panRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const alphaRef = useRef(1);
  const dragRef = useRef<number | null>(null);
  dragRef.current = drag;

  const idx = useMemo(() => new Map(nodes.map((n, i) => [n.id, i])), [nodes]);

  // Simple force simulation (repulsion + springs + centering)
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (alphaRef.current > 0.005) {
        setNodes((prev) => {
          const ns = prev.map((n) => ({ ...n }));
          const alpha = alphaRef.current;
          for (let i = 0; i < ns.length; i++) {
            for (let j = i + 1; j < ns.length; j++) {
              let dx = ns[j].x - ns[i].x;
              let dy = ns[j].y - ns[i].y;
              let d2 = dx * dx + dy * dy;
              if (d2 < 1) {
                dx = Math.random() - 0.5;
                dy = Math.random() - 0.5;
                d2 = 1;
              }
              const f = (5200 * alpha) / d2;
              const d = Math.sqrt(d2);
              const fx = (dx / d) * f;
              const fy = (dy / d) * f;
              ns[i].vx -= fx;
              ns[i].vy -= fy;
              ns[j].vx += fx;
              ns[j].vy += fy;
            }
          }
          for (const e of edges) {
            const a = ns[idx.get(e.source)!];
            const b = ns[idx.get(e.target)!];
            if (!a || !b) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            const f = (d - 140) * 0.02 * alpha;
            const fx = (dx / d) * f;
            const fy = (dy / d) * f;
            a.vx += fx;
            a.vy += fy;
            b.vx -= fx;
            b.vy -= fy;
          }
          for (const n of ns) {
            n.vx += (W / 2 - n.x) * 0.004 * alpha;
            n.vy += (H / 2 - n.y) * 0.004 * alpha;
            if (n.id === dragRef.current) {
              n.vx = 0;
              n.vy = 0;
              continue;
            }
            n.vx *= 0.82;
            n.vy *= 0.82;
            n.x += n.vx;
            n.y += n.vy;
          }
          return ns;
        });
        alphaRef.current *= 0.985;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [edges, idx]);

  const neighbors = useMemo(() => {
    const m = new Map<number, Set<number>>();
    for (const e of edges) {
      if (!m.has(e.source)) m.set(e.source, new Set());
      if (!m.has(e.target)) m.set(e.target, new Set());
      m.get(e.source)!.add(e.target);
      m.get(e.target)!.add(e.source);
    }
    return m;
  }, [edges]);

  const toWorld = (clientX: number, clientY: number) => {
    const svg = svgRef.current!;
    const r = svg.getBoundingClientRect();
    const sx = (clientX - r.left) * (W / r.width);
    const sy = (clientY - r.top) * (H / r.height);
    return { x: (sx - tf.x) / tf.k, y: (sy - tf.y) / tf.k };
  };

  const hoverNode = hover !== null ? nodes[idx.get(hover)!] : null;
  const categories = [...new Set(rawNodes.map((n) => n.category))];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#e6e0d4] bg-white shadow-sm">
      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2 rounded-lg bg-white/85 p-2 text-xs backdrop-blur">
        {categories.map((c) => (
          <span key={c} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[c] ?? PALETTE.General }} />
            {c}
          </span>
        ))}
      </div>
      <div className="absolute right-3 top-3 z-10 flex gap-1">
        <button onClick={() => setTf((t) => ({ ...t, k: Math.max(0.3, t.k / 1.2) }))} className="rounded border border-[#ddd5c7] bg-white px-2 py-1 text-sm">
          −
        </button>
        <button onClick={() => setTf((t) => ({ ...t, k: Math.min(3, t.k * 1.2) }))} className="rounded border border-[#ddd5c7] bg-white px-2 py-1 text-sm">
          +
        </button>
        <button
          onClick={() => {
            setTf({ x: 0, y: 0, k: 1 });
            alphaRef.current = 1;
          }}
          className="rounded border border-[#ddd5c7] bg-white px-2 py-1 text-sm"
        >
          Reset
        </button>
      </div>
      {hoverNode && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg bg-[#1f1b16] px-3 py-2 text-sm text-white shadow-lg">
          <div className="font-serif font-semibold">{hoverNode.title}</div>
          <div className="text-xs opacity-70">
            {hoverNode.category} · {hoverNode.deg} リンク · クリックで開く
          </div>
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-[70vh] w-full cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={(e) => {
          if ((e.target as Element).tagName === "svg" || (e.target as Element).tagName === "rect") {
            panRef.current = { sx: e.clientX, sy: e.clientY, ox: tf.x, oy: tf.y };
          }
        }}
        onPointerMove={(e) => {
          if (drag !== null) {
            movedRef.current = true;
            const p = toWorld(e.clientX, e.clientY);
            setNodes((ns) => ns.map((n) => (n.id === drag ? { ...n, x: p.x, y: p.y } : n)));
            alphaRef.current = Math.max(alphaRef.current, 0.3);
          } else if (panRef.current) {
            const r = svgRef.current!.getBoundingClientRect();
            const sc = W / r.width;
            setTf((t) => ({ ...t, x: panRef.current!.ox + (e.clientX - panRef.current!.sx) * sc, y: panRef.current!.oy + (e.clientY - panRef.current!.sy) * sc }));
          }
        }}
        onPointerUp={() => {
          setDrag(null);
          panRef.current = null;
        }}
      >
        <rect width={W} height={H} fill="transparent" />
        <g transform={`translate(${tf.x} ${tf.y}) scale(${tf.k})`}>
          {edges.map((e, i) => {
            const a = nodes[idx.get(e.source)!];
            const b = nodes[idx.get(e.target)!];
            if (!a || !b) return null;
            const lit = hover === null || hover === e.source || hover === e.target;
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={lit ? "#a8a29e" : "#eee8dd"} strokeWidth={lit && hover !== null ? 2 : 1.2} />;
          })}
          {nodes.map((n) => {
            const r = 6 + Math.sqrt(n.deg) * 3.5;
            const dim = hover !== null && hover !== n.id && !neighbors.get(hover)?.has(n.id);
            return (
              <g
                key={n.id}
                transform={`translate(${n.x} ${n.y})`}
                opacity={dim ? 0.25 : 1}
                onPointerEnter={() => setHover(n.id)}
                onPointerLeave={() => setHover(null)}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  movedRef.current = false;
                  setDrag(n.id);
                }}
                onClick={() => {
                  if (!movedRef.current) router.push(`/wiki/${n.slug}`);
                }}
                className="cursor-pointer"
              >
                <circle r={r} fill={PALETTE[n.category] ?? PALETTE.General} stroke="#fff" strokeWidth="2" />
                <Link href={`/wiki/${n.slug}`}>
                  <text y={r + 13} textAnchor="middle" fontSize="11" fill="#2a2520" className="pointer-events-auto" fontFamily="var(--font-serif)">
                    {n.title}
                  </text>
                </Link>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
