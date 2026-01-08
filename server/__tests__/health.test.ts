import express from "express";
import supertest from "supertest";
import { registerRoutes } from "../routes";

describe("GET /api/health", () => {
  it("returns a health payload", async () => {
    const app = express();
    app.use(express.json());
    await registerRoutes(app);

    const response = await supertest(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        status: "ok",
        message: "Meta Tag Analyzer API is healthy",
        version: expect.any(String),
        timestamp: expect.any(String),
      }),
    );
  });
});
