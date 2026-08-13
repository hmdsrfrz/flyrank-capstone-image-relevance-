import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import "dotenv/config";

const CATEGORIES = [
  { key: "fox", query: "red fox" },
  { key: "wolf", query: "gray wolf" },
  { key: "dog", query: "dog" },
  { key: "bear", query: "brown bear" },
  { key: "deer", query: "deer" },
];
const PER_CATEGORY = 10;
const OUT_DIR = join(process.cwd(), "corpus", "images");

async function searchPexels(query, perPage) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`;
  const res = await fetch(url, { headers: { Authorization: process.env.PEXELS_API_KEY } });
  if (!res.ok) throw new Error(`Pexels search failed for "${query}": ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.photos;
}

async function downloadImage(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${url} (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(destPath, buf);
}

async function main() {
  if (!process.env.PEXELS_API_KEY) {
    throw new Error("PEXELS_API_KEY missing — get a free key at https://www.pexels.com/api/ and put it in .env");
  }
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const manifest = [];
  for (const { key, query } of CATEGORIES) {
    console.log(`Fetching "${query}"...`);
    const photos = await searchPexels(query, PER_CATEGORY);
    let i = 0;
    for (const photo of photos) {
      i += 1;
      const filename = `${key}-${String(i).padStart(2, "0")}.jpg`;
      const destPath = join(OUT_DIR, filename);
      await downloadImage(photo.src.large, destPath);
      manifest.push({
        filename,
        seed_category: key,
        source_url: photo.url,
        photographer: photo.photographer,
        license: "Pexels License (free to use, no attribution required) — https://www.pexels.com/license/",
      });
      console.log(`  saved ${filename}`);
    }
  }

  writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\nDone. ${manifest.length} images in ${OUT_DIR}, manifest.json written.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
