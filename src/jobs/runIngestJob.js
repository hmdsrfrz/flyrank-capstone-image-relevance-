import "dotenv/config";
import { pool } from "../db/pool.js";
import { classifyImage } from "../vision/classifyImage.js";
import { embedText, EMBEDDING_MODEL } from "../embeddings/embed.js";

const VISION_MODEL = process.env.VISION_MODEL || "moondream";
const TEXT_MODEL = process.env.TEXT_MODEL || "llama3.2:3b";
const JOB_RETRY_ATTEMPTS = 2;

async function logCost(client, { callType, model, imageId = null, postId = null, durationMs }) {
  await client.query(
    `INSERT INTO cost_log (call_type, model, image_id, post_id, cost_usd, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [callType, model, imageId, postId, 0, durationMs]
  );
}

async function withRetries(fn, attempts) {
  let lastError;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.warn(`  attempt ${i}/${attempts} failed: ${err.message}`);
    }
  }
  throw lastError;
}

async function processImage(client, image) {
  const result = await classifyImage(`corpus/images/${image.filename}`);

  if (!result.ok) {
    throw new Error(result.error);
  }

  await client.query(
    `INSERT INTO image_metadata (image_id, subject, category, attributes, caption, confidence, low_confidence, raw_response)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (image_id) DO UPDATE SET
       subject = EXCLUDED.subject, category = EXCLUDED.category, attributes = EXCLUDED.attributes,
       caption = EXCLUDED.caption, confidence = EXCLUDED.confidence, low_confidence = EXCLUDED.low_confidence,
       raw_response = EXCLUDED.raw_response`,
    [
      image.id,
      result.tags.subject,
      result.tags.category,
      result.tags.attributes,
      result.tags.caption,
      result.tags.confidence,
      result.tags.low_confidence,
      JSON.stringify(result.raw),
    ]
  );
  await logCost(client, { callType: "vision", model: VISION_MODEL, imageId: image.id, durationMs: result.durationMs });
  await logCost(client, { callType: "vision", model: TEXT_MODEL, imageId: image.id, durationMs: result.durationMs });

  const embed = await embedText(result.tags.caption);
  await client.query(
    `INSERT INTO image_vectors (image_id, embedding, model)
     VALUES ($1, $2, $3)
     ON CONFLICT (image_id) DO UPDATE SET embedding = EXCLUDED.embedding, model = EXCLUDED.model`,
    [image.id, embed.embedding, EMBEDDING_MODEL]
  );
  await logCost(client, { callType: "embedding", model: EMBEDDING_MODEL, imageId: image.id, durationMs: embed.durationMs });

  return {
    status: result.tags.low_confidence ? "flagged" : "tagged",
    subject: result.tags.subject,
    confidence: result.tags.confidence,
  };
}

async function processPost(client, post) {
  const embed = await embedText(`${post.title}. ${post.body}`);
  await client.query(
    `INSERT INTO post_vectors (post_id, embedding, model)
     VALUES ($1, $2, $3)
     ON CONFLICT (post_id) DO UPDATE SET embedding = EXCLUDED.embedding, model = EXCLUDED.model`,
    [post.id, embed.embedding, EMBEDDING_MODEL]
  );
  await logCost(client, { callType: "embedding", model: EMBEDDING_MODEL, postId: post.id, durationMs: embed.durationMs });
  return { status: "embedded" };
}

async function runImageBatch(client) {
  const { rows: images } = await client.query(
    `SELECT i.id, i.filename FROM images i
     LEFT JOIN image_metadata m ON m.image_id = i.id
     WHERE m.image_id IS NULL
     ORDER BY i.id`
  );

  console.log(`\nImage batch: ${images.length} unprocessed image(s).`);
  const summary = { tagged: 0, flagged: 0, failed: 0 };
  for (const image of images) {
    console.log(`Processing ${image.filename}...`);
    try {
      const result = await withRetries(() => processImage(client, image), JOB_RETRY_ATTEMPTS);
      summary[result.status] += 1;
      console.log(`  -> ${result.subject} (confidence ${result.confidence}${result.status === "flagged" ? ", FLAGGED low-confidence" : ""})`);
    } catch (err) {
      summary.failed += 1;
      console.warn(`  [FAILED after retries] ${image.filename}: ${err.message}`);
    }
  }
  return summary;
}

async function runPostBatch(client) {
  const { rows: posts } = await client.query(
    `SELECT p.id, p.slug, p.title, p.body FROM posts p
     LEFT JOIN post_vectors v ON v.post_id = p.id
     WHERE v.post_id IS NULL
     ORDER BY p.id`
  );

  console.log(`\nPost batch: ${posts.length} unprocessed post(s).`);
  let embedded = 0;
  for (const post of posts) {
    console.log(`Embedding "${post.slug}"...`);
    await withRetries(() => processPost(client, post), JOB_RETRY_ATTEMPTS);
    embedded += 1;
  }
  return { embedded };
}

async function main() {
  const client = await pool.connect();
  try {
    const imageSummary = await runImageBatch(client);
    const postSummary = await runPostBatch(client);

    console.log("\n--- Ingest job summary ---");
    console.log(`Images tagged: ${imageSummary.tagged}, flagged low-confidence: ${imageSummary.flagged}, failed: ${imageSummary.failed}`);
    console.log(`Posts embedded: ${postSummary.embedded}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
