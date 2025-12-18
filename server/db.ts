import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@shared/schema";

export const isDatabaseEnabled = Boolean(process.env.DATABASE_URL);

export type Database = NeonHttpDatabase<typeof schema>;

export function createDb(): Database {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Cannot initialize database client.");
  }

  const sql = neon(process.env.DATABASE_URL);
  return drizzle(sql, { schema });
}

export const db: Database | null = isDatabaseEnabled ? createDb() : null;
