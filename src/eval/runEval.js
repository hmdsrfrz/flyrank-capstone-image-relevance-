import "dotenv/config";
import { pool } from "../db/pool.js";
import { rankImagesForPost } from "../guard/rankImages.js";

async function main() {
  const { rows: evalRows } = await pool.query(
    `SELECT e.post_id, e.expected_category, p.slug
     FROM eval_set e JOIN posts p ON p.id = e.post_id
     ORDER BY p.id`
  );

  let correct = 0;
  const rows = [];

  for (const row of evalRows) {
    const result = await rankImagesForPost(row.post_id);
    let actualCategory = null;
    if (result.suggestion) {
      const { rows: imgRows } = await pool.query(`SELECT seed_category FROM images WHERE id = $1`, [
        result.suggestion.imageId,
      ]);
      actualCategory = imgRows[0]?.seed_category ?? null;
    }

    const isCorrect = row.expected_category
      ? actualCategory === row.expected_category
      : result.suggestion === null;

    if (isCorrect) correct += 1;
    rows.push({
      slug: row.slug,
      expected: row.expected_category ?? "(no match)",
      actual: result.suggestion ? `${result.suggestion.filename} (${actualCategory})` : "(no match)",
      correct: isCorrect,
    });
  }

  console.log("slug".padEnd(32), "expected".padEnd(14), "actual".padEnd(28), "correct");
  for (const r of rows) {
    console.log(r.slug.padEnd(32), r.expected.padEnd(14), r.actual.padEnd(28), r.correct ? "yes" : "NO");
  }

  const precision = correct / evalRows.length;
  console.log(`\nTop-1 precision: ${(precision * 100).toFixed(1)}% (${correct}/${evalRows.length})`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
