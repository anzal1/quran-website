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

Set `GEMINI_API_KEY` in `.env`. The app uses `GEMINI_MODEL`, defaulting to `gemini-2.5-flash`, and `GEMINI_EMBEDDING_MODEL`, defaulting to `gemini-embedding-001`.

Without a key, search still works against the loaded data and returns a non-AI fallback answer.

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

Generate semantic vectors in batches:

```bash
npm run db:embed
```

Run `npm run db:embed` repeatedly or increase `EMBED_BATCH_SIZE`.

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

