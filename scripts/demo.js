import { execSync } from "node:child_process";
import "dotenv/config";
import { pool } from "../src/db/pool.js";
import { rankImagesForPost, evaluateForcedPair } from "../src/guard/rankImages.js";

function section(title) {
  console.log(`\n${"=".repeat(60)}\n${title}\n${"=".repeat(60)}`);
}

async function postBySlug(slug) {
  const { rows } = await pool.query("SELECT id, title FROM posts WHERE slug = $1", [slug]);
  if (!rows[0]) throw new Error(`Post "${slug}" not found — did you run npm run seed?`);
  return rows[0];
}

async function imageByFilename(filename) {
  const { rows } = await pool.query("SELECT id FROM images WHERE filename = $1", [filename]);
  if (!rows[0]) throw new Error(`Image "${filename}" not found — did you run npm run seed && npm run ingest?`);
  return rows[0];
}

async function main() {
  section("1. Automated tests");
  execSync("npm test", { stdio: "inherit" });

  section("2. Rank images for a fox post");
  const foxPost = await postBySlug("behavior-of-red-foxes");
  const foxResult = await rankImagesForPost(foxPost.id);
  console.log(`Post: "${foxResult.post.title}"`);
  console.log("Top candidates:");
  for (const c of foxResult.candidates.slice(0, 3)) {
    console.log(`  ${c.similarity.toFixed(3)}  ${c.filename.padEnd(14)} ${c.decision.padEnd(10)} ${c.reason}`);
  }
  console.log(`\n-> Suggested: ${foxResult.suggestion?.filename ?? "none"}`);

  section("3. The mismatch guard: force a wolf photo onto the fox post");
  const wolfImage = await imageByFilename("wolf-02.jpg");
  const forced = await evaluateForcedPair(foxPost.id, wolfImage.id);
  console.log(`Post:      "${forced.post.title}"`);
  console.log(`Candidate: ${forced.image.filename} (detected: "${forced.tags.subject}", similarity ${forced.similarity.toFixed(3)})`);
  console.log(`Decision:  ${forced.decision.toUpperCase()}`);
  console.log(`Reason:    ${forced.reason}`);

  section('4. "No confident match" case: a post about something outside the corpus');
  const coffeePost = await postBySlug("morning-coffee-brewing-methods");
  const coffeeResult = await rankImagesForPost(coffeePost.id);
  console.log(`Post: "${coffeeResult.post.title}"`);
  console.log(`Best candidate: ${coffeeResult.candidates[0].filename} (similarity ${coffeeResult.candidates[0].similarity.toFixed(3)})`);
  console.log(`-> Suggested: ${coffeeResult.suggestion?.filename ?? "none"}`);
  console.log(`   Reason: ${coffeeResult.candidates[0].reason}`);

  section("5. Review workflow: persist and approve the fox suggestion");
  const { rows: suggestionRows } = await pool.query(
    `INSERT INTO suggestions (post_id, image_id, similarity, confidence, decision, reason)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      foxPost.id,
      foxResult.suggestion.imageId,
      foxResult.suggestion.similarity,
      foxResult.suggestion.tags.confidence,
      "suggested",
      foxResult.suggestion.reason,
    ]
  );
  const suggestionId = suggestionRows[0].id;
  await pool.query(`INSERT INTO reviews (suggestion_id, status) VALUES ($1, 'approved')`, [suggestionId]);
  console.log(`Suggestion #${suggestionId} (${foxResult.suggestion.filename} for "${foxResult.post.title}") approved.`);

  section("6. Cost log");
  const { rows: cost } = await pool.query(
    `SELECT call_type, model, count(*) AS calls, COALESCE(sum(cost_usd), 0) AS cost_usd
     FROM cost_log GROUP BY call_type, model ORDER BY call_type, model`
  );
  for (const row of cost) {
    console.log(`  ${row.call_type.padEnd(10)} ${row.model.padEnd(14)} ${row.calls.padStart(4)} calls   $${row.cost_usd}`);
  }

  section("7. Top-1 precision on the labeled eval set");
  execSync("npm run eval", { stdio: "inherit" });

  await pool.end();
  console.log("\nDemo complete.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
