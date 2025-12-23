import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Express } from "express";
import { bootstrapApp } from "../server/app";

let cachedApp: Express | undefined;

async function getApp() {
  if (!cachedApp) {
    const { app } = await bootstrapApp({ enableDevServer: false, enableStatic: false, createServer: false });
    cachedApp = app;
  }
  return cachedApp;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await getApp();
  return app(req as any, res as any);
}
