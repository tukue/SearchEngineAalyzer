import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { type Express } from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function registerDeploymentHomepage(app: Express) {
  const rootDir = path.resolve(__dirname, "..");
  const candidates = [
    // Development (served from repo root)
    path.resolve(rootDir, "public", "deploy-home.html"),
    path.resolve(rootDir, "server", "public", "deploy-home.html"),
    // Production (bundled server lives in dist/server, client assets in dist/client)
    path.resolve(rootDir, "client", "deploy-home.html"),
  ];

  const homepagePath = candidates.find((candidate) => fs.existsSync(candidate));

  if (!homepagePath) {
    return;
  }

  const serveDeployHome = (_req: any, res: any) => {
    res.sendFile(homepagePath);
  };

  // Keep the deployment-only homepage reachable without blocking the main SPA.
  // By default, expose it under /deploy-home. It can optionally be served at
  // the root path when explicitly requested (SERVE_DEPLOY_HOME_ROOT=true).
  app.get("/deploy-home", serveDeployHome);

  if (process.env.SERVE_DEPLOY_HOME_ROOT === "true") {
    app.get("/", serveDeployHome);
  }
}
