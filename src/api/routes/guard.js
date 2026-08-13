import { Router } from "express";
import { z } from "zod";
import { evaluateForcedPair } from "../../guard/rankImages.js";

const bodySchema = z.object({
  postId: z.coerce.number().int().positive(),
  imageId: z.coerce.number().int().positive(),
});

export const guardRouter = Router();

// Forces a specific image as the candidate for a specific post, bypassing
// ranking — this is how the wolf-on-a-fox-post demo scenario is reproduced
// against a live server rather than only in code.
guardRouter.post("/evaluate", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const result = await evaluateForcedPair(parsed.data.postId, parsed.data.imageId);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});
