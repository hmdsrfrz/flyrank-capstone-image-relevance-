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
}

async function main() {
  await seedImages();
  await seedPosts();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
