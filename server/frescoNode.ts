import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { FRESCODeckConfig } from '../src/types/fresco';
import { generateFrescoDeck } from '../src/physics/frescoParser';
import { potentialCurves } from '../src/physics/fort17';
import { buildFortranRunResult, FortranRunResult, FRESCO_OUTPUT_FILES, projectileSpinOf } from '../src/fortran/frescoResult';
import {
  DECK_FILE,
  FIT_COMMANDS,
  FitDataset,
  FitVariable,
  SEARCH_FILE,
  buildSearchFile,
  parseSfrescoOutput,
  parseSfrescoScan,
  scanCommands,
} from '../src/physics/sfresco';

// FRESCO and SFRESCO for server-side callers (MCP, REST) in Node: the same WebAssembly
// modules the browser runs (public/fresco, or dist/fresco in a build), so results do not
// depend on the host having gfortran.

type Program = 'fresco' | 'sfresco';

function assetDir(): string {
  const candidates = [path.join(process.cwd(), 'dist', 'fresco'), path.join(process.cwd(), 'public', 'fresco')];
  const found = candidates.find((dir) => fs.existsSync(path.join(dir, 'fresco.wasm')));
  if (!found) throw new Error('FRESCO WebAssembly files not found (expected public/fresco or dist/fresco)');
  return found;
}

const modules = new Map<Program, Promise<{ create: (opts: Record<string, unknown>) => Promise<any>; wasmBinary: Buffer }>>();

function loadModule(program: Program) {
  let loading = modules.get(program);
  if (!loading) {
    const dir = assetDir();
    loading = import(pathToFileURL(path.join(dir, `${program}.js`)).href).then((mod) => ({
      create: mod.default,
      wasmBinary: fs.readFileSync(path.join(dir, `${program}.wasm`)),
    }));
    loading.catch(() => modules.delete(program));
    modules.set(program, loading);
  }
  return loading;
}

async function runProgram(program: Program, stdin: string, inputFiles: Record<string, string>, outputFiles: string[]) {
  const { create, wasmBinary } = await loadModule(program);
  const stdout: string[] = [];
  const stderr: string[] = [];
  let pos = 0;
  const module = await create({
    wasmBinary,
    stdin: () => (pos < stdin.length ? stdin.charCodeAt(pos++) : null),
    print: (line: string) => stdout.push(line),
    printErr: (line: string) => stderr.push(line),
  });
  for (const [name, text] of Object.entries(inputFiles)) module.FS.writeFile(`/${name}`, text);
  let exitCode: number | null = 0;
  try {
    exitCode = module.callMain([]);
  } catch (err: any) {
    if (err?.name === 'ExitStatus') exitCode = err.status;
    else {
      exitCode = null;
      stderr.push(`WebAssembly runtime error: ${err?.message || err}`);
    }
  }
  const files: Record<string, string> = {};
  for (const name of outputFiles) {
    try {
      files[name] = module.FS.readFile(`/${name}`, { encoding: 'utf8' });
    } catch {
      // not written
    }
  }
  return { exitCode, stdout: stdout.join('\n'), stderr: stderr.join('\n'), files };
}

/** Runs a FRESCO deck (text) or setup; potentials are drawn from the setup's parameters. */
export async function runFrescoNode(deck: string | FRESCODeckConfig, config?: FRESCODeckConfig): Promise<FortranRunResult> {
  const start = performance.now();
  const text = typeof deck === 'string' ? deck : generateFrescoDeck(deck);
  const run = await runProgram('fresco', text.endsWith('\n') ? text : `${text}\n`, {}, FRESCO_OUTPUT_FILES);
  const result = buildFortranRunResult({
    engine: 'Fortran FRESCO (WebAssembly)',
    executable: 'fresco.wasm',
    exitCode: run.exitCode,
    stdout: run.stdout,
    stderr: run.stderr,
    files: run.files,
    executionTimeMs: performance.now() - start,
    projectileSpin: projectileSpinOf(deck),
  });
  const setup = config ?? (typeof deck === 'string' ? undefined : deck);
  if (setup && result.output.potentials.length === 0) result.output.potentials = potentialCurves(setup);
  return result;
}

export async function runSfrescoNode(config: FRESCODeckConfig, deckText: string, variables: FitVariable[], datasets: FitDataset[]) {
  const searchFile = buildSearchFile(config, deckText, variables, datasets);
  const run = await runProgram('sfresco', FIT_COMMANDS, { [SEARCH_FILE]: searchFile, [DECK_FILE]: deckText }, []);
  const result = parseSfrescoOutput(run.stdout, variables.length);
  if (result.values.length !== variables.length) {
    throw new Error(`SFRESCO did not report fitted values: ${`${run.stdout}\n${run.stderr}`.trim().split('\n').slice(-4).join(' ')}`);
  }
  return { ...result, searchFile, stdout: run.stdout };
}

export async function runSfrescoScanNode(
  config: FRESCODeckConfig,
  deckText: string,
  variables: FitVariable[],
  datasets: FitDataset[],
  scan: { index: number; from: number; to: number; step: number },
) {
  const searchFile = buildSearchFile(config, deckText, variables, datasets);
  const run = await runProgram('sfresco', scanCommands(scan.index, scan.from, scan.to, scan.step), { [SEARCH_FILE]: searchFile, [DECK_FILE]: deckText }, []);
  return { points: parseSfrescoScan(run.stdout), searchFile };
}
