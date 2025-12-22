import { bootstrapApp } from "./app";
import { log } from "./vite";

(async () => {
  const { server } = await bootstrapApp({ enableDevServer: true });

  const port = process.env.PORT || 5000;
  server?.listen(port, () => {
    log(`Server running on port ${port}`);
  });
})();
