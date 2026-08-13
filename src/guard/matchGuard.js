// Tuned against the real corpus (see scripts/inspectSimilarity.js): genuine
// post/image matches score 0.32-0.66 cosine similarity on all-minilm
// embeddings, while posts with no matching category in the library top out
// around 0.18. 0.28 sits in the gap with margin on both sides.
export const SIMILARITY_THRESHOLD = 0.28;

const CATEGORY_SYNONYMS = {
  fox: ["fox", "foxes", "vulpes"],
  wolf: ["wolf", "wolves"],
  dog: ["dog", "dogs", "puppy", "puppies", "canine"],
  bear: ["bear", "bears"],
  deer: ["deer", "reindeer"],
};

// Infers which of our known animal categories a piece of text refers to by
// counting synonym mentions. Returns null when no known category is
// mentioned (e.g. a post about database indexing) or the text is silent on
// the subject — the guard treats "unknown" as "don't cross-check", not as
// a mismatch, since forcing a category call on ambiguous text would produce
// false rejections.
export function inferCategory(text) {
  const lower = text.toLowerCase();
  let best = null;
  let bestCount = 0;
  for (const [category, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
    const count = synonyms.reduce((sum, syn) => {
      const matches = lower.match(new RegExp(`\\b${syn}\\b`, "g"));
      return sum + (matches ? matches.length : 0);
    }, 0);
    if (count > bestCount) {
      best = category;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Decides whether a candidate image is a good enough suggestion for a post.
 * Combines three independent signals, any one of which can veto the match:
 *   1. tag confidence (never trust a low-confidence classification)
 *   2. semantic similarity (post embedding vs image caption embedding)
 *   3. category cross-check (does the image's detected subject match what
 *      the post is actually about?)
 */
export function evaluateMatch({ postText, imageTags, similarity }) {
  if (imageTags.low_confidence) {
    return {
      decision: "rejected",
      reason: `Image classification confidence too low (${imageTags.confidence.toFixed(2)}) to trust the tag "${imageTags.subject}".`,
    };
  }

  if (similarity < SIMILARITY_THRESHOLD) {
    return {
      decision: "no_match",
      reason: `Similarity ${similarity.toFixed(2)} is below the ${SIMILARITY_THRESHOLD} threshold; nothing in the library is a confident match.`,
    };
  }

  const postCategory = inferCategory(postText);
  const imageCategory = inferCategory(`${imageTags.subject} ${imageTags.category} ${imageTags.attributes.join(" ")}`);

  if (postCategory && imageCategory && postCategory !== imageCategory) {
    return {
      decision: "rejected",
      reason: `Category mismatch: expected ${postCategory}, detected ${imageCategory}.`,
    };
  }

  return {
    decision: "suggested",
    reason: `Similarity ${similarity.toFixed(2)} clears the threshold; subject "${imageTags.subject}" is consistent with the post.`,
  };
}
