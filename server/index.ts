import { type Request, Response, NextFunction } from "express";
import { createBaseApp } from "./appBase";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { registerDeploymentHomepage } from "./homepage";

const app = createBaseApp();

(async () => {
  if (app.get("env") !== "development") {
    registerDeploymentHomepage(app);
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen(port, () => {
    log(`serving on port ${port}`);
  });
})();
