# Continuation Notes

## Current status
- `npm run build` fails because `vite` is not installed in the environment.
- `npm run dev` fails because `tsx` is not installed in the environment.
- `npm install` previously failed with a 403 from the npm registry; registry access needs to be fixed before dependencies can be installed.

## Suggested next steps
1. Ensure npm can reach an allowed registry:
   - `npm config set registry https://registry.npmjs.org/` (or your internal mirror)
   - `npm config delete http-proxy`
2. Install dependencies:
   - `npm install`
3. Re-run:
   - `npm run build`
   - `npm run dev`

## Notes
- Once dependencies are installed, `vite` and `tsx` should resolve from `node_modules/.bin`.
