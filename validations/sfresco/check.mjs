// SFRESCO check: runs FRESCO's own SFRESCO test (ss.search: p + 112Cd elastic at
// 27.9 MeV, 4 optical-potential parameters fitted to 28 ratio-to-Rutherford points)
// through the WebAssembly sfresco the browser uses, then recomputes chi^2 for the
// starting and fitted parameters with the native gfortran FRESCO on a deployed server.
//
// Usage: node validations/sfresco/check.mjs [server-url]
//        (default https://fresco-gui-pwa.onrender.com; the native step is skipped if unreachable)
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const server = (process.argv[2] || 'https://fresco-gui-pwa.onrender.com').replace(/\/$/, '');
const read = (f) => fs.readFileSync(path.join(here, f), 'utf8');

// 1. SFRESCO in WebAssembly
const { default: createSfresco } = await import(pathToFileURL(path.join(root, 'public/fresco/sfresco.js')).href);
const stdin = read('ss.cmd');
const stdout = [];
let pos = 0;
const module = await createSfresco({
  stdin: () => (pos < stdin.length ? stdin.charCodeAt(pos++) : null),
  print: (l) => stdout.push(l),
  printErr: () => {},
});
module.FS.writeFile('/ss.search', read('ss.search'));
module.FS.writeFile('/p-cd.nin', read('p-cd.nin'));
try {
  module.callMain([]);
} catch (err) {
  if (err?.name !== 'ExitStatus') throw err;
}
const out = stdout.join('\n') + '\n';
fs.writeFileSync(path.join(here, 'wasm.out'), out);

const chi2 = [...out.matchAll(/Total ChiSq\/N\s*=\s*([-\d.Ee+]+)/g)].map((m) => parseFloat(m[1]));
const values = {};
for (const m of out.matchAll(/Var\s+\d+=(\S+)\s+value\s+([-\d.Ee+]+)/g)) values[m[1]] = parseFloat(m[2]);
console.log(`WebAssembly SFRESCO: chi2/N ${chi2[0]} -> ${chi2[chi2.length - 1]}`);
console.log(`  fitted ${Object.entries(values).map(([k, v]) => `${k}=${v}`).join(' ')}`);

// 2. chi^2 of the same parameters from native FRESCO
const data = read('ss.search')
  .split('\n')
  .map((l) => l.trim().split(/\s+/).map(Number))
  .filter((a) => a.length === 3 && a.every((x) => !isNaN(x)));

async function nativeChi2({ V, r0, W, WD }) {
  const deck = read('p-cd.nin')
    .replace(/&pot kp= 1 type= 1 p\(1:7\)=.*\//, `&pot kp= 1 type= 1 p(1:7)= ${V} ${r0} 0.7500 ${W} 1.3200 0.6100 0.0000 /`)
    .replace(/&pot kp= 1 type= 2 p\(1:7\)=.*\//, `&pot kp= 1 type= 2 p(1:7)= 0.000 0.0000 0.0000 ${WD} 1.3200 0.6100 0.0000 /`);
  const res = await fetch(`${server}/api/fortran/run-fresco`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deckText: deck }),
  }).then((r) => r.json());
  if (!res.engineUsed?.includes('gfortran')) throw new Error(`server answered with ${res.engineUsed}`);
  const ratio = new Map();
  let angle = null;
  let block = 0;
  for (const line of res.stdout.split('\n')) {
    if (/CROSS SECTIONS FOR OUTGOING/.test(line)) block++;
    if (block !== 1) continue;
    const a = line.match(/^\s*([\d.]+) deg\.: X-S/);
    if (a) angle = parseFloat(a[1]);
    const r = line.match(/\/R =\s*(\S+)/);
    if (r && angle !== null) ratio.set(angle, parseFloat(r[1]));
  }
  return data.reduce((s, [a, v, e]) => s + ((ratio.get(a) - v) / e) ** 2, 0) / data.length;
}

try {
  // starting values set by `potential=` in ss.search
  const start = await nativeChi2({ V: 52.5, r0: 1.171, W: 3.5, WD: 8.5 });
  const fitted = await nativeChi2({ V: values.V, r0: values.r0, W: values.W, WD: values.WD });
  console.log(`Native gfortran FRESCO: chi2/N ${start.toFixed(4)} (start) -> ${fitted.toFixed(4)} (fitted values)`);
  const ok = Math.abs(start - chi2[0]) / chi2[0] < 1e-3 && Math.abs(fitted - chi2[chi2.length - 1]) / chi2[chi2.length - 1] < 1e-3;
  console.log(ok ? 'SFRESCO chi^2 matches native FRESCO.' : 'SFRESCO chi^2 differs from native FRESCO.');
  process.exit(ok ? 0 : 1);
} catch (err) {
  console.log(`Native check skipped: ${err.message}`);
}
