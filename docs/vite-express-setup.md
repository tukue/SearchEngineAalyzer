# Vite + Express API setup for Web Audit Analyzer

This guide provides an end-to-end reference setup for a Web Audit Analyzer with a Vite frontend and an Express API backend. It includes a recommended folder layout, sample configuration files, example frontend code, and troubleshooting tips.

## Recommended project structure

```
my-audit-app/
├─ backend/
│  ├─ server.ts
│  └─ package.json
├─ frontend/
│  ├─ index.html
│  ├─ vite.config.ts
│  ├─ src/
│  │  ├─ App.tsx
│  │  └─ main.tsx
│  └─ package.json
├─ package.json
└─ README.md
```

## Vite config with dev proxy

`frontend/vite.config.ts`

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
```

## Express server (API + production static hosting)

`backend/server.ts`

```ts
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());

// Allow Vite dev server to call the API directly in development
if (process.env.NODE_ENV !== "production") {
  app.use(
    cors({
      origin: "http://localhost:5173",
      credentials: true,
    }),
  );
}

app.post("/api/audit", (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ message: "URL is required." });
  }

  // Dummy audit response (replace with real audit logic)
  return res.json({
    url,
    scores: {
      performance: 0.93,
      accessibility: 0.88,
      seo: 0.91,
      bestPractices: 0.9,
      securityHeaders: 0.85,
    },
    generatedAt: new Date().toISOString(),
  });
});

// Serve Vite build in production
if (process.env.NODE_ENV === "production") {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const clientDist = path.join(__dirname, "..", "frontend", "dist");

  app.use(express.static(clientDist));

  // SPA fallback
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
```

## Frontend example (React)

`frontend/src/App.tsx`

```tsx
import { useState } from "react";

type AuditResponse = {
  url: string;
  scores: {
    performance: number;
    accessibility: number;
    seo: number;
    bestPractices: number;
    securityHeaders: number;
  };
  generatedAt: string;
};

export default function App() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<AuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const message = await response.json();
        throw new Error(message?.message || "Audit failed");
      }

      const data = (await response.json()) as AuditResponse;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>Web Audit Analyzer</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="url">URL to audit</label>
        <input
          id="url"
          type="url"
          placeholder="https://example.com"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          required
          style={{ width: "100%", marginTop: 8, marginBottom: 12 }}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Running audit..." : "Run audit"}
        </button>
      </form>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {result && (
        <section style={{ marginTop: 24 }}>
          <h2>Results for {result.url}</h2>
          <ul>
            <li>Performance: {Math.round(result.scores.performance * 100)}</li>
            <li>Accessibility: {Math.round(result.scores.accessibility * 100)}</li>
            <li>SEO: {Math.round(result.scores.seo * 100)}</li>
            <li>Best Practices: {Math.round(result.scores.bestPractices * 100)}</li>
            <li>
              Security Headers: {Math.round(result.scores.securityHeaders * 100)}
            </li>
          </ul>
          <small>Generated at: {result.generatedAt}</small>
        </section>
      )}
    </main>
  );
}
```

## Example npm scripts

Root `package.json` (monorepo style):

```json
{
  "scripts": {
    "dev:client": "npm --prefix frontend run dev",
    "dev:server": "npm --prefix backend run dev",
    "dev": "concurrently -n client,server -c cyan,magenta \"npm run dev:client\" \"npm run dev:server\"",
    "build": "npm --prefix frontend run build",
    "start": "npm --prefix backend run start"
  }
}
```

Backend `package.json`:

```json
{
  "scripts": {
    "dev": "tsx watch server.ts",
    "start": "node server.js"
  }
}
```

Frontend `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

## Common issues and fixes

- **Proxy not working (404/500 in dev)**
  - Confirm Vite proxy is configured (`server.proxy["/api"]`).
  - Ensure the backend is running on the target port (e.g., `http://localhost:5000`).
  - Ensure API routes are under `/api`, not `/`.

- **CORS errors**
  - In dev, either use the Vite proxy (preferred) or enable CORS in Express.
  - If using cookies, enable `credentials: true` and send `credentials: "include"` in fetch.

- **Wrong static file paths in production**
  - Verify that Express `express.static()` points at the Vite build output (e.g., `frontend/dist`).
  - Ensure the build output directory matches `vite.config.ts` `build.outDir`.

- **API routes conflicting with frontend routes**
  - Put API routes under `/api/*`.
  - Add the SPA fallback (`app.get("*", ...)`) **after** API routes.

- **Requests hitting the wrong server in dev**
  - Use relative URLs on the frontend (`/api/audit`), not hardcoded `http://localhost:5000`.
  - Confirm the Vite dev server is the one you visit in the browser (`http://localhost:5173`).
