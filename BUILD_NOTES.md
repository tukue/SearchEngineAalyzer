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

## Fixing npm registry 403 responses
If you encounter HTTP 403 errors while installing packages, try the following remediation steps (from least to most involved):

1) **Remove unintended registry overrides**
- Check whether an `.npmrc` file (global `~/.npmrc` or project-level) is forcing a private registry that blocks anonymous access.
- Reset to the public registry and retry:
  ```
  npm config delete registry
  npm config set registry https://registry.npmjs.org
  npm cache clean --force
  npm install --no-progress
  ```

2) **Authenticate to the registry**
- Some organizations require an auth token even for read-only access.
- Add a token to `.npmrc` (avoid committing secrets):
  ```
  //registry.npmjs.org/:_authToken=<YOUR_TOKEN>
  ```
- If using GitHub Packages or another scoped registry, configure the appropriate `//registry.url/:_authToken` entry and ensure the scope (`@your-scope`) is mapped to that registry.

3) **Use a corporate proxy or allowlist**
- When behind a proxy or firewall, ensure `https://registry.npmjs.org` (and any scoped registries) are allowlisted.
- Configure proxy settings if required:
  ```
  npm config set proxy http://<proxy-host>:<proxy-port>
  npm config set https-proxy http://<proxy-host>:<proxy-port>
  ```

4) **Use an internal mirror/caching proxy**
- If direct internet access is blocked, point npm to an approved mirror such as Verdaccio, Artifactory, or Nexus.
- Example for Verdaccio running at `https://npm.example.com`:
  ```
  npm config set registry https://npm.example.com
  npm cache clean --force
  npm install --no-progress
  ```

5) **Leverage an offline cache or prebuilt `node_modules`**
- If an allowed environment is available, prefetch dependencies with `npm ci --ignore-scripts` and package the resulting `node_modules` or npm cache artifact for reuse in the restricted environment.
- Ensure `package-lock.json` remains unchanged so `npm ci` can reproduce the same dependency tree.
