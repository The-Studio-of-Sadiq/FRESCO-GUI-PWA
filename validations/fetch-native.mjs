// Runs every deck in validations/decks through the native gfortran FRESCO on a
// deployed server (POST /api/fortran/run-fresco) and saves its stdout and fort.16
// in validations/native. These are the reference results for compare.mjs.
//
// Usage: node validations/fetch-native.mjs [server-url]
//        (default https://fresco-gui-pwa.onrender.com, the Render/Docker deployment)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const server = (process.argv[2] || 'https://fresco-gui-pwa.onrender.com').replace(/\/$/, '');
const decks = fs.readdirSync(path.join(here, 'decks')).sort();
fs.mkdirSync(path.join(here, 'native'), { recursive: true });

const status = await fetch(`${server}/api/fortran/status`).then((r) => r.json());
if (!status.hasFrescoBinary) throw new Error(`${server} has no native FRESCO binary`);

const summary = { server, compiler: 'gfortran (Docker image, Alpine)', fetched: new Date().toISOString(), runs: {} };
for (const deck of decks) {
  const name = deck.replace(/\.(in|nin)$/, '');
  const deckText = fs.readFileSync(path.join(here, 'decks', deck), 'utf8');
  const res = await fetch(`${server}/api/fortran/run-fresco`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deckText }),
  });
  const data = await res.json();
  if (!data.engineUsed?.includes('gfortran')) throw new Error(`${deck}: server answered with ${data.engineUsed}`);
  fs.writeFileSync(path.join(here, 'native', `${name}.out`), data.stdout || '');
  fs.writeFileSync(path.join(here, 'native', `${name}.fort16`), data.fort16Raw || '');
  summary.runs[deck] = { exitCode: data.exitCode, stderr: (data.stderr || '').trim().split('\n')[0] || '' };
  console.log(`${deck}: exit ${data.exitCode}, ${(data.stdout || '').split('\n').length} stdout lines${data.stderr ? `, stderr: ${data.stderr.trim().split('\n')[0]}` : ''}`);
}
fs.writeFileSync(path.join(here, 'native', 'runs.json'), JSON.stringify(summary, null, 2) + '\n');
