# Web Analyzer App

This repository contains the Web Analyzer app, with an Express API and a Vite SPA for the primary audit UI. A Next.js app also lives in the repo for marketing/SSR content.

## Quick start
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the API + Vite UI:
   ```bash
   npm run dev
   ```
3. Open the app:
   - http://localhost:5000

## Optional
- Run the Next.js app:
  ```bash
  npm run dev:next
  ```

## Core flow
1. Enter a website URL.
2. Submit to trigger the audit.
3. Review the results in the UI.
