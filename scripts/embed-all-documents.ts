import "./load-env";

import postgres from "postgres";

import { embedText } from "../src/lib/gemini";

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
  const batchSize = Number(process.env.EMBED_BATCH_SIZE || "64");
  const pauseMs = Number(process.env.EMBED_PAUSE_MS || "250");
  let totalEmbedded = 0;

  try {
    while (true) {
      const rows = await sql<SearchDocument[]>`
        SELECT id, content
        FROM search_documents
        WHERE embedding IS NULL
        ORDER BY id
        LIMIT ${batchSize}
      `;

      if (rows.length === 0) break;

      for (const row of rows) {
        const embedding = await embedText(row.content);
        if (!embedding) continue;

        const vector = `[${embedding.join(",")}]`;
        await sql`
          UPDATE search_documents
          SET embedding = ${vector}::vector
          WHERE id = ${row.id}
        `;

        totalEmbedded += 1;
      }

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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
