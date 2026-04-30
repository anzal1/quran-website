const arabicDiacritics =
  /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

export function normalizeArabic(input: string) {
  return input
    .replace(/^\uFEFF/, "")
    .replace(arabicDiacritics, "")
    .replace(/[إأآٱا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s:.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSearchText(input: string) {
  return normalizeArabic(input)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s:.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectReference(input: string) {
  const match = input.match(/\b(\d{1,3})\s*[:.]\s*(\d{1,3})\b/);
  if (!match) return null;

  const surah = Number(match[1]);
  const ayah = Number(match[2]);

  if (surah < 1 || surah > 114 || ayah < 1 || ayah > 286) {
    return null;
  }

  return { surah, ayah, reference: `${surah}:${ayah}` };
}

