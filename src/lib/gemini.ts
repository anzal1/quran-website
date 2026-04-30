import { GoogleGenAI } from "@google/genai";

import type { SourceAyah } from "./types";

const defaultModel = "gemini-flash-latest";
const defaultEmbeddingModel = "gemini-embedding-001";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

export function hasGemini() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function generateGroundedAnswer(query: string, sources: SourceAyah[]) {
  const ai = getClient();
  if (!ai) {
    return fallbackAnswer(sources);
  }

  const model = process.env.GEMINI_MODEL || defaultModel;
  const sourceText = sources
    .slice(0, 6)
    .map(
      (source) =>
        `[${source.reference}] ${source.surahName} ${source.numberInSurah}\nArabic: ${source.arabicText}\nTranslation (${source.source}): ${source.translation}`,
    )
    .join("\n\n");

  const prompt = `You are Quran Lens, an evidence-first Quran exploration assistant.

Rules:
- Answer only from the provided ayah sources.
- Do not issue fatwas, legal rulings, or claims outside the sources.
- Keep the answer very concise and calm.
- Use simple wording for a general reader.
- Do not quote long translation fragments; summarize the theme.
- Every factual sentence must include one or more citations like [2:153].
- If the sources are not enough, say that the retrieved ayahs are limited.
- Make clear in one short sentence that this is for study, not rulings.

User question: ${query}

Sources:
${sourceText}

Return no more than 85 words total. Use 2 short paragraphs and no markdown table.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text?.trim() || fallbackAnswer(sources);
}

export async function embedText(text: string) {
  const ai = getClient();
  if (!ai) return null;

  const model = process.env.GEMINI_EMBEDDING_MODEL || defaultEmbeddingModel;
  const dimensions = Number(process.env.EMBEDDING_DIMENSIONS || "768");
  const response = await ai.models.embedContent({
    model,
    contents: text,
    config: {
      outputDimensionality: dimensions,
    },
  });

  const embedding = response.embeddings?.[0]?.values;
  return embedding && embedding.length > 0 ? embedding : null;
}

function fallbackAnswer(sources: SourceAyah[]) {
  if (sources.length === 0) {
    return "I could not find a strong Quran-grounded match for that query in the loaded dataset. Try a more specific theme, ayah reference, or Arabic/English keyword.";
  }

  const citations = sources
    .slice(0, 3)
    .map((source) => `[${source.reference}]`)
    .join(", ");

  return `The strongest retrieved ayahs point to patience, remembrance, guidance, and prayer ${citations}. This is for study and reflection; for rulings or personal religious decisions, ask a qualified scholar.`;
}
