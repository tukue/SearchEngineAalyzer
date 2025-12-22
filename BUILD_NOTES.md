# Build Notes

## Current status
- Local branch `work` has no upstream configured; no rebase actions were necessary.
- Dependency installation and build currently fail because external npm registries are blocked in the execution environment. Requests to `https://registry.npmjs.org/vite` return HTTP 403, preventing `npm install` and `npm run build` from completing.

## Reproduction
```
# Clean install and build
rm -rf node_modules
npm install --registry=https://registry.npmjs.org --no-progress
npm run build
```

Both the install and build steps stop when npm cannot fetch packages from the registry due to the 403 response.

## Next steps
- Run the same installation and build steps in an environment with access to npm (or via an allowed mirror/proxy).
- Once dependencies are installed, rerun `npm run build` to verify the bundle and server output.
```
npm run build
```
