import { pool } from "../db/pool.js";
import { cosineSimilarity } from "../embeddings/embed.js";
import { evaluateMatch } from "./matchGuard.js";

const TOP_N_CANDIDATES = 5;

async function loadPost(postId) {
  const { rows } = await pool.query(
    `SELECT p.id, p.slug, p.title, p.body, v.embedding
     FROM posts p JOIN post_vectors v ON v.post_id = p.id
     WHERE p.id = $1`,
    [postId]
  );
  return rows[0] || null;
}

async function loadScoredImages(postEmbedding) {
  const { rows } = await pool.query(
    `SELECT i.id, i.filename, m.subject, m.category, m.attributes, m.confidence, m.low_confidence, v.embedding
     FROM images i
     JOIN image_metadata m ON m.image_id = i.id
     JOIN image_vectors v ON v.image_id = i.id`
  );
  return rows
    .map((row) => ({
      imageId: row.id,
      filename: row.filename,
      tags: {
        subject: row.subject,
        category: row.category,
        attributes: row.attributes,
        confidence: row.confidence,
        low_confidence: row.low_confidence,
      },
      similarity: cosineSimilarity(postEmbedding, row.embedding),
    }))
    .sort((a, b) => b.similarity - a.similarity);
}

/**
 * Ranks all corpus images against a post and runs each top candidate through
 * the mismatch guard until one is accepted. Returns the accepted suggestion,
 * or -- when every candidate is rejected or below the similarity threshold
 * -- the guard's verdict on the single best-ranked candidate as the
 * "no confident match" explanation.
 */
export async function rankImagesForPost(postId) {
  const post = await loadPost(postId);
  if (!post) throw new Error(`Post ${postId} not found or not yet embedded`);

  const scored = await loadScoredImages(post.embedding);
  const postText = `${post.title}. ${post.body}`;

  const evaluated = scored.slice(0, TOP_N_CANDIDATES).map((candidate) => ({
    ...candidate,
    ...evaluateMatch({ postText, imageTags: candidate.tags, similarity: candidate.similarity }),
  }));

  const suggestion = evaluated.find((c) => c.decision === "suggested") || null;

  return {
    post: { id: post.id, slug: post.slug, title: post.title },
    candidates: evaluated,
    suggestion,
  };
}

/** Force-evaluates one specific image against one specific post, bypassing ranking. */
export async function evaluateForcedPair(postId, imageId) {
  const post = await loadPost(postId);
  if (!post) throw new Error(`Post ${postId} not found or not yet embedded`);

  const { rows } = await pool.query(
    `SELECT i.id, i.filename, m.subject, m.category, m.attributes, m.confidence, m.low_confidence, v.embedding
     FROM images i
     JOIN image_metadata m ON m.image_id = i.id
     JOIN image_vectors v ON v.image_id = i.id
     WHERE i.id = $1`,
    [imageId]
  );
  const image = rows[0];
  if (!image) throw new Error(`Image ${imageId} not found or not yet tagged`);

  const similarity = cosineSimilarity(post.embedding, image.embedding);
  const tags = {
    subject: image.subject,
    category: image.category,
    attributes: image.attributes,
    confidence: image.confidence,
    low_confidence: image.low_confidence,
  };
  const result = evaluateMatch({ postText: `${post.title}. ${post.body}`, imageTags: tags, similarity });

  return {
    post: { id: post.id, slug: post.slug, title: post.title },
    image: { id: image.id, filename: image.filename },
    tags,
    similarity,
    ...result,
  };
}
