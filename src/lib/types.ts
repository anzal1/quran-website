export type SearchMode = "quran" | "compare" | "roots" | "reflection";

export type SourceAyah = {
  ayahId: number;
  surahId: number;
  surahName: string;
  surahMeaning: string;
  revelationType: string;
  numberInSurah: number;
  reference: string;
  arabicText: string;
  translation: string;
  source: string;
  whyMatched: string;
  score: number;
};

export type SearchResponse = {
  query: string;
  mode: SearchMode;
  answer: string;
  sources: SourceAyah[];
  lenses: string[];
  trail: string[];
  provider: "database" | "demo";
  aiProvider: "gemini" | "none";
};

