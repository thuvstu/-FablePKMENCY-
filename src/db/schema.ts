import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  real,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Cards = encyclopedia entries / atomic notes
// ---------------------------------------------------------------------------
export const cards = pgTable(
  "cards",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    content: text("content").notNull().default(""),
    category: text("category").notNull().default("General"),
    tags: text("tags").array().notNull().default([]),
    kind: text("kind").notNull().default("note"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("cards_slug_idx").on(t.slug), index("cards_category_idx").on(t.category)],
);

// Directed wiki-links extracted from [[Title]] syntax in card content.
export const links = pgTable(
  "links",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    targetId: integer("target_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("links_pair_idx").on(t.sourceId, t.targetId),
    index("links_target_idx").on(t.targetId),
  ],
);

// ---------------------------------------------------------------------------
// Whiteboards = spatial canvases holding cards (Heptabase style)
// ---------------------------------------------------------------------------
export const whiteboards = pgTable("whiteboards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const whiteboardCards = pgTable(
  "whiteboard_cards",
  {
    id: serial("id").primaryKey(),
    whiteboardId: integer("whiteboard_id")
      .notNull()
      .references(() => whiteboards.id, { onDelete: "cascade" }),
    cardId: integer("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    x: real("x").notNull().default(0),
    y: real("y").notNull().default(0),
    width: real("width").notNull().default(260),
    color: text("color").notNull().default("white"),
  },
  (t) => [uniqueIndex("wb_cards_pair_idx").on(t.whiteboardId, t.cardId)],
);

export const whiteboardEdges = pgTable(
  "whiteboard_edges",
  {
    id: serial("id").primaryKey(),
    whiteboardId: integer("whiteboard_id")
      .notNull()
      .references(() => whiteboards.id, { onDelete: "cascade" }),
    fromCardId: integer("from_card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    toCardId: integer("to_card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    label: text("label").notNull().default(""),
  },
  (t) => [index("wb_edges_board_idx").on(t.whiteboardId)],
);

// ---------------------------------------------------------------------------
// History principle (PersonalEncyclopedia §3): history is stored without
// limit; the *latest* state is always derived, never stored as truth.
// ---------------------------------------------------------------------------

/** Snapshot of a card before every update / at creation. */
export const cardRevisions = pgTable(
  "card_revisions",
  {
    id: serial("id").primaryKey(),
    cardId: integer("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    content: text("content").notNull().default(""),
    category: text("category").notNull().default("General"),
    tags: text("tags").array().notNull().default([]),
    kind: text("kind").notNull().default("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("revisions_card_idx").on(t.cardId)],
);

/** One SRS review event per row (full history, never updated). */
export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    cardId: integer("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    grade: integer("grade").notNull(), // 0=again, 1=hard, 2=good, 3=easy
    intervalDays: real("interval_days").notNull(),
    easeFactor: real("ease_factor").notNull(),
    repetition: integer("repetition").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reviews_card_idx").on(t.cardId)],
);

/** Activity log feeding streaks and the heatmap. */
export const progressEvents = pgTable(
  "progress_events",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(), // created | edited | reviewed | connected
    cardId: integer("card_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("progress_events_day_idx").on(t.createdAt)],
);

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type CardRevision = typeof cardRevisions.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Whiteboard = typeof whiteboards.$inferSelect;
export type WhiteboardCard = typeof whiteboardCards.$inferSelect;
export type WhiteboardEdge = typeof whiteboardEdges.$inferSelect;
