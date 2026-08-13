# Design Doc — AI Image Understanding & Content Matching Engine

## Problem

Given a library of images and a set of blog posts, automatically suggest the
most relevant image for each post based on what the image actually depicts —
not filenames or keywords — and refuse to suggest an image when nothing in
the library is a confident match. The system must be able to tell a red fox
from a gray wolf even when both photos look superficially similar (forest
background, canid shape, similar coloring in some lighting).

## Data model

Nine tables (`src/db/schema.sql`):

- `images` — one row per corpus image; `seed_category` is the known ground-truth
  label used for eval, not the model's own output.
- `image_metadata` — the vision model's structured output per image: subject,
  category, attributes, caption, confidence, `low_confidence` flag, raw JSON.
- `image_vectors` — embedding of the image's caption, one per image.
- `posts` / `post_vectors` — same pattern on the content side.
- `suggestions` — one row per post/image pairing decision: similarity,
  confidence, `decision` (`suggested` / `rejected` / `no_match`), and a
  human-readable `reason`.
- `reviews` — human approve/reject action against a suggestion.
- `cost_log` — one row per vision or embedding call, attributed to the image
  or post it was made for.
- `eval_set` — labeled ground truth: post → correct image (or `null` when the
  correct answer is "no image fits").

## Layer sketch

```
scripts/downloadCorpus.js        -> corpus/images/*.jpg + manifest.json
scripts/seed.js                  -> loads images + posts.json into Postgres

src/vision/    tagSchema.js       Zod schema + validation for vision output
               classifyImage.js   calls Ollama (moondream), retries on invalid JSON
src/jobs/      runIngestJob.js    batch job: images -> tags -> embeddings, with
                                  retries and cost_log entries
src/embeddings/embed.js           calls Ollama (all-minilm) for captions/posts
src/guard/     matchGuard.js      similarity + category check + confidence ->
                                  suggested / rejected / no_match + reason
src/api/       server.js, routes/ Express: GET /posts/:id/images,
                                  POST /suggestions/:id/review
src/eval/      runEval.js         top-1 precision against eval_set
```

Request path (`GET /posts/:id/images`): fetch `post_vectors` row → cosine
similarity against all `image_vectors` → rank → pass top candidate(s) through
the mismatch guard → return suggestion or `no_match` with reason. Vision and
embedding generation never happen on this path — they're pre-computed by the
batch job.

## API surface (v1)

- `POST /images/ingest` — trigger the batch tagging/embedding job (or run via `npm run ingest`)
- `GET /posts/:id/images` — ranked suggestion(s) for a post, guard-filtered
- `POST /suggestions/:id/review` — `{ status: "approved" | "rejected" }`
- `GET /suggestions/:id` — inspect a suggestion + its reason
- `GET /cost` — cost log summary

## Non-goal

No frontend. The review workflow is API endpoints only (per the brief,
§7) — a recruiter or evaluator interacts with this system via `curl` or the
eval script, not a UI.
