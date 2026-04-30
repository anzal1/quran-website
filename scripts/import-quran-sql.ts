import "./load-env";

import fs from "node:fs";
import readline from "node:readline";

import postgres from "postgres";

import { normalizeArabic, normalizeSearchText } from "../src/lib/arabic";

type SqlValue = string | number | null;

type Edition = {
  sourceId: number;
  identifier: string;
  language: string;
  name: string;
  englishName: string;
  format: string;
  type: string;
};

type AyahIndexEntry = {
  arabicText: string;
  reference: string;
  surahId: number;
  title: string;
};

const importBatchSize = Number(process.env.IMPORT_BATCH_SIZE || "500");
const sqlFile = process.argv[2];
const wantedIdentifiers = new Set(
  (
    process.env.IMPORT_EDITION_IDENTIFIERS ||
    "en.sahih,ar.muyassar,ur.junagarhi,id.indonesian,tr.diyanet,fr.hamidullah,de.bubenheim"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

if (!sqlFile) {
  console.error("Usage: npm run db:import:quran -- /path/to/quran.sql");
  process.exit(1);
}

async function main() {
  const databaseUrl =
    process.env.DATABASE_URL ?? "postgres://quran:quran@localhost:5432/quran_lens";
  const sql = postgres(databaseUrl, { max: 1 });

  if (process.env.IMPORT_RESET === "true") {
    await sql`
      TRUNCATE
        chat_messages,
        chat_sessions,
        bookmarks,
        search_documents,
        translations,
        editions,
        ayahs,
        surahs
      RESTART IDENTITY CASCADE
    `;
    console.log("Existing Quran Lens data reset.");
  }

  const editionsBySourceId = await importEditions(sql);
  await importCoreTables(sql, editionsBySourceId);

  await sql.end();
  console.log("Quran SQL import complete.");
}

async function importEditions(sql: postgres.Sql) {
  const editions = new Map<number, Edition>();

  for await (const statement of readInsertStatements("editions")) {
    for (const tuple of parseTuples(statement)) {
      const edition: Edition = {
        sourceId: Number(tuple[0]),
        identifier: String(tuple[1]),
        language: String(tuple[2]),
        name: String(tuple[3]),
        englishName: String(tuple[4]),
        format: String(tuple[5]),
        type: String(tuple[6]),
      };

      if (!wantedIdentifiers.has(edition.identifier)) continue;
      editions.set(edition.sourceId, edition);

      await sql`
        INSERT INTO editions (
          source_id, identifier, language, name, english_name, format, type
        )
        VALUES (
          ${edition.sourceId}, ${edition.identifier}, ${edition.language},
          ${edition.name}, ${edition.englishName}, ${edition.format}, ${edition.type}
        )
        ON CONFLICT (identifier) DO UPDATE SET
          source_id = EXCLUDED.source_id,
          language = EXCLUDED.language,
          name = EXCLUDED.name,
          english_name = EXCLUDED.english_name,
          format = EXCLUDED.format,
          type = EXCLUDED.type
      `;
    }
  }

  console.log(`Imported ${editions.size} selected editions.`);
  return editions;
}

async function importCoreTables(sql: postgres.Sql, editionsBySourceId: Map<number, Edition>) {
  const surahsBatch = [];
  for await (const statement of readInsertStatements("surahs")) {
    for (const tuple of parseTuples(statement)) {
      surahsBatch.push({
        id: Number(tuple[0]),
        number: Number(tuple[1]),
        name_ar: String(tuple[2]),
        name_en: String(tuple[3]),
        name_en_translation: String(tuple[4]),
        revelation_type: String(tuple[5]),
      });
    }
  }

  if (surahsBatch.length > 0) {
    await upsertSurahs(sql, surahsBatch);
    console.log(`Imported ${surahsBatch.length} surahs.`);
  }

  const surahNamesById = new Map<number, { number: number; nameEn: string }>();
  for (const surah of surahsBatch) {
    surahNamesById.set(Number(surah.id), {
      number: Number(surah.number),
      nameEn: String(surah.name_en),
    });
  }

  const ayahsById = new Map<number, AyahIndexEntry>();
  let ayahsBatch = [];
  let importedAyahs = 0;
  for await (const statement of readInsertStatements("ayahs")) {
    for (const tuple of parseTuples(statement)) {
      const arabicText = String(tuple[2]);
      const ayahId = Number(tuple[0]);
      const surahId = Number(tuple[5]);
      const numberInSurah = Number(tuple[3]);
      const surah = surahNamesById.get(surahId);
      const reference = `${surah?.number ?? surahId}:${numberInSurah}`;
      const title = `${surah?.nameEn ?? "Surah"} ${reference}`;

      ayahsById.set(ayahId, {
        arabicText,
        reference,
        surahId,
        title,
      });

      ayahsBatch.push({
        id: ayahId,
        global_number: Number(tuple[1]),
        arabic_text: arabicText,
        number_in_surah: numberInSurah,
        page: Number(tuple[4]),
        surah_id: surahId,
        hizb: Number(tuple[6]),
        juz: Number(tuple[7]),
        sajda: Boolean(Number(tuple[8])),
        normalized_arabic: normalizeArabic(arabicText),
      });

      if (ayahsBatch.length >= importBatchSize) {
        await upsertAyahs(sql, ayahsBatch);
        importedAyahs += ayahsBatch.length;
        console.log(`Imported ${importedAyahs} ayahs.`);
        ayahsBatch = [];
      }
    }
  }

  if (ayahsBatch.length > 0) {
    await upsertAyahs(sql, ayahsBatch);
    importedAyahs += ayahsBatch.length;
    console.log(`Imported ${importedAyahs} ayahs.`);
  }

  let translationsBatch = [];
  let documentsBatch = [];
  let importedTranslations = 0;
  for await (const statement of readInsertStatements("ayah_edition")) {
    for (const tuple of parseTuples(statement)) {
      const ayahId = Number(tuple[1]);
      const edition = editionsBySourceId.get(Number(tuple[2]));
      if (!edition) continue;
      if (Number(tuple[4]) === 1) continue;

      const text = String(tuple[3]);
      const ayah = ayahsById.get(ayahId);
      if (!ayah) continue;

      translationsBatch.push({
        ayah_id: ayahId,
        edition_identifier: edition.identifier,
        language: edition.language,
        type: edition.type,
        text,
      });

      documentsBatch.push({
        id: `ayah:${ayahId}:${edition.identifier}`,
        kind: "ayah",
        ayah_id: ayahId,
        surah_id: ayah.surahId,
        reference: ayah.reference,
        language: edition.language,
        title: ayah.title,
        content: `${ayah.arabicText}\n${text}`,
        normalized_content: normalizeSearchText(text),
        source: edition.identifier,
      });

      importedTranslations += 1;

      if (translationsBatch.length >= importBatchSize) {
        await upsertTranslations(sql, translationsBatch);
        await upsertSearchDocuments(sql, documentsBatch);
        console.log(`Imported ${importedTranslations} selected translation rows.`);
        translationsBatch = [];
        documentsBatch = [];
      }
    }
  }

  if (translationsBatch.length > 0) {
    await upsertTranslations(sql, translationsBatch);
    await upsertSearchDocuments(sql, documentsBatch);
    console.log(`Imported ${importedTranslations} selected translation rows.`);
  }
}

async function upsertSurahs(sql: postgres.Sql, rows: Record<string, unknown>[]) {
  await sql`
    INSERT INTO surahs ${sql(rows, "id", "number", "name_ar", "name_en", "name_en_translation", "revelation_type")}
    ON CONFLICT (id) DO UPDATE SET
      name_ar = EXCLUDED.name_ar,
      name_en = EXCLUDED.name_en,
      name_en_translation = EXCLUDED.name_en_translation,
      revelation_type = EXCLUDED.revelation_type
  `;
}

async function upsertAyahs(sql: postgres.Sql, rows: Record<string, unknown>[]) {
  await sql`
    INSERT INTO ayahs ${sql(
      rows,
      "id",
      "global_number",
      "arabic_text",
      "number_in_surah",
      "page",
      "surah_id",
      "hizb",
      "juz",
      "sajda",
      "normalized_arabic",
    )}
    ON CONFLICT (id) DO UPDATE SET
      arabic_text = EXCLUDED.arabic_text,
      normalized_arabic = EXCLUDED.normalized_arabic
  `;
}

async function upsertTranslations(sql: postgres.Sql, rows: Record<string, unknown>[]) {
  await sql`
    INSERT INTO translations ${sql(
      rows,
      "ayah_id",
      "edition_identifier",
      "language",
      "type",
      "text",
    )}
    ON CONFLICT (ayah_id, edition_identifier) DO UPDATE SET
      text = EXCLUDED.text
  `;
}

async function upsertSearchDocuments(sql: postgres.Sql, rows: Record<string, unknown>[]) {
  await sql`
    INSERT INTO search_documents ${sql(
      rows,
      "id",
      "kind",
      "ayah_id",
      "surah_id",
      "reference",
      "language",
      "title",
      "content",
      "normalized_content",
      "source",
    )}
    ON CONFLICT (id) DO UPDATE SET
      embedding = CASE
        WHEN search_documents.content IS DISTINCT FROM EXCLUDED.content THEN NULL
        ELSE search_documents.embedding
      END,
      content = EXCLUDED.content,
      normalized_content = EXCLUDED.normalized_content
  `;
}

async function* readInsertStatements(table: string) {
  const stream = fs.createReadStream(sqlFile!, "utf8");
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let collecting = false;
  let buffer = "";
  const prefix = `INSERT INTO \`${table}\``;

  for await (const line of lines) {
    if (!collecting && line.startsWith(prefix)) {
      collecting = true;
      buffer = `${line}\n`;
      if (line.endsWith(";")) {
        yield buffer;
        collecting = false;
      }
      continue;
    }

    if (!collecting) continue;

    buffer += `${line}\n`;
    if (line.endsWith(";")) {
      yield buffer;
      collecting = false;
    }
  }
}

function parseTuples(statement: string): SqlValue[][] {
  const valuesStart = statement.indexOf("VALUES");
  if (valuesStart === -1) return [];

  const input = statement.slice(valuesStart + "VALUES".length).replace(/;\s*$/, "");
  const tuples: SqlValue[][] = [];
  let tuple: SqlValue[] = [];
  let token = "";
  let inString = false;
  let escaping = false;
  let inTuple = false;

  for (const char of input) {
    if (!inTuple) {
      if (char === "(") {
        inTuple = true;
        tuple = [];
        token = "";
      }
      continue;
    }

    if (inString) {
      if (escaping) {
        token += unescapeMysql(char);
        escaping = false;
      } else if (char === "\\") {
        escaping = true;
      } else if (char === "'") {
        inString = false;
      } else {
        token += char;
      }
      continue;
    }

    if (char === "'") {
      inString = true;
      continue;
    }

    if (char === ",") {
      tuple.push(coerceValue(token));
      token = "";
      continue;
    }

    if (char === ")") {
      tuple.push(coerceValue(token));
      tuples.push(tuple);
      inTuple = false;
      token = "";
      continue;
    }

    token += char;
  }

  return tuples;
}

function coerceValue(value: string): SqlValue {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toUpperCase() === "NULL") return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function unescapeMysql(char: string) {
  switch (char) {
    case "n":
      return "\n";
    case "r":
      return "\r";
    case "t":
      return "\t";
    case "0":
      return "\0";
    default:
      return char;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
