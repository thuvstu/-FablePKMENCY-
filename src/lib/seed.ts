import { db } from "@/db";
import { cards, whiteboardCards, whiteboardEdges, whiteboards } from "@/db/schema";
import { sql } from "drizzle-orm";
import { createCard } from "./cards";

type SeedCard = { title: string; category: string; tags: string[]; summary: string; content: string };

const SEED: SeedCard[] = [
  {
    title: "Zettelkasten",
    category: "Method",
    tags: ["note-taking", "knowledge-management", "writing"],
    summary: "A slip-box method of networked note-taking popularised by sociologist Niklas Luhmann.",
    content: `# Zettelkasten

The **Zettelkasten** ("slip box") is a method of [[Personal Knowledge Management]] in which knowledge is stored as many small, atomic notes that are densely linked to one another. Its most famous practitioner was the sociologist [[Niklas Luhmann]], who credited the system for his extraordinary productivity of more than 70 books.

## Principles

- **Atomicity** — each note captures exactly one idea (see [[Atomic Notes]]).
- **Linking** — every note should be connected to at least one other note; links are how meaning emerges (see [[Bidirectional Links]]).
- **Own words** — notes are written as if for a reader who lacks your context.
- **Emergence** — structure is not imposed up front; it grows from the bottom up, like [[Emergence]] in complex systems.

## Relationship to spatial tools

Modern tools such as [[Heptabase]] extend the slip-box with a visual [[Whiteboard]] layer, letting the author *see* the shape of an argument instead of only following links.

> "Without writing, you cannot think; at least not in a sophisticated, connectable way." — Luhmann`,
  },
  {
    title: "Niklas Luhmann",
    category: "History",
    tags: ["sociology", "people", "note-taking"],
    summary: "German sociologist (1927–1998) known for systems theory and his 90,000-card slip box.",
    content: `# Niklas Luhmann

**Niklas Luhmann** (1927–1998) was a German sociologist and one of the most prolific social theorists of the 20th century. He is best known for his theory of social systems and, among knowledge workers, for his [[Zettelkasten]] of roughly 90,000 index cards.

## Working method

Luhmann described his slip box as a *communication partner*: when he queried it, it would return unexpected combinations of ideas. This is an early articulation of what we now call [[Emergence]] in a knowledge graph.

## Legacy

His archive is being digitised at Bielefeld University and remains a touchstone for [[Personal Knowledge Management]] practitioners.`,
  },
  {
    title: "Personal Knowledge Management",
    category: "Method",
    tags: ["knowledge-management", "productivity", "learning"],
    summary: "The practice of collecting, organising, and making sense of information for personal use.",
    content: `# Personal Knowledge Management

**Personal Knowledge Management (PKM)** describes the habits and tools an individual uses to capture, connect, and retrieve what they learn.

## Core loop

1. **Capture** fleeting ideas quickly.
2. **Connect** them into [[Atomic Notes]] with [[Bidirectional Links]].
3. **Cultivate** clusters into essays, projects, or [[Whiteboard]] maps.
4. **Create** new work from the accumulated network.

## Schools of thought

- The [[Zettelkasten]] tradition emphasises linking.
- The [[Commonplace Book]] tradition emphasises curated quotation.
- Spatial tools like [[Heptabase]] emphasise visual arrangement and [[Spatial Memory]].

PKM is closely related to the study of [[Memory]] and to the [[Feynman Technique]] of learning by explaining.`,
  },
  {
    title: "Atomic Notes",
    category: "Method",
    tags: ["note-taking", "writing"],
    summary: "Notes that each contain a single, self-contained idea so they can be recombined freely.",
    content: `# Atomic Notes

An **atomic note** expresses one idea completely and independently. Because it does not depend on surrounding text, it can be linked from many contexts — the property that makes the [[Zettelkasten]] work.

## Heuristics

- If a note needs a second heading, it is probably two notes.
- The title should be a *claim*, not a topic (e.g. "Spaced repetition beats cramming" rather than "Memory").
- Prefer many small cards on a [[Whiteboard]] to one large document.

Atomic notes pair naturally with [[Spaced Repetition]], since each card can be reviewed on its own.`,
  },
  {
    title: "Bidirectional Links",
    category: "Technology",
    tags: ["hypertext", "knowledge-management"],
    summary: "Links that are visible from both the source and the target, revealing backlinks automatically.",
    content: `# Bidirectional Links

A **bidirectional link** is a hyperlink whose target knows it has been linked to. In note-taking tools this manifests as a *backlinks* panel: every entry lists the other entries that reference it.

## History

The idea predates the web. [[Vannevar Bush]] imagined "associative trails" in his 1945 Memex essay, and [[Ted Nelson]]'s Project Xanadu specified two-way links decades before the one-way \`<a href>\` of HTML won out.

## Why it matters

Backlinks turn a pile of notes into a graph. Hubs with many incoming links become natural entry points — exactly how this encyclopedia surfaces its most-referenced entries.

See also: [[Hypertext]], [[Knowledge Graph]].`,
  },
  {
    title: "Vannevar Bush",
    category: "History",
    tags: ["people", "hypertext", "computing"],
    summary: "American engineer whose 1945 essay 'As We May Think' imagined the Memex.",
    content: `# Vannevar Bush

**Vannevar Bush** (1890–1974) headed the U.S. Office of Scientific Research and Development during WWII. In July 1945 he published *As We May Think*, describing the **Memex**: a desk that stores books and records on microfilm and lets the user build *associative trails* between them.

The Memex is widely regarded as the conceptual ancestor of [[Hypertext]] and of [[Bidirectional Links]]. It directly inspired [[Ted Nelson]] and Douglas Engelbart.`,
  },
  {
    title: "Ted Nelson",
    category: "History",
    tags: ["people", "hypertext", "computing"],
    summary: "Coined the word 'hypertext' in 1963 and founded Project Xanadu.",
    content: `# Ted Nelson

**Theodor Holm Nelson** (born 1937) coined the terms *hypertext* and *hypermedia* in 1963. His lifelong project, **Xanadu**, proposed a global document system with unbreakable two-way links, transclusion, and micropayments.

Although Xanadu never shipped in full, its ideas — especially [[Bidirectional Links]] and transclusion — resurfaced in modern [[Personal Knowledge Management]] tools. Nelson was inspired by [[Vannevar Bush]].`,
  },
  {
    title: "Hypertext",
    category: "Technology",
    tags: ["hypertext", "computing", "writing"],
    summary: "Text displayed on a screen with references (hyperlinks) to other text.",
    content: `# Hypertext

**Hypertext** is text that contains links to other text. The term was coined by [[Ted Nelson]]; the concept traces to [[Vannevar Bush]]'s Memex.

## Forms

- **One-way links** — the World Wide Web.
- **Two-way links** — see [[Bidirectional Links]].
- **Spatial hypertext** — arrangement on a plane carries meaning; see [[Whiteboard]] and [[Spatial Memory]].

An encyclopedia with wiki-links, such as this one, is a small hypertext system: every \`[[double bracket]]\` becomes an edge in a [[Knowledge Graph]].`,
  },
  {
    title: "Knowledge Graph",
    category: "Technology",
    tags: ["graphs", "knowledge-management", "data"],
    summary: "A network of entities and the relationships between them.",
    content: `# Knowledge Graph

A **knowledge graph** represents knowledge as *nodes* (concepts) and *edges* (relationships). In a personal wiki, each card is a node and each [[Bidirectional Links|link]] is an edge.

## Useful properties

- **Degree** — cards with many incoming links are hubs.
- **Clusters** — densely connected regions indicate a topic.
- **Bridges** — cards linking two clusters often hold the most original insight, a phenomenon related to [[Emergence]].

The mathematics of graphs was founded by [[Leonhard Euler]] with the Seven Bridges of Königsberg problem; see [[Graph Theory]].`,
  },
  {
    title: "Graph Theory",
    category: "Mathematics",
    tags: ["graphs", "mathematics"],
    summary: "The mathematical study of networks of vertices connected by edges.",
    content: `# Graph Theory

**Graph theory** studies structures made of vertices and edges. It began in 1736 when [[Leonhard Euler]] proved that the Seven Bridges of Königsberg could not be crossed exactly once each.

## Key ideas

- **Path** and **cycle**
- **Connectivity** and **components**
- **Degree distribution** — real networks such as a [[Knowledge Graph]] tend to be scale-free, with a few highly connected hubs.

Graph layouts (force-directed algorithms) are what make the graph view of a [[Personal Knowledge Management]] tool legible.`,
  },
  {
    title: "Leonhard Euler",
    category: "Mathematics",
    tags: ["people", "mathematics"],
    summary: "Swiss mathematician (1707–1783), founder of graph theory and the most prolific mathematician in history.",
    content: `# Leonhard Euler

**Leonhard Euler** (1707–1783) contributed to nearly every branch of mathematics. His 1736 paper on the Königsberg bridges founded [[Graph Theory]], and his notation (*e*, *i*, *f(x)*, Σ) is still in use.

Like [[Niklas Luhmann]], Euler is a case study in prolific output: he published more than 800 works, many dictated after he went blind.`,
  },
  {
    title: "Emergence",
    category: "Science",
    tags: ["complexity", "systems", "philosophy"],
    summary: "When a system exhibits properties its individual parts do not possess.",
    content: `# Emergence

**Emergence** occurs when interactions among simple components produce behaviour that none of the components has alone — flocking birds, ant colonies, consciousness, markets.

## In knowledge work

A [[Zettelkasten]] is designed for emergence: no single [[Atomic Notes|atomic note]] contains the thesis of a book, yet a thesis appears when enough notes are linked. [[Niklas Luhmann]] described his slip box "surprising" him for this reason.

## Related

- [[Knowledge Graph]] clusters are emergent structures.
- [[Spatial Memory]] lets the eye detect emergent patterns on a [[Whiteboard]].`,
  },
  {
    title: "Whiteboard",
    category: "Method",
    tags: ["spatial", "thinking-tools", "knowledge-management"],
    summary: "An infinite canvas on which cards are arranged spatially to reveal structure.",
    content: `# Whiteboard

In spatial note-taking tools such as [[Heptabase]], a **whiteboard** is an infinite two-dimensional canvas. Cards from the library are placed on it, dragged around, grouped, and connected with arrows.

## Why space helps

Humans have strong [[Spatial Memory]]. Putting two cards side by side is itself a statement; placing a card between two clusters suggests it bridges them. This is *spatial hypertext* — see [[Hypertext]].

## Practices

- Start a board per question, not per topic.
- Keep cards [[Atomic Notes|atomic]] so they can appear on many boards.
- Draw an edge only when you can name the relationship.

Boards in this app live under **Whiteboards** and reuse the same cards you see in the encyclopedia.`,
  },
  {
    title: "Heptabase",
    category: "Technology",
    tags: ["software", "spatial", "knowledge-management"],
    summary: "A visual note-taking app that combines a card library with infinite whiteboards.",
    content: `# Heptabase

**Heptabase** is a note-taking application built around the idea that *learning is a visual, spatial process*. Its core objects are:

- **Cards** — atomic markdown notes with [[Bidirectional Links]].
- **Whiteboards** — infinite canvases where cards are arranged and connected; see [[Whiteboard]].
- **Card Library** — a searchable, taggable index of every card, much like an encyclopedia.

The app is often cited as a synthesis of the [[Zettelkasten]] method with [[Spatial Memory]] research. This project is an homage to that model, fused with an encyclopedia layout.`,
  },
  {
    title: "Spatial Memory",
    category: "Psychology",
    tags: ["memory", "cognition", "spatial"],
    summary: "The part of memory responsible for recording information about one's environment and spatial orientation.",
    content: `# Spatial Memory

**Spatial memory** encodes *where* things are. It is ancient, robust, and largely automatic — you can recall where a paragraph sat on a page long after forgetting the words.

## Method of loci

Ancient orators exploited this with the **memory palace**, attaching facts to locations along an imagined route. It remains the dominant technique among memory athletes; see [[Memory]].

## Implications for tools

Spatial canvases like a [[Whiteboard]] outsource structure to this system, which is why [[Heptabase]]-style tools feel less effortful than nested folders.`,
  },
  {
    title: "Memory",
    category: "Psychology",
    tags: ["memory", "cognition", "learning"],
    summary: "The faculty by which the mind encodes, stores, and retrieves information.",
    content: `# Memory

**Memory** is usually modelled in three stages — encoding, storage, retrieval — and split into sensory, short-term (working), and long-term systems.

## Forgetting

Hermann Ebbinghaus measured the **forgetting curve** in 1885: retention decays exponentially unless refreshed. This is the empirical basis of [[Spaced Repetition]].

## Improving recall

- Retrieval practice (testing yourself)
- Elaboration — the [[Feynman Technique]]
- Leveraging [[Spatial Memory]] with a memory palace
- Externalising into a [[Personal Knowledge Management]] system so the brain can focus on connections`,
  },
  {
    title: "Spaced Repetition",
    category: "Method",
    tags: ["learning", "memory"],
    summary: "Reviewing material at increasing intervals to counteract the forgetting curve.",
    content: `# Spaced Repetition

**Spaced repetition** schedules reviews just before you would forget, expanding the interval each time you succeed. It is one of the most robust findings in the science of [[Memory]].

## Algorithms

- **Leitner boxes** (1970s) — physical card boxes.
- **SM-2** (1987) — the algorithm behind SuperMemo and Anki.
- **FSRS** (2022) — a modern, data-fitted scheduler.

Because [[Atomic Notes]] are already small and self-contained, they convert easily into review prompts.`,
  },
  {
    title: "Feynman Technique",
    category: "Method",
    tags: ["learning", "writing", "people"],
    summary: "Learning by explaining a concept in plain language as if to a child.",
    content: `# Feynman Technique

Named after physicist Richard Feynman, the **Feynman Technique** has four steps:

1. Choose a concept.
2. Explain it in simple words, as if teaching a twelve-year-old.
3. Notice where you stumble — that is the gap in your understanding.
4. Return to the source, then simplify further.

Writing [[Atomic Notes]] in your own words is the Feynman Technique applied continuously, which is why it sits at the heart of [[Personal Knowledge Management]] and helps consolidate [[Memory]].`,
  },
  {
    title: "Commonplace Book",
    category: "History",
    tags: ["note-taking", "writing", "history"],
    summary: "A personal compilation of quotations, ideas, and observations, popular from antiquity to the 19th century.",
    content: `# Commonplace Book

A **commonplace book** is a notebook in which a reader copies passages worth remembering, often organised under headings ("commonplaces"). Marcus Aurelius, John Locke, and Virginia Woolf all kept one.

Locke published a *New Method of Making Common-Place-Books* (1706) with an indexing scheme — an early [[Personal Knowledge Management]] system. The tradition contrasts with the [[Zettelkasten]]: commonplacing collects *others'* words, while the slip box records *your own*.`,
  },
  {
    title: "Stoicism",
    category: "Philosophy",
    tags: ["philosophy", "ethics", "history"],
    summary: "A Hellenistic philosophy teaching that virtue, reason, and acceptance of what we cannot control lead to a good life.",
    content: `# Stoicism

**Stoicism** was founded in Athens by Zeno of Citium around 300 BCE. Its central teaching is the *dichotomy of control*: some things are up to us (judgements, intentions), others are not (reputation, weather, other people).

## Practices

- Morning preparation and evening review — a form of journaling that resembles a [[Commonplace Book]].
- *Premeditatio malorum* — rehearsing setbacks in advance.
- Viewing events "from above" to gain perspective.

Marcus Aurelius' *Meditations* is itself a private notebook, making Stoicism an early example of writing as a thinking tool — a theme shared with [[Personal Knowledge Management]].`,
  },
  {
    title: "Gestalt Principles",
    category: "Psychology",
    tags: ["perception", "design", "cognition"],
    summary: "Laws describing how humans perceive grouped visual elements as unified wholes.",
    content: `# Gestalt Principles

Formulated by German psychologists in the 1920s, the **Gestalt principles** explain how perception organises parts into wholes:

- **Proximity** — near things belong together.
- **Similarity** — alike things belong together.
- **Closure** — we complete incomplete shapes.
- **Continuity** — we follow smooth paths.

These are precisely the cues a [[Whiteboard]] exploits: clustering cards (proximity), colour-coding them (similarity), and connecting them with edges (continuity). They are also a case of [[Emergence]] in perception.`,
  },
  {
    title: "Bauhaus",
    category: "Art",
    tags: ["design", "history", "art"],
    summary: "German art school (1919–1933) that unified craft and fine art and shaped modern design.",
    content: `# Bauhaus

The **Bauhaus** was founded by Walter Gropius in Weimar in 1919. Its curriculum merged crafts with fine arts and insisted that form follow function.

## Influence

Bauhaus typography and grid systems underpin modern interface design. Its preference for clarity over ornament echoes the [[Gestalt Principles]] developed in the same era and country, and it remains a reference point for tools like [[Heptabase]] that treat information design as a first-class concern.`,
  },
];

const BOARDS: {
  name: string;
  description: string;
  cards: { title: string; x: number; y: number; color: string }[];
  edges: { from: string; to: string; label: string }[];
}[] = [
  {
    name: "How networked notes produce ideas",
    description: "Tracing the lineage from slip boxes to spatial canvases.",
    cards: [
      { title: "Zettelkasten", x: 120, y: 200, color: "yellow" },
      { title: "Niklas Luhmann", x: 120, y: 480, color: "white" },
      { title: "Atomic Notes", x: 480, y: 80, color: "green" },
      { title: "Bidirectional Links", x: 480, y: 340, color: "blue" },
      { title: "Emergence", x: 860, y: 200, color: "purple" },
      { title: "Whiteboard", x: 860, y: 500, color: "pink" },
      { title: "Heptabase", x: 1240, y: 360, color: "white" },
    ],
    edges: [
      { from: "Niklas Luhmann", to: "Zettelkasten", label: "practised" },
      { from: "Zettelkasten", to: "Atomic Notes", label: "requires" },
      { from: "Zettelkasten", to: "Bidirectional Links", label: "requires" },
      { from: "Atomic Notes", to: "Emergence", label: "enables" },
      { from: "Bidirectional Links", to: "Emergence", label: "enables" },
      { from: "Emergence", to: "Whiteboard", label: "made visible by" },
      { from: "Whiteboard", to: "Heptabase", label: "core of" },
    ],
  },
  {
    name: "Memory & learning",
    description: "What cognitive science says about remembering what you read.",
    cards: [
      { title: "Memory", x: 500, y: 260, color: "yellow" },
      { title: "Spaced Repetition", x: 140, y: 120, color: "blue" },
      { title: "Feynman Technique", x: 140, y: 440, color: "green" },
      { title: "Spatial Memory", x: 880, y: 120, color: "purple" },
      { title: "Gestalt Principles", x: 880, y: 440, color: "pink" },
    ],
    edges: [
      { from: "Spaced Repetition", to: "Memory", label: "fights forgetting" },
      { from: "Feynman Technique", to: "Memory", label: "elaborates" },
      { from: "Memory", to: "Spatial Memory", label: "subsystem" },
      { from: "Spatial Memory", to: "Gestalt Principles", label: "perception" },
    ],
  },
];

export async function seedIfEmpty() {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(cards);
  if (n > 0) return false;

  const idByTitle = new Map<string, number>();
  for (const c of SEED) {
    const card = await createCard(c, { approveLinks: true });
    idByTitle.set(c.title, card.id);
  }

  for (const b of BOARDS) {
    const [board] = await db.insert(whiteboards).values({ name: b.name, description: b.description }).returning();
    await db.insert(whiteboardCards).values(
      b.cards.map((c) => ({ whiteboardId: board.id, cardId: idByTitle.get(c.title)!, x: c.x, y: c.y, color: c.color })),
    );
    await db.insert(whiteboardEdges).values(
      b.edges.map((e) => ({
        whiteboardId: board.id,
        fromCardId: idByTitle.get(e.from)!,
        toCardId: idByTitle.get(e.to)!,
        label: e.label,
      })),
    );
  }
  return true;
}
