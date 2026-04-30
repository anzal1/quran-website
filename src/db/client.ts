import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

declare global {
  var quranLensSql: postgres.Sql | undefined;
}

export function hasDatabase() {
  return Boolean(databaseUrl);
}

export function getSql() {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  globalThis.quranLensSql ??= postgres(databaseUrl, {
    max: 8,
    prepare: false,
  });

  return globalThis.quranLensSql;
}

export function getDb() {
  return drizzle(getSql(), { schema });
}

