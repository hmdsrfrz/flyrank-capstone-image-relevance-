# AI Image Understanding & Content Matching Engine

FlyRank Backend Track capstone. Given a library of images and a set of blog
posts, the system tags each image with a local vision model, embeds images
and posts into a shared semantic space, ranks candidate images per post, and
runs every candidate through a **mismatch guard** before suggesting it,
refusing with an explanation when nothing is a confident match.

```
Images ─(batch job)─► Vision Model ─► {tags, caption, confidence} ─► image_metadata
        moondream            │
                              └─► embed(caption) ──► all-minilm ──► image_vectors

Posts ─────────────► embed(title+body) ──► all-minilm ──► post_vectors

GET /posts/:id/images
    └─► Cosine similarity ranking (post_vector × image_vectors)
          └─► Mismatch guard (confidence + threshold + category cross-check)
                ├─► Suggested image (ranked, explained)
                └─► "No confident match" + reason
                      └─► POST /suggestions/:id/review (approve / reject)
```

See [`DESIGN.md`](./DESIGN.md) for the full data model, layer sketch, and
API surface. See [`EVIDENCE.md`](./EVIDENCE.md) for proof against every
Definition-of-Done item, and [`BUILDLOG.md`](./BUILDLOG.md) for an honest log
of where AI assistance helped, where it was wrong, and what changed.

## Result

**Top-1 precision: 100% (13/13)** on the labeled eval set: every post gets
the right category of image suggested, or correctly gets no suggestion when
nothing in the corpus fits. Reproduce with `npm run eval`.

The brief's demo scenario, reproduced live:

```
POST /guard/evaluate {"postId": 1, "imageId": 12}   # fox post, wolf-02.jpg image
→ { "decision": "rejected", "reason": "Category mismatch: expected fox, detected wolf." }
```

## Stack

- Node.js + Express + Zod + PostgreSQL (Docker)
- Ollama, local: `moondream` (image captioning) + `llama3.2:3b` (structured tag extraction) + `all-minilm` (embeddings), $0, offline, no API key
- Image corpus: Pexels API (free tier, licensed-free images)

The vision pipeline is two calls, not one: `moondream` (a small ~1.8B model)
captions images well but is unreliable at following compound structured-JSON
instructions directly. `llama3.2:3b` extracts the schema-valid tags from that
caption instead. See `BUILDLOG.md` for how this was found.

## Setup

```bash
cp .env.example .env            # fill in PEXELS_API_KEY only if re-downloading the corpus
docker compose up -d            # Postgres on localhost:5433 (see note below)
npm install
npm run migrate                 # create tables
ollama pull moondream && ollama pull llama3.2:3b && ollama pull all-minilm
npm run seed                    # load images + posts + eval set into the DB
npm run ingest                  # batch-tag images, generate embeddings (~3-5 min on a 6GB GPU)
npm start                       # API on localhost:3000
```

In another terminal:

```bash
npm test                        # 15 tests: schema validation, guard logic, live matching
npm run eval                    # top-1 precision against the labeled eval set
npm run demo                    # runs tests, ranking, the mismatch guard, review, cost, and eval in one go
```

`npm run demo` (`scripts/demo.js`) is the fastest way to see the whole
system work: it runs the test suite, ranks images for a fox post, forces a
wolf photo onto that post and shows the guard reject it, shows a post with
no matching image get an honest refusal, approves a suggestion, prints the
cost log, and closes with the eval precision. No server needs to be running
first, it talks to the database directly.

`docker-compose.yml` maps Postgres to host port **5433**, not the default
5432. This avoids colliding with any Postgres already installed on the
evaluator's machine (this repo was built on a machine with exactly that
conflict). `corpus/images/` isn't committed (see `.gitignore`); it's
reproduced via `node scripts/downloadCorpus.js`, which needs a free
[Pexels API key](https://www.pexels.com/api/). `manifest.json` (license
info per image) is committed, so no key is needed unless you want to
re-download.

## API

| Endpoint | Description |
|---|---|
| `GET /posts/:id/images` | Ranks all images against a post, runs the guard, returns the accepted suggestion (or `null` + reason) and persists it |
| `POST /guard/evaluate` `{postId, imageId}` | Force-evaluates one specific image against one specific post, bypassing ranking |
| `GET /suggestions/:id` | Inspect a persisted suggestion, its reason, and its review history |
| `POST /suggestions/:id/review` `{status: "approved"|"rejected"}` | Review workflow |
| `GET /cost` | Per-call cost/duration log, broken down by call type and model |

## Limitations

- The mismatch guard's category cross-check is synonym/word-boundary
  matching against 5 known categories (fox/wolf/dog/bear/deer), not a
  learned classifier. That's appropriate for this bounded corpus, not a
  general-purpose solution for an open-ended category set.
- `moondream` occasionally returns an empty caption for a given
  prompt+image pairing deterministically (not random flakiness), handled
  with alternate-prompt retries in `classifyImage.js`. The underlying
  model behavior is still a known rough edge, documented in `BUILDLOG.md`.
- The eval set's ground truth is "correct category," not "correct single
  image," since the corpus has multiple equally-valid images per category.
  See the comment in `src/db/schema.sql` on `eval_set`.
- No frontend; the review workflow is API endpoints only, per the brief's
  scope guidance.
