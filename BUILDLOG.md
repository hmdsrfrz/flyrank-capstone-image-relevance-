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
