import { getSql, hasDatabase } from "@/db/client";

import { detectReference, normalizeSearchText } from "./arabic";
import { embedText } from "./gemini";
import { inferLenses, searchSample } from "./sample-data";
import type { SourceAyah } from "./types";

type SearchRow = {
  ayah_id: number;
  surah_id: number;
  surah_name: string;
  surah_meaning: string;
  revelation_type: string;
  number_in_surah: number;
  reference: string;
  arabic_text: string;
  translation: string | null;
  source: string | null;
  score: number;
  why_matched: string;
};

export async function searchQuran(query: string) {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      provider: "demo" as const,
      sources: [],
      lenses: ["Patience", "Remembrance", "Prayer", "Guidance"],
    };
  }

  if (!hasDatabase()) {
    const sample = searchSample(trimmed);
    return { provider: "demo" as const, ...sample };
  }

  try {
    const [referenceRows, lexicalRows, vectorRows] = await Promise.all([
      searchReference(trimmed),
      searchLexical(trimmed),
      searchSemantic(trimmed),
    ]);

    const merged = mergeRows([...referenceRows, ...lexicalRows, ...vectorRows]);

    if (merged.length === 0) {
      const sample = searchSample(trimmed);
      return { provider: "demo" as const, ...sample };
    }

    return {
      provider: "database" as const,
      sources: merged.slice(0, 8),
      lenses: inferLenses(trimmed),
    };
  } catch (error) {
    console.error("Search failed, falling back to demo data", error);
    const sample = searchSample(trimmed);
    return { provider: "demo" as const, ...sample };
  }
}

async function searchReference(query: string) {
  const reference = detectReference(query);
  if (!reference) return [];

  const sql = getSql();
  return sql<SearchRow[]>`
    SELECT
      a.id AS ayah_id,
      s.id AS surah_id,
      s.name_en AS surah_name,
      s.name_en_translation AS surah_meaning,
      s.revelation_type,
      a.number_in_surah,
      ${reference.reference} AS reference,
      a.arabic_text,
      t.text AS translation,
      t.edition_identifier AS source,
      10::float AS score,
      'Exact ayah reference match.' AS why_matched
    FROM ayahs a
    JOIN surahs s ON s.id = a.surah_id
    LEFT JOIN translations t ON t.ayah_id = a.id AND t.edition_identifier = 'en.pickthall'
    WHERE a.surah_id = ${reference.surah}
      AND a.number_in_surah = ${reference.ayah}
    LIMIT 1
  `;
}

async function searchLexical(query: string) {
  const sql = getSql();
  const normalized = normalizeSearchText(query);
  const lexicalQuery = buildLexicalQuery(normalized);

  return sql<SearchRow[]>`
    WITH query AS (
      SELECT
        websearch_to_tsquery('simple', ${lexicalQuery}) AS tsq,
        ${normalized}::text AS raw
    ),
    ranked_docs AS (
      SELECT
        sd.ayah_id,
        sd.surah_id,
        sd.reference,
        sd.source,
        ts_rank_cd(sd.search_vector, query.tsq) +
          similarity(sd.normalized_content, query.raw) AS score,
        CASE
          WHEN sd.search_vector @@ query.tsq THEN 'Keyword match in indexed Quran document.'
          ELSE 'Fuzzy phrase match in indexed Quran document.'
        END AS why_matched
      FROM search_documents sd, query
      WHERE sd.ayah_id IS NOT NULL
        AND (
          sd.search_vector @@ query.tsq
          OR sd.normalized_content % query.raw
          OR sd.reference = query.raw
        )
      ORDER BY score DESC
      LIMIT 16
    )
    SELECT
      a.id AS ayah_id,
      s.id AS surah_id,
      s.name_en AS surah_name,
      s.name_en_translation AS surah_meaning,
      s.revelation_type,
      a.number_in_surah,
      s.number || ':' || a.number_in_surah AS reference,
      a.arabic_text,
      COALESCE(t.text, rd.reference) AS translation,
      COALESCE(t.edition_identifier, rd.source) AS source,
      rd.score::float,
      rd.why_matched
    FROM ranked_docs rd
    JOIN ayahs a ON a.id = rd.ayah_id
    JOIN surahs s ON s.id = a.surah_id
    LEFT JOIN translations t ON t.ayah_id = a.id AND t.edition_identifier = 'en.pickthall'
    ORDER BY rd.score DESC
    LIMIT 10
  `;
}

async function searchSemantic(query: string) {
  const embedding = await embedText(query);
  if (!embedding) return [];

  const sql = getSql();
  const vector = `[${embedding.join(",")}]`;

  return sql<SearchRow[]>`
    WITH ranked_docs AS (
      SELECT
        sd.ayah_id,
        sd.surah_id,
        sd.reference,
        sd.source,
        1 - (sd.embedding <=> ${vector}::vector) AS score,
        'Semantic match from Gemini embedding search.' AS why_matched
      FROM search_documents sd
      WHERE sd.embedding IS NOT NULL
        AND sd.ayah_id IS NOT NULL
      ORDER BY sd.embedding <=> ${vector}::vector
      LIMIT 12
    )
    SELECT
      a.id AS ayah_id,
      s.id AS surah_id,
      s.name_en AS surah_name,
      s.name_en_translation AS surah_meaning,
      s.revelation_type,
      a.number_in_surah,
      s.number || ':' || a.number_in_surah AS reference,
      a.arabic_text,
      COALESCE(t.text, rd.reference) AS translation,
      COALESCE(t.edition_identifier, rd.source) AS source,
      rd.score::float,
      rd.why_matched
    FROM ranked_docs rd
    JOIN ayahs a ON a.id = rd.ayah_id
    JOIN surahs s ON s.id = a.surah_id
    LEFT JOIN translations t ON t.ayah_id = a.id AND t.edition_identifier = 'en.pickthall'
    ORDER BY rd.score DESC
  `;
}

function mergeRows(rows: SearchRow[]): SourceAyah[] {
  const byAyah = new Map<number, SourceAyah>();

  for (const row of rows) {
    const current = byAyah.get(row.ayah_id);
    const source: SourceAyah = {
      ayahId: row.ayah_id,
      surahId: row.surah_id,
      surahName: row.surah_name,
      surahMeaning: row.surah_meaning,
      revelationType: row.revelation_type,
      numberInSurah: row.number_in_surah,
      reference: row.reference,
      arabicText: row.arabic_text,
      translation: row.translation || "Translation not loaded for this ayah.",
      source: row.source || "arabic",
      whyMatched: row.why_matched,
      score: Number(row.score),
    };

    if (!current || source.score > current.score) {
      byAyah.set(row.ayah_id, source);
    }
  }

  return [...byAyah.values()].sort((a, b) => b.score - a.score);
}

function buildLexicalQuery(normalized: string) {
  const stopwords = new Set([
    "a",
    "an",
    "and",
    "are",
    "about",
    "does",
    "for",
    "how",
    "i",
    "is",
    "me",
    "of",
    "on",
    "quran",
    "say",
    "says",
    "show",
    "the",
    "to",
    "what",
    "when",
    "where",
    "with",
  ]);

  const terms = normalized
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1 && !stopwords.has(term));

  return terms.length > 0 ? terms.join(" ") : normalized;
}
