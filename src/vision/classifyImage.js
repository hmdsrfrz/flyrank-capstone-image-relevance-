import { readFileSync } from "node:fs";
import { Ollama } from "ollama";
import "dotenv/config";
import { parseTagResponse } from "./tagSchema.js";

const ollama = new Ollama({ host: process.env.OLLAMA_HOST || "http://localhost:11434" });
const VISION_MODEL = process.env.VISION_MODEL || "moondream";
const EXTRACT_MODEL = process.env.TEXT_MODEL || "llama3.2:3b";
const MAX_ATTEMPTS = 4;

// A second, simpler prompt is used on retry: this small vision model
// occasionally emits an empty response for a given prompt+image pairing
// deterministically (not transient flakiness) — varying the prompt on
// retry recovers where blind retries of the same prompt do not.
const CAPTION_PROMPTS = [
  "Describe this image in one detailed sentence, mentioning the main subject and its setting.",
  "What do you see in this image? Answer in one sentence.",
  "Caption this photo.",
];

function extractionPrompt(caption) {
  return `Given this image caption: "${caption}"
Extract structured tags as JSON with exactly these keys:
- subject: short noun phrase for the main subject
- category: one word for the general kind of thing (e.g. animal, object, food, vehicle, plant)
- attributes: array of 3-5 short descriptive words or phrases (strings only, never numbers)
- caption: the original caption, cleaned up to one sentence
- confidence: a number 0-1 for how clearly the caption identifies a specific subject
Respond with ONLY the JSON object.`;
}

// moondream (the vision model) is unreliable at compound structured-JSON prompts
// but captions plain images well. So captioning and structured extraction are
// split across two calls: vision model -> plain caption, text model -> schema JSON.
async function caption(imagePath, promptIndex = 0) {
  const imageBase64 = readFileSync(imagePath).toString("base64");
  const prompt = CAPTION_PROMPTS[Math.min(promptIndex, CAPTION_PROMPTS.length - 1)];
  const response = await ollama.chat({
    model: VISION_MODEL,
    messages: [{ role: "user", content: prompt, images: [imageBase64] }],
  });
  return response.message.content.trim();
}

async function extractTags(captionText) {
  const response = await ollama.chat({
    model: EXTRACT_MODEL,
    format: "json",
    messages: [{ role: "user", content: extractionPrompt(captionText) }],
  });
  return JSON.parse(response.message.content);
}

export async function classifyImage(imagePath) {
  let captionText;
  let captionError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      captionText = await caption(imagePath, attempt - 1);
      if (!captionText) throw new Error("vision model returned an empty caption");
      captionError = null;
      break;
    } catch (err) {
      captionError = err.message;
    }
  }
  if (captionError) {
    return { ok: false, error: `captioning failed: ${captionError}`, attempts: MAX_ATTEMPTS };
  }

  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const start = Date.now();
    let raw;
    try {
      raw = await extractTags(captionText);
    } catch (err) {
      lastError = `extraction call or JSON parse failed: ${err.message}`;
      continue;
    }
    const durationMs = Date.now() - start;

    const result = parseTagResponse(raw);
    if (result.ok) {
      return { ok: true, tags: result.tags, raw, durationMs, attempts: attempt };
    }
    lastError = `schema validation failed: ${JSON.stringify(result.error)}`;
  }

  return { ok: false, error: lastError, attempts: MAX_ATTEMPTS };
}
