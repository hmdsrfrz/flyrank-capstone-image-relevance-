# Evidence

One pasted proof per Definition-of-Done checkbox (brief §6). Filled in as
each phase completes — empty boxes below are not yet done.

## AI processing

- [ ] Vision model produces structured output validated against a schema; invalid responses are never trusted.
- [ ] Low-confidence classifications are flagged instead of accepted.
- [ ] Images are processed through a batch background job with retries.
- [ ] Vision and embedding costs are tracked per call.

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
