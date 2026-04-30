import { normalizeSearchText } from "./arabic";
import type { SourceAyah } from "./types";

const sampleSources: SourceAyah[] = [
  {
    ayahId: 160,
    surahId: 2,
    surahName: "Al-Baqara",
    surahMeaning: "The Cow",
    revelationType: "Medinan",
    numberInSurah: 153,
    reference: "2:153",
    arabicText: "يَٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ ٱسْتَعِينُوا۟ بِٱلصَّبْرِ وَٱلصَّلَوٰةِ ۚ إِنَّ ٱللَّهَ مَعَ ٱلصَّٰبِرِينَ",
    translation:
      "O ye who believe! Seek help in steadfastness and prayer. Lo! Allah is with the steadfast.",
    source: "en.pickthall",
    whyMatched: "Connects patience with prayer and support from Allah.",
    score: 0.98,
  },
  {
    ayahId: 162,
    surahId: 2,
    surahName: "Al-Baqara",
    surahMeaning: "The Cow",
    revelationType: "Medinan",
    numberInSurah: 155,
    reference: "2:155",
    arabicText: "وَلَنَبْلُوَنَّكُم بِشَىْءٍۢ مِّنَ ٱلْخَوْفِ وَٱلْجُوعِ وَنَقْصٍۢ مِّنَ ٱلْأَمْوَٰلِ وَٱلْأَنفُسِ وَٱلثَّمَرَٰتِ ۗ وَبَشِّرِ ٱلصَّٰبِرِينَ",
    translation:
      "And surely We shall try you with something of fear and hunger, and loss of wealth and lives and crops; but give glad tidings to the steadfast.",
    source: "en.pickthall",
    whyMatched: "Frames fear and loss as trials answered with steadfastness.",
    score: 0.94,
  },
  {
    ayahId: 1713,
    surahId: 13,
    surahName: "Ar-Ra'd",
    surahMeaning: "The Thunder",
    revelationType: "Medinan",
    numberInSurah: 28,
    reference: "13:28",
    arabicText: "ٱلَّذِينَ ءَامَنُوا۟ وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ ٱللَّهِ ۗ أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ",
    translation:
      "Those who believe and whose hearts find rest in the remembrance of Allah. Verily in the remembrance of Allah do hearts find rest!",
    source: "en.pickthall",
    whyMatched: "Directly addresses inner calm through remembrance.",
    score: 0.93,
  },
  {
    ayahId: 45,
    surahId: 2,
    surahName: "Al-Baqara",
    surahMeaning: "The Cow",
    revelationType: "Medinan",
    numberInSurah: 38,
    reference: "2:38",
    arabicText: "فَمَن تَبِعَ هُدَاىَ فَلَا خَوْفٌ عَلَيْهِمْ وَلَا هُمْ يَحْزَنُونَ",
    translation:
      "And whoso followeth My guidance, there shall no fear come upon them neither shall they grieve.",
    source: "en.pickthall",
    whyMatched: "Links guidance with freedom from fear and grief.",
    score: 0.9,
  },
];

const lensDictionary = [
  "Patience",
  "Prayer",
  "Fear and grief",
  "Remembrance",
  "Trials",
  "Reliance",
  "Mercy",
  "Gratitude",
  "Forgiveness",
  "Justice",
];

export function searchSample(query: string) {
  const normalizedQuery = normalizeSearchText(query);
  const terms = new Set(normalizedQuery.split(" ").filter(Boolean));

  const scored = sampleSources
    .map((source) => {
      const haystack = normalizeSearchText(
        `${source.reference} ${source.surahName} ${source.surahMeaning} ${source.translation} ${source.whyMatched}`,
      );
      const overlap = [...terms].filter((term) => haystack.includes(term)).length;
      return {
        ...source,
        score: Math.max(source.score - 0.12, overlap / Math.max(terms.size, 1)),
      };
    })
    .sort((a, b) => b.score - a.score);

  return {
    sources: scored.slice(0, 4),
    lenses: inferLenses(query),
  };
}

export function inferLenses(query: string) {
  const normalized = normalizeSearchText(query);
  const selected = lensDictionary.filter((lens) => {
    const value = lens.toLowerCase();
    return normalized.includes(value.split(" ")[0]) || value.includes(normalized);
  });

  if (selected.length >= 3) {
    return selected.slice(0, 6);
  }

  if (normalized.includes("anx") || normalized.includes("fear")) {
    return ["Fear and grief", "Remembrance", "Prayer", "Reliance", "Trials"];
  }

  if (normalized.includes("patien") || normalized.includes("sabr")) {
    return ["Patience", "Prayer", "Trials", "Reliance", "Gratitude"];
  }

  return ["Patience", "Remembrance", "Mercy", "Guidance", "Accountability"];
}

