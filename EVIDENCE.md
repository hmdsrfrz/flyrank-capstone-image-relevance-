# Evidence

One pasted proof per Definition-of-Done checkbox (brief §6). Filled in as
each phase completes — empty boxes below are not yet done.

## AI processing

- [x] Vision model produces structured output validated against a schema; invalid responses are never trusted.

  `src/vision/tagSchema.js` validates every model response with Zod
  (`safeParse`); `src/vision/classifyImage.js` retries on both a failed
  parse and an empty/invalid vision response, trying alternate prompts
  (`CAPTION_PROMPTS`) before giving up. See `test/tagSchema.test.js`
  (malformed output is rejected, not coerced).

- [x] Low-confidence classifications are flagged instead of accepted.

  `LOW_CONFIDENCE_THRESHOLD = 0.6` in `src/vision/tagSchema.js` sets
  `low_confidence: true` on any tag below that confidence — it is stored,
  not discarded. Proof from the real run against all 50 corpus images:

  ```
  $ docker exec capstone-db-1 psql -U capstone -d capstone -c "
    SELECT (SELECT count(*) FROM images) AS total_images,
           (SELECT count(*) FROM image_metadata) AS tagged,
           (SELECT count(*) FROM image_metadata WHERE low_confidence) AS flagged_low_confidence,
           (SELECT count(*) FROM image_vectors) AS embedded_images,
           (SELECT count(*) FROM posts) AS total_posts,
           (SELECT count(*) FROM post_vectors) AS embedded_posts,
           (SELECT count(*) FROM cost_log) AS cost_log_entries;"

   total_images | tagged | flagged_low_confidence | embedded_images | total_posts | embedded_posts | cost_log_entries
  --------------+--------+------------------------+------------------+-------------+-----------------+------------------
             50 |     50 |                      9 |               50 |          13 |              13 |              163
  ```

  9 of 50 images (e.g. `fox-03.jpg`, misidentified as "urn of snow") were
  flagged rather than silently accepted.

- [x] Images are processed through a batch background job with retries.

  `src/jobs/runIngestJob.js` (`npm run ingest`), processes only images
  missing an `image_metadata` row (idempotent — safe to re-run), retries
  each image up to `JOB_RETRY_ATTEMPTS = 2` times at the job level on top of
  `classifyImage`'s own internal retries. First run against the full corpus:
  28 tagged, 8 flagged, 14 failed (all "empty caption" — see BUILDLOG.md for
  the root cause and fix). Second run (after the fix) reprocessed exactly
  those 14 unprocessed images and recovered all of them: 13 tagged, 1
  flagged, 0 failed.

- [x] Vision and embedding costs are tracked per call.

  Every vision, text-extraction, and embedding call writes a `cost_log` row
  (`call_type`, `model`, `image_id`/`post_id`, `duration_ms`, `cost_usd`).
  163 rows after ingest = 50 images × 3 calls (caption + extraction +
  embedding) + 13 posts × 1 embedding call. `cost_usd` is 0 throughout since
  the local Ollama stack has no per-call charge — the schema supports a
  nonzero value if the cloud (Gemini) path is used instead.

## Matching system

- [ ] Image and post embeddings are stored; posts return ranked image suggestions.
- [ ] Semantic matching works for equivalent concepts ("red fox" matches "Vulpes vulpes").

## Safety layer

- [ ] The mismatch guard rejects incorrect recommendations — the wolf-on-a-fox-post scenario provably fails.
- [ ] Rejections include a human-readable explanation.
- [ ] When no image clears the bar, the system answers "no confident match" with reasons.

## Backend

- [x] Database models for images, tags, embeddings, posts, suggestions, approvals/rejections — with the required indexes.

  Schema in `src/db/schema.sql`, applied via `npm run migrate`. Verified tables:

  ```
  $ docker exec capstone-db-1 psql -U capstone -d capstone -c "\dt"
               List of relations
   Schema |      Name      | Type  |  Owner
  --------+----------------+-------+----------
   public | cost_log       | table | capstone
   public | eval_set       | table | capstone
   public | image_metadata | table | capstone
   public | image_vectors  | table | capstone
   public | images         | table | capstone
   public | post_vectors   | table | capstone
   public | posts          | table | capstone
   public | reviews        | table | capstone
   public | suggestions    | table | capstone
  (9 rows)
  ```

- [ ] API endpoints validated; the review workflow (approve / reject / inspect why) exists.

## Quality & documentation

- [ ] Automated tests cover schema validation, mismatch rejection, and matching accuracy.
- [ ] A small labeled evaluation dataset measures top-1 precision — the number is in the README.
- [ ] README with architecture explanation and diagram; submission-pack files present.
