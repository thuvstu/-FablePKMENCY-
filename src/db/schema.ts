import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  real,
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

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type Whiteboard = typeof whiteboards.$inferSelect;
export type WhiteboardCard = typeof whiteboardCards.$inferSelect;
export type WhiteboardEdge = typeof whiteboardEdges.$inferSelect;
