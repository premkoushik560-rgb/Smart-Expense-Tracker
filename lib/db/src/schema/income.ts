import { createInsertSchema } from "drizzle-zod";
import { date, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const incomeTable = pgTable("income", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
  date: date("date", { mode: "string" }).notNull(),
  source: text("source").notNull(),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIncomeSchema = createInsertSchema(incomeTable).omit({
  id: true,
  createdAt: true,
});
export type InsertIncome = z.infer<typeof insertIncomeSchema>;
export type Income = typeof incomeTable.$inferSelect;