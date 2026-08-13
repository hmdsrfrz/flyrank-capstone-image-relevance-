import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool.js";

const idParam = z.coerce.number().int().positive();
const reviewBody = z.object({ status: z.enum(["approved", "rejected"]) });

export const suggestionsRouter = Router();

suggestionsRouter.get("/:id", async (req, res) => {
  const parsedId = idParam.safeParse(req.params.id);
  if (!parsedId.success) {
    return res.status(400).json({ error: "suggestion id must be a positive integer" });
  }

  const { rows: suggestionRows } = await pool.query(
    `SELECT s.*, p.slug AS post_slug, i.filename AS image_filename
     FROM suggestions s
     JOIN posts p ON p.id = s.post_id
     LEFT JOIN images i ON i.id = s.image_id
     WHERE s.id = $1`,
    [parsedId.data]
  );
  const suggestion = suggestionRows[0];
  if (!suggestion) {
    return res.status(404).json({ error: `Suggestion ${parsedId.data} not found` });
  }

  const { rows: reviews } = await pool.query(
    `SELECT id, status, reviewer, created_at FROM reviews WHERE suggestion_id = $1 ORDER BY created_at`,
    [parsedId.data]
  );

  res.json({ ...suggestion, reviews });
});

suggestionsRouter.post("/:id/review", async (req, res) => {
  const parsedId = idParam.safeParse(req.params.id);
  const parsedBody = reviewBody.safeParse(req.body);
  if (!parsedId.success || !parsedBody.success) {
    return res.status(400).json({ error: "invalid id or body; body must be { status: 'approved' | 'rejected' }" });
  }

  const { rows: existing } = await pool.query(`SELECT id FROM suggestions WHERE id = $1`, [parsedId.data]);
  if (!existing[0]) {
    return res.status(404).json({ error: `Suggestion ${parsedId.data} not found` });
  }

  const { rows } = await pool.query(
    `INSERT INTO reviews (suggestion_id, status) VALUES ($1, $2) RETURNING id, suggestion_id, status, reviewer, created_at`,
    [parsedId.data, parsedBody.data.status]
  );
  res.status(201).json(rows[0]);
});
