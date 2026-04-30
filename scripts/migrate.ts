import fs from "node:fs/promises";
import path from "node:path";

import postgres from "postgres";

async function main() {
  const databaseUrl =
    process.env.DATABASE_URL ?? "postgres://quran:quran@localhost:5432/quran_lens";
  const sql = postgres(databaseUrl, { max: 1 });
  const migration = await fs.readFile(
    path.join(process.cwd(), "drizzle", "0001_init.sql"),
    "utf8",
  );

  await sql.unsafe(migration);
  await sql.end();
  console.log("Database migration complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

