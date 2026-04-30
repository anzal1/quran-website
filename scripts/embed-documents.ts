import postgres from "postgres";

import { embedText } from "../src/lib/gemini";

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required for embedding generation.");
  }

  const databaseUrl =
    process.env.DATABASE_URL ?? "postgres://quran:quran@localhost:5432/quran_lens";
  const sql = postgres(databaseUrl, { max: 1 });
  const batchSize = Number(process.env.EMBED_BATCH_SIZE || "32");

  const rows = await sql<{ id: string; content: string }[]>`
    SELECT id, content
    FROM search_documents
    WHERE embedding IS NULL
    ORDER BY id
    LIMIT ${batchSize}
  `;

  for (const row of rows) {
    const embedding = await embedText(row.content);
    if (!embedding) continue;

    const vector = `[${embedding.join(",")}]`;
    await sql`
      UPDATE search_documents
      SET embedding = ${vector}::vector
      WHERE id = ${row.id}
    `;
    console.log(`Embedded ${row.id}`);
  }

  await sql.end();
  console.log(`Embedding batch complete. Processed ${rows.length} documents.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

