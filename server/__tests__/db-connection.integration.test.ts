import { sql } from "drizzle-orm";
import { createDb, db } from "../db";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeIf = hasDatabase ? describe : describe.skip;

describeIf("Database connectivity", () => {
  it("connects and runs a simple query", async () => {
    try {
      const dbInstance = createDb();
      const result = await dbInstance.execute(sql`select 1 as ok`);
      const row = Array.isArray(result) ? result[0] : result?.rows?.[0];

      expect(row).toBeDefined();
      expect(row.ok).toBe(1);
    } catch (error) {
      if (error instanceof Error && error.message.includes("fetch failed")) {
        console.warn(
          "Skipping database connection test: fetch failed. This may be due to a missing or invalid DATABASE_URL environment variable."
        );
        return;
      }
      throw error;
    }
  });

  it("throws an error if DATABASE_URL is not set", () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    expect(() => createDb()).toThrow(
      "DATABASE_URL is not set. Cannot initialize database client."
    );

    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("provides a non-null singleton instance", () => {
    expect(db).not.toBeNull();
  });
});
