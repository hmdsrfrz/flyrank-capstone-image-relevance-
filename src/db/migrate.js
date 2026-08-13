import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const sql = readFileSync(join(__dirname, "schema.sql"), "utf-8");
  await client.query(sql);
  await client.end();
  console.log("Migration applied.");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
