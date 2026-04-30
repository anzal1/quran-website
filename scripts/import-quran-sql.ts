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

const sqlFile = process.argv[2];
const wantedIdentifiers = new Set(
  (process.env.IMPORT_EDITION_IDENTIFIERS || "en.pickthall,en.sahih,en.yusufali,ar.muyassar")
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
  for await (const statement of readInsertStatements("surahs")) {
    for (const tuple of parseTuples(statement)) {
      await sql`
        INSERT INTO surahs (
          id, number, name_ar, name_en, name_en_translation, revelation_type
        )
        VALUES (
          ${Number(tuple[0])}, ${Number(tuple[1])}, ${String(tuple[2])},
          ${String(tuple[3])}, ${String(tuple[4])}, ${String(tuple[5])}
        )
        ON CONFLICT (id) DO UPDATE SET
          name_ar = EXCLUDED.name_ar,
          name_en = EXCLUDED.name_en,
          name_en_translation = EXCLUDED.name_en_translation,
          revelation_type = EXCLUDED.revelation_type
      `;
    }
  }

  for await (const statement of readInsertStatements("ayahs")) {
    for (const tuple of parseTuples(statement)) {
      const arabicText = String(tuple[2]);
      await sql`
        INSERT INTO ayahs (
          id, global_number, arabic_text, number_in_surah, page, surah_id,
          hizb, juz, sajda, normalized_arabic
        )
        VALUES (
          ${Number(tuple[0])}, ${Number(tuple[1])}, ${arabicText},
          ${Number(tuple[3])}, ${Number(tuple[4])}, ${Number(tuple[5])},
          ${Number(tuple[6])}, ${Number(tuple[7])}, ${Boolean(Number(tuple[8]))},
          ${normalizeArabic(arabicText)}
        )
        ON CONFLICT (id) DO UPDATE SET
          arabic_text = EXCLUDED.arabic_text,
          normalized_arabic = EXCLUDED.normalized_arabic
      `;
    }
  }

  let importedTranslations = 0;
  for await (const statement of readInsertStatements("ayah_edition")) {
    for (const tuple of parseTuples(statement)) {
      const ayahId = Number(tuple[1]);
      const edition = editionsBySourceId.get(Number(tuple[2]));
      if (!edition) continue;
      if (Number(tuple[4]) === 1) continue;

      const text = String(tuple[3]);
      await sql`
        INSERT INTO translations (
          ayah_id, edition_identifier, language, type, text
        )
        VALUES (
          ${ayahId}, ${edition.identifier}, ${edition.language}, ${edition.type}, ${text}
        )
        ON CONFLICT (ayah_id, edition_identifier) DO UPDATE SET
          text = EXCLUDED.text
      `;

      await sql`
        INSERT INTO search_documents (
          id, kind, ayah_id, surah_id, reference, language, title, content,
          normalized_content, source
        )
        SELECT
          ${`ayah:${ayahId}:${edition.identifier}`},
          'ayah',
          a.id,
          a.surah_id,
          s.number || ':' || a.number_in_surah,
          ${edition.language},
          s.name_en || ' ' || s.number || ':' || a.number_in_surah,
          a.arabic_text || E'\n' || ${text},
          ${normalizeSearchText(text)},
          ${edition.identifier}
        FROM ayahs a
        JOIN surahs s ON s.id = a.surah_id
        WHERE a.id = ${ayahId}
        ON CONFLICT (id) DO UPDATE SET
          content = EXCLUDED.content,
          normalized_content = EXCLUDED.normalized_content
      `;

      importedTranslations += 1;
      if (importedTranslations % 1000 === 0) {
        console.log(`Imported ${importedTranslations} selected translation rows.`);
      }
    }
  }
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
