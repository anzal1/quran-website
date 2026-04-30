import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  bigserial,
} from "drizzle-orm/pg-core";

export const surahs = pgTable("surahs", {
  id: integer("id").primaryKey(),
  number: integer("number").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  nameEnTranslation: text("name_en_translation").notNull(),
  revelationType: text("revelation_type").notNull(),
});

export const ayahs = pgTable(
  "ayahs",
  {
    id: integer("id").primaryKey(),
    globalNumber: integer("global_number").notNull().unique(),
    surahId: integer("surah_id")
      .notNull()
      .references(() => surahs.id, { onDelete: "cascade" }),
    numberInSurah: integer("number_in_surah").notNull(),
    page: integer("page"),
    juz: integer("juz"),
    hizb: integer("hizb"),
    sajda: boolean("sajda").notNull().default(false),
    arabicText: text("arabic_text").notNull(),
    normalizedArabic: text("normalized_arabic").notNull(),
  },
  (table) => [unique().on(table.surahId, table.numberInSurah)],
);

export const editions = pgTable("editions", {
  identifier: text("identifier").primaryKey(),
  sourceId: integer("source_id").unique(),
  language: text("language").notNull(),
  name: text("name").notNull(),
  englishName: text("english_name").notNull(),
  format: text("format").notNull(),
  type: text("type").notNull(),
});

export const translations = pgTable(
  "translations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ayahId: integer("ayah_id")
      .notNull()
      .references(() => ayahs.id, { onDelete: "cascade" }),
    editionIdentifier: text("edition_identifier")
      .notNull()
      .references(() => editions.identifier, { onDelete: "cascade" }),
    language: text("language").notNull(),
    type: text("type").notNull(),
    text: text("text").notNull(),
  },
  (table) => [unique().on(table.ayahId, table.editionIdentifier)],
);

export const searchDocuments = pgTable("search_documents", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  ayahId: integer("ayah_id").references(() => ayahs.id, { onDelete: "cascade" }),
  surahId: integer("surah_id").references(() => surahs.id, { onDelete: "cascade" }),
  reference: text("reference").notNull(),
  language: text("language").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  normalizedContent: text("normalized_content").notNull(),
  source: text("source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    ayahId: integer("ayah_id")
      .notNull()
      .references(() => ayahs.id, { onDelete: "cascade" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.userId, table.ayahId)],
);

export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id"),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => chatSessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  citations: jsonb("citations").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

