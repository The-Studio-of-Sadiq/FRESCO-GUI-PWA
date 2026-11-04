// Bundles server/apiEntry.ts (MCP + JSON API) into api/_lib/fresco-api.js for the Vercel
// functions in /api. Run after changing server/ or src/physics: npm run build:api
import { build } from 'esbuild';

await build({
  entryPoints: ['server/apiEntry.ts'],
  outfile: 'api/_lib/fresco-api.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  // CommonJS dependencies inside an ESM bundle need require()
  banner: { js: "import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);" },
  legalComments: 'none',
  logLevel: 'info',
});
