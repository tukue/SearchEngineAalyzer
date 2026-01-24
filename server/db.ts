import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@shared/schema";
import { sql } from "drizzle-orm";

export const isDatabaseEnabled = Boolean(process.env.DATABASE_URL);

export type Database = NeonHttpDatabase<typeof schema>;

export function createDb(): Database {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Cannot initialize database client.");
  }

  const sql = neon(process.env.DATABASE_URL);
  return drizzle(sql, { schema });
}

export const db: Database | null = isDatabaseEnabled
  ? (() => {
      try {
        return createDb();
      } catch (error) {
        console.error("Failed to initialize database:", error);
        return null;
      }
    })()
  : null;

export async function checkDatabaseConnection(database: Database): Promise<boolean> {
  try {
    await database.execute(sql`select 1 as ok`);
    return true;
  } catch (error) {
    console.error("Database connectivity check failed:", error);
    return false;
  }
}
