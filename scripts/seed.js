import { readFileSync } from "node:fs";
import { join } from "node:path";
import "dotenv/config";
import { pool } from "../src/db/pool.js";

async function seedImages() {
  const manifestPath = join(process.cwd(), "corpus", "images", "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

  for (const img of manifest) {
    await pool.query(
      `INSERT INTO images (filename, seed_category, source_url, license)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (filename) DO NOTHING`,
      [img.filename, img.seed_category, img.source_url, img.license]
    );
  }
  console.log(`Seeded ${manifest.length} images.`);
}

async function seedPosts() {
  const postsPath = join(process.cwd(), "corpus", "posts", "posts.json");
  const posts = JSON.parse(readFileSync(postsPath, "utf-8"));

  for (const post of posts) {
    await pool.query(
      `INSERT INTO posts (slug, title, body)
       VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO NOTHING`,
      [post.slug, post.title, post.body]
    );
  }
  console.log(`Seeded ${posts.length} posts.`);
  return posts;
}

async function seedEvalSet(posts) {
  let count = 0;
  for (const post of posts) {
    const { rows } = await pool.query(`SELECT id FROM posts WHERE slug = $1`, [post.slug]);
    if (!rows[0]) continue;
    await pool.query(
      `INSERT INTO eval_set (post_id, expected_category, note)
       VALUES ($1, $2, $3)
       ON CONFLICT (post_id) DO UPDATE SET expected_category = EXCLUDED.expected_category`,
      [rows[0].id, post.seed_category, post.seed_category ? null : "expects no confident match"]
    );
    count += 1;
  }
  console.log(`Seeded ${count} eval_set entries.`);
}

async function main() {
  await seedImages();
  const posts = await seedPosts();
  await seedEvalSet(posts);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
