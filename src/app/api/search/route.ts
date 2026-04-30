import { NextResponse } from "next/server";
import { z } from "zod";

import { generateGroundedAnswer, hasGemini } from "@/lib/gemini";
import { defaultReadingLanguage, getReadingLanguageByEdition, readingLanguages } from "@/lib/languages";
import { searchQuran } from "@/lib/search";

const allowedEditions = readingLanguages.map((language) => language.edition);

const requestSchema = z.object({
  query: z.string().min(1).max(500),
  mode: z.enum(["quran", "compare", "roots", "reflection"]).default("quran"),
  preferredEdition: z
    .string()
    .refine((edition) => allowedEditions.includes(edition), {
      message: "Unsupported reading language.",
    })
    .default(defaultReadingLanguage.edition),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Send a query between 1 and 500 characters." },
      { status: 400 },
    );
  }

  const { query, mode, preferredEdition } = parsed.data;
  const readingLanguage = getReadingLanguageByEdition(preferredEdition);
  const result = await searchQuran(query, preferredEdition);
  const answer = await generateGroundedAnswer(
    query,
    result.sources,
    readingLanguage.answerLanguage,
  );

  return NextResponse.json({
    query,
    mode,
    preferredEdition,
    answerLanguage: readingLanguage.answerLanguage,
    answer,
    sources: result.sources,
    lenses: result.lenses,
    trail: [query, result.lenses[0] ?? "Quran search"],
    provider: result.provider,
    aiProvider: hasGemini() ? "gemini" : "none",
  });
}
