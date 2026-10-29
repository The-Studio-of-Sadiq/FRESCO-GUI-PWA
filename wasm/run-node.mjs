// Runs public/fresco/fresco.{js,wasm} in Node, like the browser worker does.
// Usage: node wasm/run-node.mjs deck.in [stdout-file]
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { default: createFresco } = await import(pathToFileURL(path.join(root, 'public/fresco/fresco.js')).href);

const input = fs.readFileSync(process.argv[2], 'utf8');
const stdin = input.endsWith('\n') ? input : `${input}\n`;
const stdout = [];
const stderr = [];
let pos = 0;
const start = performance.now();

const module = await createFresco({
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

const out = process.argv[3];
if (out) fs.writeFileSync(out, stdout.join('\n') + '\n');
let fort16 = '';
try {
  fort16 = module.FS.readFile('/fort.16', { encoding: 'utf8' });
} catch {}
console.log(`exit=${exitCode} stdoutLines=${stdout.length} fort16Bytes=${fort16.length} ms=${(performance.now() - start).toFixed(0)}`);
if (stderr.length) console.log('STDERR:', stderr.slice(0, 10).join('\n'));
