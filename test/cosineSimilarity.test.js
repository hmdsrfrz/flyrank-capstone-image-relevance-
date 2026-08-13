import { test } from "node:test";
import assert from "node:assert/strict";
import { cosineSimilarity } from "../src/embeddings/embed.js";

test("identical vectors have similarity 1", () => {
  assert.equal(cosineSimilarity([1, 0, 0], [1, 0, 0]), 1);
});

test("orthogonal vectors have similarity 0", () => {
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
});

test("opposite vectors have similarity -1", () => {
  assert.equal(cosineSimilarity([1, 0], [-1, 0]), -1);
});
