// Runs public/fresco/sfresco.{js,wasm} in Node: SFRESCO chi-square search.
// Usage: node wasm/run-sfresco-node.mjs commands.min file... [--out stdout.txt]
//   commands.min  SFRESCO stdin (search file name, then commands such as min/migrad/end)
//   file...       files placed in the working directory (the search file, FRESCO deck, data)
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { default: createSfresco } = await import(pathToFileURL(path.join(root, 'public/fresco/sfresco.js')).href);

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outFile = outIdx >= 0 ? args.splice(outIdx, 2)[1] : null;
const [commandsFile, ...files] = args;
const stdin = fs.readFileSync(commandsFile, 'utf8');
const stdout = [];
const stderr = [];
let pos = 0;
const start = performance.now();

const module = await createSfresco({
  stdin: () => (pos < stdin.length ? stdin.charCodeAt(pos++) : null),
  print: (line) => stdout.push(line),
  printErr: (line) => stderr.push(line),
  preRun: [
    (m) => {
      for (const f of files) m.FS.writeFile('/' + path.basename(f), fs.readFileSync(f));
    },
  ],
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
if (outFile) fs.writeFileSync(outFile, stdout.join('\n') + '\n');
console.log(`exit=${exitCode} stdoutLines=${stdout.length} ms=${(performance.now() - start).toFixed(0)} files=${module.FS.readdir('/').filter((n) => !['.', '..', 'tmp', 'home', 'dev', 'proc'].includes(n)).join(',')}`);
if (stderr.length) console.log('STDERR:', stderr.slice(-10).join('\n'));
