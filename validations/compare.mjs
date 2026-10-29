// Parity check: runs every deck in validations/decks through the WebAssembly
// FRESCO (public/fresco, the engine the browser uses), saves its outputs in
// validations/wasm, and compares every printed result with the native gfortran
// reference in validations/native (see fetch-native.mjs).
//
// Compared quantities, per deck:
//   X-S      differential cross sections (mb/sr), every outgoing channel
//   /R       ratios to Rutherford
//   pols     analysing powers (T10, iT11)
//   CUMUL    CUMULATIVE REACTION / ELASTIC / OUTGOING / ABSORBTION cross sections
//   fort.16  every number in the XMGrace cross-section tables
// Two values agree when they differ by at most twice the last printed digit of
// either (output is rounded to that precision) plus 1e-6 relative.
//
// Usage: node validations/compare.mjs     (exit code 1 if any value disagrees)
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const { default: createFresco } = await import(pathToFileURL(path.join(root, 'public/fresco/fresco.js')).href);
const wasmBinary = fs.readFileSync(path.join(root, 'public/fresco/fresco.wasm'));

async function runWasm(deckText) {
  const stdin = deckText.endsWith('\n') ? deckText : `${deckText}\n`;
  const stdout = [];
  const stderr = [];
  let pos = 0;
  const start = performance.now();
  const module = await createFresco({
    wasmBinary,
    stdin: () => (pos < stdin.length ? stdin.charCodeAt(pos++) : null),
    print: (line) => stdout.push(line),
    printErr: (line) => stderr.push(line),
  });
  let exitCode = 0;
  try {
    exitCode = module.callMain([]);
  } catch (err) {
    if (err?.name === 'ExitStatus') exitCode = err.status;
    else {
      exitCode = null;
      stderr.push(`WebAssembly runtime error: ${err?.message || err}`);
    }
  }
  let fort16 = '';
  try {
    fort16 = module.FS.readFile('/fort.16', { encoding: 'utf8' });
  } catch {}
  return { exitCode, stdout: stdout.join('\n') + '\n', stderr: stderr.join('\n'), fort16, ms: performance.now() - start };
}

const NUM = String.raw`[-+]?(?:\d+\.?\d*|\.\d+)(?:[EeDd][-+]?\d+)?`;

/** Half-unit of the last printed digit, e.g. "1.0503E+00" -> 1e-4, "8044.145719" -> 1e-6. */
function lastDigit(text) {
  const m = /^[-+]?(\d*)(?:\.(\d*))?(?:[EeDd]([-+]?\d+))?$/.exec(text);
  if (!m) return 0;
  return Math.pow(10, -(m[2] || '').length + (m[3] ? parseInt(m[3], 10) : 0));
}

const extractors = {
  'X-S': (t) => [...t.matchAll(new RegExp(String.raw`X-S =\s*(${NUM})`, 'g'))].map((m) => m[1]),
  '/R': (t) => [...t.matchAll(new RegExp(String.raw`/R =\s*(${NUM})`, 'g'))].map((m) => m[1]),
  pols: (t) => [...t.matchAll(/pols =\s*([^\n]*)/g)].flatMap((m) => m[1].trim().split(/\s+/)),
  CUMUL: (t) => [...t.matchAll(new RegExp(String.raw`CUMULATIVE\s+[A-Z ]+?(?:cross section|by Imaginary Potentials)\s*=\s*(${NUM})`, 'g'))].map((m) => m[1]),
};

function fort16Numbers(t) {
  return t
    .split('\n')
    .filter((l) => l.trim() && !/^\s*[@#&]/.test(l))
    .flatMap((l) => l.trim().split(/\s+/))
    .filter((x) => new RegExp(`^${NUM}$`).test(x));
}

function compareLists(a, b) {
  const result = { count: a.length, countB: b.length, worstRel: 0, failures: [] };
  a.forEach((sa, i) => {
    const sb = b[i];
    if (sb === undefined) return;
    const va = parseFloat(sa.replace(/[dD]/, 'e'));
    const vb = parseFloat(sb.replace(/[dD]/, 'e'));
    const diff = Math.abs(va - vb);
    const tol = 2 * Math.max(lastDigit(sa), lastDigit(sb)) + 1e-6 * Math.abs(va);
    if (Math.abs(va) > 1e-12) result.worstRel = Math.max(result.worstRel, diff / Math.abs(va));
    if (!(diff <= tol)) result.failures.push(`#${i}: native ${sa} vs wasm ${sb}`);
  });
  if (a.length !== b.length) result.failures.push(`count: native ${a.length} vs wasm ${b.length}`);
  return result;
}

fs.mkdirSync(path.join(here, 'wasm'), { recursive: true });
const nativeRuns = JSON.parse(fs.readFileSync(path.join(here, 'native', 'runs.json'), 'utf8')).runs;
const wasmRuns = {};
let failed = false;

for (const deck of fs.readdirSync(path.join(here, 'decks')).sort()) {
  const name = deck.replace(/\.(in|nin)$/, '');
  const run = await runWasm(fs.readFileSync(path.join(here, 'decks', deck), 'utf8'));
  fs.writeFileSync(path.join(here, 'wasm', `${name}.out`), run.stdout);
  fs.writeFileSync(path.join(here, 'wasm', `${name}.fort16`), run.fort16);
  wasmRuns[deck] = { exitCode: run.exitCode, stderr: run.stderr.trim().split('\n')[0] || '' };

  const native = fs.readFileSync(path.join(here, 'native', `${name}.out`), 'utf8');
  const nativeF16 = fs.readFileSync(path.join(here, 'native', `${name}.fort16`), 'utf8');
  const checks = Object.entries(extractors).map(([key, extract]) => [key, compareLists(extract(native), extract(run.stdout))]);
  checks.push(['fort.16', compareLists(fort16Numbers(nativeF16), fort16Numbers(run.fort16))]);

  const ok = checks.every(([, c]) => c.failures.length === 0);
  failed ||= !ok;
  console.log(`\n${ok ? 'PASS' : 'FAIL'} ${deck}  (wasm exit ${run.exitCode}, native exit ${nativeRuns[deck]?.exitCode}, ${run.ms.toFixed(0)} ms)`);
  for (const [key, c] of checks) {
    if (c.count === 0 && c.countB === 0) continue;
    console.log(`  ${key.padEnd(8)} ${String(c.count).padStart(4)} values  worst rel diff ${c.worstRel.toExponential(2)}${c.failures.length ? `  ${c.failures.length} mismatches` : ''}`);
    c.failures.slice(0, 5).forEach((f) => console.log(`           ${f}`));
  }
}

fs.writeFileSync(
  path.join(here, 'wasm', 'runs.json'),
  JSON.stringify({ engine: 'public/fresco/fresco.wasm (flang 23.1.4 + Emscripten)', runs: wasmRuns }, null, 2) + '\n',
);
console.log(failed ? '\nSome results differ from native FRESCO.' : '\nAll results match native FRESCO.');
process.exit(failed ? 1 : 0);
