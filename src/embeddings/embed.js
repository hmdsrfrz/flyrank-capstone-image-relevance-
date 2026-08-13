import { Ollama } from "ollama";
import "dotenv/config";

const ollama = new Ollama({ host: process.env.OLLAMA_HOST || "http://localhost:11434" });
export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "all-minilm";

export async function embedText(text) {
  const start = Date.now();
  const response = await ollama.embed({ model: EMBEDDING_MODEL, input: text });
  return { embedding: response.embeddings[0], durationMs: Date.now() - start };
}

export function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
