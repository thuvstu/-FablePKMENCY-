export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "entry";
}

/** Extract all [[Target]] / [[Target|alias]] link targets from markdown. */
export function extractWikiLinks(content: string): string[] {
  const out = new Set<string>();
  const re = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    const t = m[1].trim();
    if (t) out.add(t);
  }
  return [...out];
}

export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

export const CARD_COLORS = [
  { id: "white", label: "Paper", bg: "#ffffff", border: "#e7e2d8" },
  { id: "yellow", label: "Sun", bg: "#fff6c9", border: "#f1de83" },
  { id: "green", label: "Moss", bg: "#e4f3e0", border: "#a9d6a0" },
  { id: "blue", label: "Sky", bg: "#e1efff", border: "#a5c8f5" },
  { id: "pink", label: "Rose", bg: "#fde5ec", border: "#f2adc1" },
  { id: "purple", label: "Iris", bg: "#ede4ff", border: "#c4aef5" },
] as const;

export function colorStyle(id: string) {
  return CARD_COLORS.find((c) => c.id === id) ?? CARD_COLORS[0];
}

export const CATEGORY_COLORS: Record<string, string> = {
  Science: "bg-sky-100 text-sky-800 ring-sky-200",
  Philosophy: "bg-violet-100 text-violet-800 ring-violet-200",
  History: "bg-amber-100 text-amber-800 ring-amber-200",
  Technology: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  Mathematics: "bg-rose-100 text-rose-800 ring-rose-200",
  Art: "bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-200",
  Psychology: "bg-teal-100 text-teal-800 ring-teal-200",
  Method: "bg-orange-100 text-orange-800 ring-orange-200",
  General: "bg-stone-100 text-stone-700 ring-stone-200",
};

export function categoryClass(cat: string) {
  return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.General;
}
