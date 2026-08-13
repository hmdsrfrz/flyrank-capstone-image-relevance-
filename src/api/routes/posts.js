import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool.js";
import { rankImagesForPost } from "../../guard/rankImages.js";

const idParam = z.coerce.number().int().positive();

export const postsRouter = Router();

postsRouter.get("/:id/images", async (req, res) => {
  const parsedId = idParam.safeParse(req.params.id);
  if (!parsedId.success) {
    return res.status(400).json({ error: "post id must be a positive integer" });
  }

  let result;
  try {
    result = await rankImagesForPost(parsedId.data);
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }

  const top = result.suggestion || result.candidates[0] || null;
  let suggestionId = null;
  if (top) {
    const { rows } = await pool.query(
      `INSERT INTO suggestions (post_id, image_id, similarity, confidence, decision, reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [parsedId.data, top.imageId ?? null, top.similarity ?? null, top.tags?.confidence ?? null, top.decision, top.reason]
    );
    suggestionId = rows[0].id;
  } else {
    const { rows } = await pool.query(
      `INSERT INTO suggestions (post_id, image_id, decision, reason)
       VALUES ($1, NULL, 'no_match', 'No images in the corpus to evaluate.')
       RETURNING id`,
      [parsedId.data]
    );
    suggestionId = rows[0].id;
  }

  res.json({
    post: result.post,
    candidates: result.candidates.map((c) => ({
      imageId: c.imageId,
      filename: c.filename,
      subject: c.tags.subject,
      similarity: c.similarity,
      decision: c.decision,
      reason: c.reason,
    })),
    suggestion: result.suggestion
      ? { imageId: result.suggestion.imageId, filename: result.suggestion.filename, similarity: result.suggestion.similarity }
      : null,
    suggestionId,
  });
});
