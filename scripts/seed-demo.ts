import "./load-env";

import postgres from "postgres";

import { normalizeArabic, normalizeSearchText } from "../src/lib/arabic";
import { searchSample } from "../src/lib/sample-data";

const demoSurahs = [
  {
    id: 2,
    number: 2,
    nameAr: "سورة البقرة",
    nameEn: "Al-Baqara",
    nameEnTranslation: "The Cow",
    revelationType: "Medinan",
  },
  {
    id: 13,
    number: 13,
    nameAr: "سورة الرعد",
    nameEn: "Ar-Ra'd",
    nameEnTranslation: "The Thunder",
    revelationType: "Medinan",
  },
];

async function main() {
  const databaseUrl =
    process.env.DATABASE_URL ?? "postgres://quran:quran@localhost:5432/quran_lens";
  const sql = postgres(databaseUrl, { max: 1 });

  await sql.begin(async (tx) => {
    for (const surah of demoSurahs) {
      await tx`
        INSERT INTO surahs (
          id, number, name_ar, name_en, name_en_translation, revelation_type
        )
        VALUES (
          ${surah.id}, ${surah.number}, ${surah.nameAr}, ${surah.nameEn},
          ${surah.nameEnTranslation}, ${surah.revelationType}
        )
        ON CONFLICT (id) DO UPDATE SET
          name_ar = EXCLUDED.name_ar,
          name_en = EXCLUDED.name_en,
          name_en_translation = EXCLUDED.name_en_translation,
          revelation_type = EXCLUDED.revelation_type
      `;
    }

    await tx`
      INSERT INTO editions (
        identifier, source_id, language, name, english_name, format, type
      )
      VALUES (
        'en.pickthall', 18, 'en', 'Pickthall',
        'Mohammed Marmaduke William Pickthall', 'text', 'translation'
      )
      ON CONFLICT (identifier) DO UPDATE SET
        english_name = EXCLUDED.english_name
    `;

    for (const source of searchSample("patience anxiety remembrance").sources) {
      await tx`
        INSERT INTO ayahs (
          id, global_number, surah_id, number_in_surah, page, juz, hizb,
          sajda, arabic_text, normalized_arabic
        )
        VALUES (
          ${source.ayahId}, ${source.ayahId}, ${source.surahId},
          ${source.numberInSurah}, NULL, NULL, NULL, false,
          ${source.arabicText}, ${normalizeArabic(source.arabicText)}
        )
        ON CONFLICT (id) DO UPDATE SET
          arabic_text = EXCLUDED.arabic_text,
          normalized_arabic = EXCLUDED.normalized_arabic
      `;

      await tx`
        INSERT INTO translations (
          ayah_id, edition_identifier, language, type, text
        )
        VALUES (
          ${source.ayahId}, 'en.pickthall', 'en', 'translation',
          ${source.translation}
        )
        ON CONFLICT (ayah_id, edition_identifier) DO UPDATE SET
          text = EXCLUDED.text
      `;

      const title = `${source.reference} ${source.surahName}`;
      const content = `${source.arabicText}\n${source.translation}\n${source.whyMatched}`;
      await tx`
        INSERT INTO search_documents (
          id, kind, ayah_id, surah_id, reference, language, title,
          content, normalized_content, source
        )
        VALUES (
          ${`ayah:${source.ayahId}:en.pickthall`}, 'ayah', ${source.ayahId},
          ${source.surahId}, ${source.reference}, 'en', ${title}, ${content},
          ${normalizeSearchText(content)}, 'en.pickthall'
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          normalized_content = EXCLUDED.normalized_content
      `;
    }
  });

  await sql.end();
  console.log("Demo Quran Lens data seeded.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
