# Build Log

Honest record of where AI assistance helped, where it was wrong, and what
was changed. Updated per session.

## 2026-08-13 — Phase 1: Design

- Used Claude Code to read the capstone brief PDF and produce the initial
  Definition-of-Done checklist and phase plan.
- AI scaffolded the repo structure, `docker-compose.yml`, `src/db/schema.sql`,
  the Zod tag schema, the Pexels download script, and the synthetic blog post
  corpus.
- **Caught and fixed**: the Docker Compose Postgres port (5432) conflicted
  with a native Postgres install already running on this machine. Remapped
  the container to host port 5433 and updated `.env`/`.env.example`
  accordingly — this would have silently failed with a confusing
  "password authentication failed" error otherwise (the connection was
  reaching the native instance, not the container).
- **Caught and fixed**: `npm run test` failed with `MODULE_NOT_FOUND` when
  pointed at the bare `test/` directory on this Windows/Git Bash setup;
  switched the script to an explicit `test/*.test.js` glob, which resolved
  it.
- Manually verified: schema migration applies cleanly, all 9 tables exist,
  the 3 Zod schema unit tests pass, `moondream` + `all-minilm` pulled via
  Ollama, and 50 images downloaded across 5 categories via the Pexels API.

## 2026-08-13 — Phase 2: Vision pipeline

- Original plan was a single moondream call producing the full structured
  JSON tag object directly. AI wrote this first version; it failed in
  testing — moondream (a small ~1.8B vision model) reliably ignored the
  actual image and either hallucinated bounding-box-like numbers into the
  `attributes` array or echoed the few-shot example verbatim. **Changed
  approach**: split into two calls — moondream produces a plain-language
  caption (which it does well), then `llama3.2:3b` (a proper text LLM,
  already pulled from an earlier assignment) extracts the structured JSON
  from that caption. Small vision models are much better at captioning than
  at following compound structured-output instructions; text LLMs are much
  better at schema-following. This is documented as a comment in
  `src/vision/classifyImage.js`.
- **Found and fixed a real reliability bug during the first full ingest
  run**: `moondream` deterministically returns an empty caption for certain
  prompt+image combinations (reproduced 3/3 times on the same input — not
  random flakiness). The first full run over 50 images hit this on 14 of
  them (28%), concentrated in the wolf/dog/bear/deer categories. Fixed by
  (a) adding two alternate, simpler caption prompts that `classifyImage`
  cycles through on retry instead of repeating the same failing prompt, and
  (b) fixing a bug where the batch job's job-level retry wrapper never
  actually fired, because `processImage` returned `{status: "failed"}`
  instead of throwing — `withRetries` only catches thrown errors. After
  both fixes, re-running the (idempotent) ingest job reprocessed exactly the
  14 previously-unprocessed images and recovered all 14.
- This was a useful real example of "treat the AI as an unreliable but
  useful component": the failure mode wasn't obvious from single-image
  testing, only appeared at batch scale, and the fix was retry-with-variation
  plus fixing our own retry logic — not the model's problem to solve.

## 2026-08-13 — Phase 3: Matching engine + mismatch guard

- The mismatch guard's category cross-check (`inferCategory` in
  `src/guard/matchGuard.js`) is a simple synonym/word-boundary matcher
  against our 5 known categories, not a learned classifier. This was a
  deliberate scope choice given the corpus is small and fixed — a real
  production system with an open-ended category set would need something
  smarter, and that's noted as a limitation, not hidden.
- The similarity threshold was **not guessed**. Wrote a throwaway script
  (`scripts/inspectSimilarity.js`, since deleted) that computed real cosine
  similarities between all 13 posts and all 50 images. The first guess
  (0.4) would have wrongly rejected two genuine matches
  (`training-a-new-puppy` at 0.367, `dog-breeds-for-active-owners` at
  0.336). Actual data showed real matches cluster at 0.32-0.66 and the two
  posts with no matching image in the corpus top out at 0.18 — set
  `SIMILARITY_THRESHOLD = 0.28` to sit in that gap. This is the number
  defended at the demo, not a feeling.
- Verified end to end against the live database (not just unit tests): full
  sweep across all 13 posts gives 13/13 correct top-1 suggestions (11
  category posts correctly matched, 2 no-category posts correctly returned
  `NO_MATCH`), and the brief's exact wolf-on-fox-post demo scenario was
  reproduced via `evaluateForcedPair()` and rejected with "Category
  mismatch: expected fox, detected wolf."
