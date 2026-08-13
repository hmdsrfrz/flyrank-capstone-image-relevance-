import { test } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../src/db/pool.js";
import { rankImagesForPost, evaluateForcedPair } from "../src/guard/rankImages.js";

// Requires the DB to be migrated, seeded, and ingested first (npm run
// migrate && npm run seed && npm run ingest) -- these are integration tests
// against the real corpus, not isolated unit tests.

test("fox post ranks a fox image first", async () => {
  const { rows } = await pool.query(`SELECT id FROM posts WHERE slug = 'behavior-of-red-foxes'`);
  const result = await rankImagesForPost(rows[0].id);
  assert.ok(result.suggestion, "expected a suggestion");
  assert.match(result.suggestion.filename, /^fox-/);
});

test("forcing a wolf image onto the fox post is rejected with a category-mismatch reason", async () => {
  const { rows: postRows } = await pool.query(`SELECT id FROM posts WHERE slug = 'behavior-of-red-foxes'`);
  const { rows: imageRows } = await pool.query(`SELECT id FROM images WHERE filename = 'wolf-02.jpg'`);
  const result = await evaluateForcedPair(postRows[0].id, imageRows[0].id);
  assert.equal(result.decision, "rejected");
  assert.match(result.reason, /category mismatch/i);
});

test("a post with no matching category in the corpus returns no suggestion", async () => {
  const { rows } = await pool.query(`SELECT id FROM posts WHERE slug = 'morning-coffee-brewing-methods'`);
  const result = await rankImagesForPost(rows[0].id);
  assert.equal(result.suggestion, null);
});

test.after(async () => {
  await pool.end();
});
