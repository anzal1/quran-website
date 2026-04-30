import { getSql, hasDatabase } from "@/db/client";

import { detectReference, normalizeSearchText } from "./arabic";
import { embedText } from "./gemini";
import { defaultReadingLanguage, getReadingLanguageByEdition } from "./languages";
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

let embeddedDocumentsCache: { checkedAt: number; hasEmbeddings: boolean } | null = null;
const embeddedDocumentsCacheMs = 60_000;

export async function searchQuran(
  query: string,
  preferredEdition = defaultReadingLanguage.edition,
) {
  const trimmed = query.trim();
  const readingLanguage = getReadingLanguageByEdition(preferredEdition);
  const edition = readingLanguage.edition;

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
    if (detectReference(trimmed)) {
      const referenceRows = await searchReference(trimmed, edition);
      const merged = mergeRows(referenceRows);

      if (merged.length > 0) {
        return {
          provider: "database" as const,
          sources: merged.slice(0, 3),
          lenses: inferLenses(trimmed),
        };
      }
    }

    const canSearchSemantically = await hasEmbeddedDocuments();
    const [referenceRows, lexicalRows, vectorRows] = await Promise.all([
      searchReference(trimmed, edition),
      searchLexical(trimmed, edition),
      canSearchSemantically ? searchSemantic(trimmed, edition) : Promise.resolve([]),
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

async function hasEmbeddedDocuments() {
  if (process.env.ENABLE_SEMANTIC_SEARCH === "false") return false;

  const now = Date.now();
  if (
    embeddedDocumentsCache &&
    now - embeddedDocumentsCache.checkedAt < embeddedDocumentsCacheMs
  ) {
    return embeddedDocumentsCache.hasEmbeddings;
  }

  const sql = getSql();
  const [row] = await sql<{ has_embeddings: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM search_documents
      WHERE embedding IS NOT NULL
      LIMIT 1
    ) AS has_embeddings
  `;

  embeddedDocumentsCache = {
    checkedAt: now,
    hasEmbeddings: Boolean(row?.has_embeddings),
  };

  return embeddedDocumentsCache.hasEmbeddings;
}

async function searchReference(query: string, preferredEdition: string) {
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
    LEFT JOIN LATERAL (
      SELECT text, edition_identifier
      FROM translations
      WHERE ayah_id = a.id
        AND edition_identifier IN (${preferredEdition}, 'en.sahih', 'en.pickthall')
      ORDER BY CASE
        WHEN edition_identifier = ${preferredEdition} THEN 0
        WHEN edition_identifier = 'en.sahih' THEN 1
        WHEN edition_identifier = 'en.pickthall' THEN 2
        ELSE 3
      END
      LIMIT 1
    ) t ON true
    WHERE a.surah_id = ${reference.surah}
      AND a.number_in_surah = ${reference.ayah}
    LIMIT 1
  `;
}

async function searchLexical(query: string, preferredEdition: string) {
  const sql = getSql();
  const normalized = normalizeSearchText(query);
  const lexicalQuery = buildLexicalQuery(normalized);
  const preferredLanguage = getReadingLanguageByEdition(preferredEdition).code;

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
        sd.language,
        ts_rank_cd(sd.search_vector, query.tsq) +
          similarity(sd.normalized_content, query.raw) +
          CASE
            WHEN sd.source = ${preferredEdition} THEN 0.25
            WHEN sd.language = ${preferredLanguage} THEN 0.12
            ELSE 0
          END AS score,
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
    LEFT JOIN LATERAL (
      SELECT text, edition_identifier
      FROM translations
      WHERE ayah_id = a.id
        AND edition_identifier IN (${preferredEdition}, rd.source, 'en.sahih', 'en.pickthall')
      ORDER BY CASE
        WHEN edition_identifier = ${preferredEdition} THEN 0
        WHEN edition_identifier = rd.source THEN 1
        WHEN edition_identifier = 'en.sahih' THEN 2
        WHEN edition_identifier = 'en.pickthall' THEN 3
        ELSE 4
      END
      LIMIT 1
    ) t ON true
    ORDER BY rd.score DESC
    LIMIT 10
  `;
}

async function searchSemantic(query: string, preferredEdition: string) {
  const embedding = await embedText(query);
  if (!embedding) return [];

  const sql = getSql();
  const vector = `[${embedding.join(",")}]`;
  const preferredLanguage = getReadingLanguageByEdition(preferredEdition).code;

  return sql<SearchRow[]>`
    WITH ranked_docs AS (
      SELECT
        sd.ayah_id,
        sd.surah_id,
        sd.reference,
        sd.source,
        1 - (sd.embedding <=> ${vector}::vector) +
          CASE
            WHEN sd.source = ${preferredEdition} THEN 0.08
            WHEN sd.language = ${preferredLanguage} THEN 0.04
            ELSE 0
          END AS score,
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
    LEFT JOIN LATERAL (
      SELECT text, edition_identifier
      FROM translations
      WHERE ayah_id = a.id
        AND edition_identifier IN (${preferredEdition}, rd.source, 'en.sahih', 'en.pickthall')
      ORDER BY CASE
        WHEN edition_identifier = ${preferredEdition} THEN 0
        WHEN edition_identifier = rd.source THEN 1
        WHEN edition_identifier = 'en.sahih' THEN 2
        WHEN edition_identifier = 'en.pickthall' THEN 3
        ELSE 4
      END
      LIMIT 1
    ) t ON true
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
      direction: getReadingLanguageByEdition(row.source || undefined).direction,
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

  return terms.length > 0 ? terms.join(" OR ") : normalized;
}
