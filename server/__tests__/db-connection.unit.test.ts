import type { Database } from "../db";
import { checkDatabaseConnection } from "../db";

describe("checkDatabaseConnection", () => {
  it("returns true when the query succeeds", async () => {
    const execute = jest.fn().mockResolvedValue([{ ok: 1 }]);
    const db = { execute } as unknown as Database;

    const result = await checkDatabaseConnection(db);

    expect(result).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("returns false when the query fails", async () => {
    const execute = jest.fn().mockRejectedValue(new Error("connection failed"));
    const db = { execute } as unknown as Database;

    const result = await checkDatabaseConnection(db);

    expect(result).toBe(false);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
