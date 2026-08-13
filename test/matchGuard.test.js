import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateMatch, inferCategory, SIMILARITY_THRESHOLD } from "../src/guard/matchGuard.js";

test("rejects the wolf-on-a-fox-post scenario with a category-mismatch reason", () => {
  const result = evaluateMatch({
    postText: "The behavior of red foxes: red foxes are highly adaptable animals.",
    imageTags: {
      subject: "gray wolf",
      category: "animal",
      attributes: ["forest", "gray fur"],
      confidence: 0.9,
      low_confidence: false,
    },
    similarity: 0.6,
  });
  assert.equal(result.decision, "rejected");
  assert.match(result.reason, /category mismatch/i);
  assert.match(result.reason, /expected fox, detected wolf/i);
});

test("suggests a matching fox image for a fox post", () => {
  const result = evaluateMatch({
    postText: "The behavior of red foxes: red foxes are highly adaptable animals.",
    imageTags: {
      subject: "red fox",
      category: "animal",
      attributes: ["orange fur", "forest"],
      confidence: 0.9,
      low_confidence: false,
    },
    similarity: 0.6,
  });
  assert.equal(result.decision, "suggested");
});

test("matches a scientific-name post to a fox image via synonym inference", () => {
  const postText = "Vulpes vulpes has one of the widest distributions of any carnivore.";
  assert.equal(inferCategory(postText), "fox");
});

test("rejects a low-confidence image even if similarity and category match", () => {
  const result = evaluateMatch({
    postText: "The behavior of red foxes.",
    imageTags: {
      subject: "fox",
      category: "animal",
      attributes: ["blurry"],
      confidence: 0.3,
      low_confidence: true,
    },
    similarity: 0.8,
  });
  assert.equal(result.decision, "rejected");
  assert.match(result.reason, /confidence too low/i);
});

test("returns no_match when nothing clears the similarity threshold", () => {
  const result = evaluateMatch({
    postText: "A practical guide to PostgreSQL index tuning.",
    imageTags: {
      subject: "red fox",
      category: "animal",
      attributes: ["forest"],
      confidence: 0.9,
      low_confidence: false,
    },
    similarity: SIMILARITY_THRESHOLD - 0.1,
  });
  assert.equal(result.decision, "no_match");
  assert.match(result.reason, /below the .* threshold/i);
});

test("does not force a category mismatch when the post mentions no known category", () => {
  const result = evaluateMatch({
    postText: "Five coffee brewing methods compared.",
    imageTags: {
      subject: "brown bear",
      category: "animal",
      attributes: ["forest"],
      confidence: 0.9,
      low_confidence: false,
    },
    similarity: 0.6,
  });
  // similarity clears the bar and there's no category to contradict, so the
  // guard suggests it -- ranking is what should keep this from happening in
  // practice, since a coffee post's embedding shouldn't be similar to a bear caption
  assert.equal(result.decision, "suggested");
});
