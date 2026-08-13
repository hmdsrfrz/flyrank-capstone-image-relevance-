import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTagResponse, LOW_CONFIDENCE_THRESHOLD } from "../src/vision/tagSchema.js";

test("accepts a valid tag response", () => {
  const result = parseTagResponse({
    subject: "red fox",
    category: "animal",
    attributes: ["orange fur", "wild", "forest"],
    caption: "A red fox standing in a forest",
    confidence: 0.94,
  });
  assert.equal(result.ok, true);
  assert.equal(result.tags.low_confidence, false);
});

test("flags low-confidence results instead of rejecting them", () => {
  const result = parseTagResponse({
    subject: "unclear animal",
    category: "animal",
    attributes: ["blurry"],
    caption: "Hard to tell what this is",
    confidence: 0.3,
  });
  assert.equal(result.ok, true);
  assert.equal(result.tags.low_confidence, true);
  assert.ok(0.3 < LOW_CONFIDENCE_THRESHOLD);
});

test("rejects malformed model output", () => {
  const result = parseTagResponse({ subject: "red fox", confidence: 1.5 });
  assert.equal(result.ok, false);
});
