import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  vector,
} from "drizzle-orm/pg-core";

export const userSystemEnum = pgEnum("user_system_enum", ["assistant", "user"]);

const timestamps = {
  updated_at: timestamp(),
  created_at: timestamp().defaultNow().notNull(),
  deleted_at: timestamp(),
};

export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  pdfName: text("pdf_name").notNull(),
  pdfUrl: text("pdf_url").notNull(),
  content: text("content").notNull(),
  fileKey: text("file_key").notNull(),
  userId: varchar("user_id", { length: 258 }).notNull(),
  ...timestamps,
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id")
    .references(() => chats.id, { onDelete: "cascade" })
    .notNull(),
  body: text("body").notNull(),
  role: userSystemEnum("role").notNull(),
  ...timestamps,
});

export const embeddings = pgTable(
  "embeddings",
  {
    id: serial("id").primaryKey(),
    chatId: integer("chat_id").references(() => chats.id, {
      onDelete: "cascade",
    }),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  },
  (table) => [
    index("embeddingIndex").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export type SelectChat = typeof chats.$inferSelect;
