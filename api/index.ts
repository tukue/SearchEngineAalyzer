import express from "express";
import { registerRoutes } from "../server/routes";

// Vercel invokes this file as a serverless function. We reuse the existing
// Express router wiring from server/routes without starting a listener. The
// app instance is cached across invocations for warm starts.
let appPromise: Promise<express.Express> | null = null;

async function createApp(): Promise<express.Express> {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  await registerRoutes(app);

  // Basic error handler mirroring the production server behaviour
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err?.status || err?.statusCode || 500;
    const message = err?.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  return app;
}

async function getApp(): Promise<express.Express> {
  if (!appPromise) {
    appPromise = createApp();
  }
  return appPromise;
}

export default async function handler(req: any, res: any) {
  const app = await getApp();
  return app(req, res);
}
