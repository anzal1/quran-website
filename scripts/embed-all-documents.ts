import "./load-env";

import postgres from "postgres";

import { embedTexts } from "../src/lib/gemini";

type SearchDocument = {
  id: string;
  content: string;
};

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required for embedding generation.");
  }

  const databaseUrl =
    process.env.DATABASE_URL ?? "postgres://quran:quran@localhost:5432/quran_lens";
  const sql = postgres(databaseUrl, { max: 1 });
  const batchSize = Math.min(Number(process.env.EMBED_BATCH_SIZE || "100"), 100);
  const concurrency = Math.max(1, Number(process.env.EMBED_CONCURRENCY || "3"));
  const pauseMs = Number(process.env.EMBED_PAUSE_MS || "250");
  let totalEmbedded = 0;

  try {
    while (true) {
      const rows = await sql<SearchDocument[]>`
        SELECT id, content
        FROM search_documents
        WHERE embedding IS NULL
        ORDER BY id
        LIMIT ${batchSize * concurrency}
      `;

      if (rows.length === 0) break;

      const chunks = chunk(rows, batchSize);
      const embeddingsByChunk = await Promise.all(
        chunks.map((batch) => embedTexts(batch.map((row) => row.content))),
      );

      await sql.begin(async (tx) => {
        for (const [chunkIndex, batch] of chunks.entries()) {
          const embeddings = embeddingsByChunk[chunkIndex] ?? [];
          for (const [index, row] of batch.entries()) {
            const embedding = embeddings[index];
            if (!embedding) continue;

            const vector = `[${embedding.join(",")}]`;
            await tx`
              UPDATE search_documents
              SET embedding = ${vector}::vector
              WHERE id = ${row.id}
            `;

            totalEmbedded += 1;
          }
        }
      });

      const [{ remaining }] = await sql<{ remaining: number }[]>`
        SELECT count(*)::int AS remaining
        FROM search_documents
        WHERE embedding IS NULL
      `;

      console.log(
        `Embedded ${totalEmbedded} documents. ${remaining} documents remaining.`,
      );

      if (pauseMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, pauseMs));
      }
    }
  } finally {
    await sql.end();
  }

  console.log(`All pending embeddings complete. Embedded ${totalEmbedded} documents.`);
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
