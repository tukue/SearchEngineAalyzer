import { build } from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

await build({
  entryPoints: [path.resolve(rootDir, "server", "index.ts")],
  outdir: path.resolve(rootDir, "dist"),
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: true,
  bundle: true,
  packages: "external",
});
