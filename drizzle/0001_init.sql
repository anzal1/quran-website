CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS surahs (
  id integer PRIMARY KEY,
  number integer NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  name_en_translation text NOT NULL,
  revelation_type text NOT NULL
);

CREATE TABLE IF NOT EXISTS ayahs (
  id integer PRIMARY KEY,
  global_number integer NOT NULL UNIQUE,
  surah_id integer NOT NULL REFERENCES surahs(id) ON DELETE CASCADE,
  number_in_surah integer NOT NULL,
  page integer,
  juz integer,
  hizb integer,
  sajda boolean NOT NULL DEFAULT false,
  arabic_text text NOT NULL,
  normalized_arabic text NOT NULL,
  UNIQUE (surah_id, number_in_surah)
);

CREATE TABLE IF NOT EXISTS editions (
  identifier text PRIMARY KEY,
  source_id integer UNIQUE,
  language text NOT NULL,
  name text NOT NULL,
  english_name text NOT NULL,
  format text NOT NULL,
  type text NOT NULL
);

CREATE TABLE IF NOT EXISTS translations (
  id bigserial PRIMARY KEY,
  ayah_id integer NOT NULL REFERENCES ayahs(id) ON DELETE CASCADE,
  edition_identifier text NOT NULL REFERENCES editions(identifier) ON DELETE CASCADE,
  language text NOT NULL,
  type text NOT NULL,
  text text NOT NULL,
  UNIQUE (ayah_id, edition_identifier)
);

CREATE TABLE IF NOT EXISTS search_documents (
  id text PRIMARY KEY,
  kind text NOT NULL,
  ayah_id integer REFERENCES ayahs(id) ON DELETE CASCADE,
  surah_id integer REFERENCES surahs(id) ON DELETE CASCADE,
  reference text NOT NULL,
  language text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  normalized_content text NOT NULL,
  source text NOT NULL,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(normalized_content, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(reference, '')), 'A')
  ) STORED,
  embedding vector(768),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  ayah_id integer NOT NULL REFERENCES ayahs(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ayah_id)
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ayahs_reference_idx ON ayahs (surah_id, number_in_surah);
CREATE INDEX IF NOT EXISTS search_documents_vector_idx ON search_documents USING gin (search_vector);
CREATE INDEX IF NOT EXISTS search_documents_trgm_idx ON search_documents USING gin (normalized_content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS search_documents_embedding_idx ON search_documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

