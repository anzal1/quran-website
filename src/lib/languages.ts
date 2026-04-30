export type ReadingLanguage = {
  code: string;
  label: string;
  nativeLabel: string;
  shortLabel: string;
  edition: string;
  answerLanguage: string;
  direction: "ltr" | "rtl";
  sourceLabel: string;
};

export const readingLanguages = [
  {
    code: "en",
    label: "English",
    nativeLabel: "English",
    shortLabel: "EN",
    edition: "en.sahih",
    answerLanguage: "English",
    direction: "ltr",
    sourceLabel: "Saheeh International",
  },
  {
    code: "ar",
    label: "Arabic",
    nativeLabel: "العربية",
    shortLabel: "AR",
    edition: "ar.muyassar",
    answerLanguage: "Arabic",
    direction: "rtl",
    sourceLabel: "Tafsir Al-Muyassar",
  },
  {
    code: "ur",
    label: "Urdu",
    nativeLabel: "اردو",
    shortLabel: "UR",
    edition: "ur.junagarhi",
    answerLanguage: "Urdu",
    direction: "rtl",
    sourceLabel: "Muhammad Junagarhi",
  },
  {
    code: "id",
    label: "Indonesian",
    nativeLabel: "Bahasa Indonesia",
    shortLabel: "ID",
    edition: "id.indonesian",
    answerLanguage: "Indonesian",
    direction: "ltr",
    sourceLabel: "Bahasa Indonesia",
  },
  {
    code: "tr",
    label: "Turkish",
    nativeLabel: "Türkçe",
    shortLabel: "TR",
    edition: "tr.diyanet",
    answerLanguage: "Turkish",
    direction: "ltr",
    sourceLabel: "Diyanet İşleri",
  },
  {
    code: "fr",
    label: "French",
    nativeLabel: "Français",
    shortLabel: "FR",
    edition: "fr.hamidullah",
    answerLanguage: "French",
    direction: "ltr",
    sourceLabel: "Muhammad Hamidullah",
  },
  {
    code: "de",
    label: "German",
    nativeLabel: "Deutsch",
    shortLabel: "DE",
    edition: "de.bubenheim",
    answerLanguage: "German",
    direction: "ltr",
    sourceLabel: "Bubenheim & Elyas",
  },
] satisfies ReadingLanguage[];

export const defaultReadingLanguage = readingLanguages[0];

export function getReadingLanguageByEdition(edition?: string) {
  return (
    readingLanguages.find((language) => language.edition === edition) ??
    defaultReadingLanguage
  );
}

export function getReadingLanguageByCode(code?: string) {
  return (
    readingLanguages.find((language) => language.code === code) ??
    defaultReadingLanguage
  );
}
