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

export async function generateGroundedAnswer(
  query: string,
  sources: SourceAyah[],
  answerLanguage = "English",
) {
  const ai = getClient();
  if (!ai) {
    return fallbackAnswer(sources, answerLanguage);
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
- Write the answer in ${answerLanguage}.
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

  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || "2500");
  const response = await withTimeout(
    ai.models.generateContent({
      model,
      contents: prompt,
    }),
    timeoutMs,
  ).catch((error) => {
    console.warn("Gemini answer timed out or failed", error);
    return null;
  });

  return response?.text?.trim() || fallbackAnswer(sources, answerLanguage);
}

export async function embedText(text: string) {
  const embeddings = await embedTexts([text]);
  return embeddings[0] ?? null;
}

export async function embedTexts(texts: string[]) {
  const ai = getClient();
  if (!ai || texts.length === 0) return [];

  const model = process.env.GEMINI_EMBEDDING_MODEL || defaultEmbeddingModel;
  const dimensions = Number(process.env.EMBEDDING_DIMENSIONS || "768");
  const response = await ai.models.embedContent({
    model,
    contents: texts,
    config: {
      outputDimensionality: dimensions,
    },
  });

  return (response.embeddings ?? [])
    .map((embedding) => embedding.values ?? [])
    .filter((embedding) => embedding.length > 0);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

function fallbackAnswer(sources: SourceAyah[], answerLanguage = "English") {
  const languageKey = answerLanguage.toLowerCase();

  if (sources.length === 0) {
    const emptyFallbacks: Record<string, string> = {
      arabic:
        "لم أجد مطابقة قوية في البيانات المحملة. جرّب موضوعا أدق أو رقم آية أو كلمة مفتاحية.",
      french:
        "Je n'ai pas trouvé de correspondance forte dans les donnees chargees. Essayez un theme plus precis, une reference de verset ou un mot-cle.",
      german:
        "Ich habe in den geladenen Daten keinen starken Treffer gefunden. Versuche ein genaueres Thema, eine Versreferenz oder ein Stichwort.",
      indonesian:
        "Saya belum menemukan kecocokan kuat dalam data yang dimuat. Coba tema yang lebih spesifik, rujukan ayat, atau kata kunci.",
      turkish:
        "Yuklenen veride guclu bir eslesme bulamadim. Daha belirli bir konu, ayet numarasi veya anahtar kelime deneyin.",
      urdu:
        "لوڈ شدہ ڈیٹا میں مضبوط نتیجہ نہیں ملا۔ کوئی خاص موضوع، آیت کا حوالہ، یا کلیدی لفظ آزمائیں۔",
    };

    return (
      emptyFallbacks[languageKey] ??
      "I could not find a strong Quran-grounded match for that query in the loaded dataset. Try a more specific theme, ayah reference, or keyword."
    );
  }

  const citations = sources
    .slice(0, 3)
    .map((source) => `[${source.reference}]`)
    .join(", ");

  const sourceFallbacks: Record<string, string> = {
    arabic: `أقوى الآيات المسترجعة تظهر معاني الصبر والذكر والهداية والصلاة ${citations}. هذا للمدارسة والتأمل، وليس للفتوى أو القرارات الدينية الشخصية.`,
    french: `Les versets les plus pertinents indiquent la patience, le rappel, la guidance et la priere ${citations}. Ceci sert a l'etude et a la reflexion, pas aux avis juridiques religieux.`,
    german: `Die staerksten gefundenen Verse weisen auf Geduld, Gedenken, Rechtleitung und Gebet hin ${citations}. Dies ist zum Lernen und Nachdenken, nicht fuer Rechtsurteile oder persoenliche religioese Entscheidungen.`,
    indonesian: `Ayat terkuat yang ditemukan menunjuk pada kesabaran, zikir, petunjuk, dan doa ${citations}. Ini untuk belajar dan refleksi, bukan untuk fatwa atau keputusan agama pribadi.`,
    turkish: `Bulunan en guclu ayetler sabir, zikir, hidayet ve namaza isaret ediyor ${citations}. Bu calisma ve tefekkur icindir; dini hukum veya kisisel kararlar icin degildir.`,
    urdu: `سب سے مضبوط ملنے والی آیات صبر، ذکر، ہدایت، اور نماز کی طرف اشارہ کرتی ہیں ${citations}۔ یہ مطالعہ اور غور کے لیے ہے، فتویٰ یا ذاتی دینی فیصلوں کے لیے نہیں۔`,
  };

  return (
    sourceFallbacks[languageKey] ??
    `The strongest retrieved ayahs point to patience, remembrance, guidance, and prayer ${citations}. This is for study and reflection; for rulings or personal religious decisions, ask a qualified scholar.`
  );
}
