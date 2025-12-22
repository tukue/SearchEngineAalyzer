import express, { type Express, type NextFunction, type Request, type Response } from "express";
import type { Server } from "http";
import { registerRoutes, type RegisterRoutesOptions, type RegisterRoutesResult } from "./routes";
import { log, serveStatic, setupVite } from "./vite";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitBuckets = new Map<string, RateLimitEntry>();

function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const requestOrigin = req.headers.origin;
  if (!allowedOrigins || allowedOrigins.length === 0) {
    res.header("Access-Control-Allow-Origin", requestOrigin ?? "*");
  } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.header("Access-Control-Allow-Origin", requestOrigin);
  }

  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-tenant-id, x-user-id, x-tenant-role");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
}

function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
  const limit = Number(process.env.RATE_LIMIT_MAX ?? 60);
  const now = Date.now();
  const key = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "global";

  const entry = rateLimitBuckets.get(key) ?? { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count += 1;
  rateLimitBuckets.set(key, entry);

  res.setHeader("X-RateLimit-Limit", limit);
  res.setHeader("X-RateLimit-Remaining", Math.max(limit - entry.count, 0));
  res.setHeader("X-RateLimit-Reset", entry.resetAt);

  if (entry.count > limit) {
    return res.status(429).json({ message: "Rate limit exceeded" });
  }

  next();
}

export interface BootstrapOptions extends RegisterRoutesOptions {
  enableStatic?: boolean;
  enableDevServer?: boolean;
}

export interface BootstrapResult extends RegisterRoutesResult {}

export async function bootstrapApp({
  enableStatic = true,
  enableDevServer = false,
  createServer = true,
}: BootstrapOptions = {}): Promise<BootstrapResult> {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(corsMiddleware);
  app.use("/api", rateLimitMiddleware);

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }

        log(logLine);
      }
    });

    next();
  });

  const { app: routedApp, server } = await registerRoutes(app, { createServer });

  routedApp.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (enableDevServer && routedApp.get("env") === "development") {
    await setupVite(routedApp, server as Server);
  } else if (enableStatic) {
    serveStatic(routedApp);
  }

  return { app: routedApp, server };
}
