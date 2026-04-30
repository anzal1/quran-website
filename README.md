# Quran Lens

Evidence-first Quran search and exploration app.

The first version ships as a portable open-source stack:

- Next.js and TypeScript
- PostgreSQL with pgvector
- Postgres full-text search and trigram fuzzy search
- Gemini as a swappable AI provider
- Docker Compose for local or VPS deployment

## Quick Start

```bash
npm install
npm run local
```

Open `http://localhost:3000`.

The local `.env` file stores the database URL and Gemini key, so you do not need to paste long terminal commands.

The app works without `GEMINI_API_KEY`; it will use grounded non-AI fallback answers. Add a Gemini key to `.env` to enable AI summaries and embeddings.

## Scripts

```bash
npm run lint
npm run build
npm run db:migrate
npm run db:seed
npm run db:embed
npm run db:import:quran -- /path/to/quran.sql
```

## Full Quran Import

See [docs/deployment.md](docs/deployment.md) for importing the AbdullahGhanem Quran SQL dump, embedding documents, and deploying the stack on a VPS.

## Safety Boundary

Quran Lens is a study and exploration tool. It retrieves ayahs, shows citations, and can summarize only from provided sources. It is not a tafsir authority or a replacement for qualified scholarship.
