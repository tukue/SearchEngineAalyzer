import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { type Express } from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function registerDeploymentHomepage(app: Express) {
  const rootDir = path.resolve(__dirname, "..");
  const candidates = [
    path.resolve(rootDir, "public", "deploy-home.html"),
    path.resolve(rootDir, "server", "public", "deploy-home.html"),
  ];

  const homepagePath = candidates.find((candidate) => fs.existsSync(candidate));

  if (!homepagePath) {
    return;
  }

  app.get("/", (_req, res) => {
    res.sendFile(homepagePath);
  });
}
