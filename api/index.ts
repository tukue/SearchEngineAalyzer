import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createBaseApp } from "../server/appBase";
import { createApiRouter } from "../server/routes";
import { registerDeploymentHomepage } from "../server/homepage";

const app = createBaseApp();

if (app.get("env") !== "development") {
  registerDeploymentHomepage(app);
}

app.use("/api", createApiRouter());

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req, res);
}
