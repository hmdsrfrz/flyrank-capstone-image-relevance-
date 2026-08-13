import { z } from "zod";

export const LOW_CONFIDENCE_THRESHOLD = 0.6;

export const TagSchema = z.object({
  subject: z.string().min(1),
  category: z.string().min(1),
  attributes: z.array(z.string()).min(1),
  caption: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export function parseTagResponse(raw) {
  const result = TagSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: result.error.flatten() };
  }
  const tags = result.data;
  return { ok: true, tags: { ...tags, low_confidence: tags.confidence < LOW_CONFIDENCE_THRESHOLD } };
}
