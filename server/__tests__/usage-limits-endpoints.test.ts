import request from "supertest";
import express, { Express } from "express";
import { registerRoutes } from "../routes";
import { MemStorage } from "../storage";
import { PLAN_CONFIGS } from "@shared/schema";

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.API_AUTH_TOKEN = 'disabled';

// Mock the storage module
jest.mock("../storage", () => {
  const mockStorage = new (jest.requireActual("../storage").MemStorage)();
  return {
    storage: mockStorage,
    getDefaultTenantContext: async () => ({
      tenantId: 1,
      plan: "free"
    })
  };
});

describe("Usage Limits Endpoints", () => {
  let app: Express;
  let server: any;
  let mockStorage: MemStorage;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    
    // Get the mocked storage instance and reset it
    mockStorage = require("../storage").storage;
    
    // Clear all usage data before each test
    mockStorage['usageLedger'] = new Map();
    mockStorage['monthlyUsage'] = new Map();
    
    server = await registerRoutes(app);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/usage/current", () => {
    it("should return current usage status", async () => {
      const response = await request(app)
        .get("/api/usage/current")
        .expect(200);

      expect(response.body).toMatchObject({
        period: expect.any(String),
        used: 0,
        limit: PLAN_CONFIGS.free.monthlyAuditLimit,
        warning_level: "none"
      });
    });
  });

  describe("GET /api/me/entitlements", () => {
    it("should return current entitlements", async () => {
      const response = await request(app)
        .get("/api/me/entitlements")
        .expect(200);

      expect(response.body).toMatchObject({
        plan: "free",
        limits: {
          monthlyAuditLimit: PLAN_CONFIGS.free.monthlyAuditLimit,
          historyDepth: PLAN_CONFIGS.free.historyDepth
        },
        features: {
          exportsEnabled: PLAN_CONFIGS.free.exportsEnabled
        }
      });
    });
  });
});
