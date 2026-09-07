import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const movements = sqliteTable("movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  category: text("category").notNull(),
  note: text("note").notNull().default(""),
  occurredOn: text("occurred_on").notNull(),
  createdAt: text("created_at").notNull(),
});

export const budgets = sqliteTable(
  "budgets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    periodKey: text("period_key").notNull(),
    amountCents: integer("amount_cents").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("budgets_period_key_unique").on(table.periodKey)]
);

export const goals = sqliteTable("goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind", { enum: ["saving", "debt"] }).notNull(),
  name: text("name").notNull(),
  targetCents: integer("target_cents").notNull(),
  currentCents: integer("current_cents").notNull().default(0),
  dueDate: text("due_date"),
  createdAt: text("created_at").notNull(),
});
