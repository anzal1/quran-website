import { NextResponse } from "next/server";

import { getSql, hasDatabase } from "@/db/client";
import { hasGemini } from "@/lib/gemini";

export async function GET() {
  let database = "not configured";

  if (hasDatabase()) {
    try {
      await getSql()`SELECT 1`;
      database = "ok";
    } catch {
      database = "unreachable";
    }
  }

  return NextResponse.json({
    app: "ok",
    database,
    gemini: hasGemini() ? "configured" : "not configured",
  });
}

