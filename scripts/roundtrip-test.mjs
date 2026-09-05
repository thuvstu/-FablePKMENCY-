#!/usr/bin/env node
/**
 * Roundtrip portability test (PE principle 1: 単一の真実 + 可搬性).
 *
 * Flow: baseline counts → export → wipe ALL cards/boards → import →
 * counts must match exactly (cards, approved links, pending candidates,
 * boards, board placements, board edges).
 *
 * Usage:  node scripts/roundtrip-test.mjs [baseUrl]
 * Requires the production server to be running (default http://localhost:3000).
 * Exits non-zero on mismatch. Re-imports the backup on unexpected failure.
 */

const BASE = process.argv[2] ?? "http://localhost:3000";
const BACKUP_PATH = "/tmp/codex-roundtrip-backup.json";
import { writeFileSync } from "node:fs";

let failures = 0;
const check = (label, expected, actual) => {
  const ok = expected === actual;
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗ FAIL"} ${label}: expected ${expected}, got ${actual}`);
};

async function jget(path) {
  const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}
async function jsend(path, method, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return res.json();
}

/** Full snapshot of portable state, via public APIs only. */
async function snapshot() {
  const [cards, graph, boards, candidates] = await Promise.all([
    jget("/api/cards"),
    jget("/api/graph"),
    jget("/api/boards"),
    jget("/api/candidates"),
  ]);
  let placements = 0;
  let boardEdges = 0;
  for (const b of boards) {
    const detail = await jget(`/api/boards/${b.id}`);
    placements += detail.cards.length;
    boardEdges += detail.edges.length;
  }
  return {
    cards: cards.length,
    links: graph.edges.length,
    pendingCandidates: candidates.count,
    boards: boards.length,
    placements,
    boardEdges,
  };
}

async function wipeAll() {
  const boards = await jget("/api/boards");
  for (const b of boards) await jsend(`/api/boards/${b.id}`, "DELETE");
  const cards = await jget("/api/cards");
  for (const c of cards) await jsend(`/api/cards/${c.id}`, "DELETE");
}

async function reimportBackup() {
  const backup = JSON.parse((await import("node:fs")).readFileSync(BACKUP_PATH, "utf8"));
  await jsend("/api/import", "POST", backup);
}

console.log(`▶ Roundtrip portability test → ${BASE}`);
try {
  await jget("/api/health");
  console.log("✓ server healthy");

  const before = await snapshot();
  console.log("baseline:", JSON.stringify(before));

  // 1. Export (including approved links + approval workflow state)
  const exported = await jget("/api/export?format=json");
  writeFileSync(BACKUP_PATH, JSON.stringify(exported));
  if (!Array.isArray(exported.cards) || !Array.isArray(exported.links) || !Array.isArray(exported.boards)) {
    throw new Error("export format missing cards/links/boards arrays");
  }
  console.log(`✓ exported ${exported.cards.length} cards, ${exported.links.length} links, ${exported.boards.length} boards (backup: ${BACKUP_PATH})`);

  // 2. Wipe everything
  await wipeAll();
  const afterWipe = await snapshot();
  check("cards after wipe", 0, afterWipe.cards);
  if (afterWipe.cards !== 0) throw new Error("wipe incomplete");

  // 3. Import the export verbatim
  const result = await jsend("/api/import", "POST", exported);
  console.log("import result:", JSON.stringify(result));
  check("imported cards", exported.cards.length, result.cards);
  check("imported links", exported.links.length, result.links);
  check("imported boards", exported.boards.length, result.boards);

  // 4. Compare full state
  const after = await snapshot();
  console.log(comparing(before, after));
  function comparing(a, b) {
    const lines = ["comparing state:"];
    for (const k of Object.keys(a)) lines.push(`    ${k}: ${a[k]} → ${b[k]}`);
    return lines.join("\n");
  }
  check("cards", before.cards, after.cards);
  check("approved links", before.links, after.links);
  check("pending candidates", before.pendingCandidates, after.pendingCandidates);
  check("boards", before.boards, after.boards);
  check("board placements", before.placements, after.placements);
  check("board edges", before.boardEdges, after.boardEdges);
} catch (e) {
  console.error(`\n✗ FAIL (exception): ${e.message}`);
  console.error("attempting backup restore…");
  try {
    await reimportBackup();
    console.error("backup re-imported.");
  } catch (e2) {
    console.error(`restore also failed: ${e2.message}`);
  }
  process.exit(1);
}

if (failures > 0) {
  console.log(`\n✗ FAIL — ${failures} mismatches`);
  process.exit(1);
}
console.log("\n✓ PASS — export/import roundtrip is lossless");
