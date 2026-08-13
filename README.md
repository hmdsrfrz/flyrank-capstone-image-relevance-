# AI Image Understanding & Content Matching Engine

FlyRank Backend Track capstone. Given a library of images and a set of blog
posts, the system tags each image with a local vision model, embeds images
and posts into a shared semantic space, ranks candidate images per post, and
runs every candidate through a **mismatch guard** before suggesting it —
refusing with an explanation when nothing is a confident match.

See [`DESIGN.md`](./DESIGN.md) for the architecture, data model, and API
surface. See [`EVIDENCE.md`](./EVIDENCE.md) for proof against each
Definition-of-Done item, and [`BUILDLOG.md`](./BUILDLOG.md) for an honest log
of where AI assistance helped and where it didn't.

## Status

🚧 In progress — Phase 1 (design) complete, Phase 2 (vision pipeline) next.
This section will be replaced with real run/seed instructions, an
architecture diagram, a top-1 precision number, and a limitations note once
the system is functional end to end.

## Stack

- Node.js + Express + Zod + PostgreSQL (Docker)
- Ollama, local: `moondream` (vision tagging) + `all-minilm` (embeddings) — $0, offline, no API key
- Image corpus: Pexels API (free tier, licensed-free images)

## Setup (draft — will be finalized in Phase 4)

```bash
cp .env.example .env          # fill in PEXELS_API_KEY if re-downloading the corpus
docker compose up -d          # Postgres on localhost:5433
npm install
npm run migrate               # create tables
node scripts/downloadCorpus.js  # only needed if corpus/images/ is empty
npm run seed                  # load images + posts into the DB
npm run ingest                # batch-tag images, generate embeddings
npm start                     # API on localhost:3000
npm test                      # unit tests
npm run eval                  # top-1 precision against the labeled eval set
```
