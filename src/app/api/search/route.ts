import { NextResponse } from "next/server";
import { z } from "zod";

import { generateGroundedAnswer, hasGemini } from "@/lib/gemini";
import { searchQuran } from "@/lib/search";

const requestSchema = z.object({
  query: z.string().min(1).max(500),
  mode: z.enum(["quran", "compare", "roots", "reflection"]).default("quran"),
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

  const { query, mode } = parsed.data;
  const result = await searchQuran(query);
  const answer = await generateGroundedAnswer(query, result.sources);

  return NextResponse.json({
    query,
    mode,
    answer,
    sources: result.sources,
    lenses: result.lenses,
    trail: [query, result.lenses[0] ?? "Quran search"],
    provider: result.provider,
    aiProvider: hasGemini() ? "gemini" : "none",
  });
}

