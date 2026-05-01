# Quran Lens Deployment

This app is designed to run without hosted lock-in. The default production shape is a Docker Compose stack with Next.js and Postgres plus pgvector.

## Local Run

```bash
cp .env.example .env
docker compose up -d postgres
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

## Gemini

Set `GEMINI_API_KEY` in `.env`. The app uses `GEMINI_MODEL`, defaulting to `gemini-flash-latest`, and `GEMINI_EMBEDDING_MODEL`, defaulting to `gemini-embedding-001`.

`gemini-flash-latest` tracks Google's newest Flash model family release. For stricter production stability, pin `GEMINI_MODEL` to a specific stable model string instead.

Without a key, search still works against the loaded data and returns a non-AI fallback answer.

`GEMINI_TIMEOUT_MS` defaults to `2500`. If Gemini is slow, the app returns the verse-backed fallback answer instead of making users wait indefinitely.

## Production URL

Set `NEXT_PUBLIC_SITE_URL` to the final deployed URL, for example `https://your-domain.com`. This is used for canonical URLs, Open Graph previews, and the sitemap.

## Importing AbdullahGhanem/quran-database

Download and unzip the upstream dump:

```bash
git clone --depth 1 https://github.com/AbdullahGhanem/quran-database.git /tmp/quran-database
unzip /tmp/quran-database/quran.sql.zip -d /tmp/quran-database
```

Import selected editions:

```bash
IMPORT_EDITION_IDENTIFIERS=en.pickthall,en.sahih,en.yusufali,ar.muyassar \
npm run db:import:quran -- /tmp/quran-database/quran.sql
```

For a small first production launch, use one English translation plus Arabic commentary/search support, for example:

```bash
IMPORT_EDITION_IDENTIFIERS=en.sahih,ar.muyassar \
npm run db:import:quran -- /tmp/quran-database/quran.sql
```

For a multilingual production launch, import the languages exposed in the app:

```bash
IMPORT_RESET=true \
IMPORT_EDITION_IDENTIFIERS=en.sahih,ar.muyassar,ur.junagarhi,id.indonesian,tr.diyanet,fr.hamidullah,de.bubenheim \
npm run db:import:quran -- /tmp/quran-database/quran.sql
```

Use `IMPORT_RESET=true` only for the initial production load or a deliberate full reimport. It clears existing Quran rows, bookmarks, and chat rows before loading the upstream dataset.

Generate semantic vectors for every imported search document:

```bash
EMBED_BATCH_SIZE=100 EMBED_CONCURRENCY=3 npm run db:embed:all
```

Or generate one batch at a time:

```bash
npm run db:embed
```

The import is idempotent. Re-running it updates existing rows and leaves already-generated embeddings in place unless the document content changes.

Expected production counts for one translation are roughly 114 surahs, 6,236 ayahs, 6,236 translations, and 6,236 search documents. Each extra selected translation adds another 6,236 translation/search-document rows and more embedding work. The multilingual import above creates roughly 43,652 searchable documents.

Until embeddings are generated, the app automatically skips semantic vector search and uses fast reference, keyword, and fuzzy search. Set `ENABLE_SEMANTIC_SEARCH=false` if you ever need to force vector search off in production.

The completed multilingual embedding export is published at [anzal1/quran-lens-embeddings](https://github.com/anzal1/quran-lens-embeddings). It contains the 43,652 precomputed vectors without translation text.

## Custom Domain

Use a subdomain for the Quran app so the portfolio can keep the root domain. A clean choice is:

```text
quran.your-domain.com
```

In Vercel, add the subdomain under Project Settings -> Domains. In your domain DNS, add the record Vercel shows, usually a `CNAME` from the subdomain to `cname.vercel-dns.com`.

Set `NEXT_PUBLIC_SITE_URL` to the final subdomain after it is verified.

## VPS Deployment

On any Ubuntu VPS with Docker installed:

```bash
git clone <your-repo-url> quran-lens
cd quran-lens
cp .env.example .env
docker compose up -d --build
docker compose exec app npm run db:migrate
docker compose exec app npm run db:seed
```

Put Caddy or Nginx in front for HTTPS. The app container listens on port `3000`.
