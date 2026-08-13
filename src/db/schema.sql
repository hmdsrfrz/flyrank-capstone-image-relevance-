CREATE TABLE IF NOT EXISTS images (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL UNIQUE,
  seed_category TEXT NOT NULL,
  source_url TEXT,
  license TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS image_metadata (
  image_id INTEGER PRIMARY KEY REFERENCES images(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  category TEXT NOT NULL,
  attributes TEXT[] NOT NULL DEFAULT '{}',
  caption TEXT NOT NULL,
  confidence REAL NOT NULL,
  low_confidence BOOLEAN NOT NULL DEFAULT false,
  raw_response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_image_metadata_category ON image_metadata(category);

CREATE TABLE IF NOT EXISTS image_vectors (
  image_id INTEGER PRIMARY KEY REFERENCES images(id) ON DELETE CASCADE,
  embedding REAL[] NOT NULL,
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_vectors (
  post_id INTEGER PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  embedding REAL[] NOT NULL,
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suggestions (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
  similarity REAL,
  confidence REAL,
  decision TEXT NOT NULL CHECK (decision IN ('suggested', 'rejected', 'no_match')),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suggestions_post ON suggestions(post_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_image ON suggestions(image_id);

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  suggestion_id INTEGER NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('approved', 'rejected')),
  reviewer TEXT NOT NULL DEFAULT 'demo-reviewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cost_log (
  id SERIAL PRIMARY KEY,
  call_type TEXT NOT NULL CHECK (call_type IN ('vision', 'embedding')),
  model TEXT NOT NULL,
  image_id INTEGER REFERENCES images(id) ON DELETE SET NULL,
  post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cost_log_created ON cost_log(created_at);

CREATE TABLE IF NOT EXISTS eval_set (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  correct_image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
