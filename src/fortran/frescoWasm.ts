import { FRESCODeckConfig } from '../types/fresco';
import { generateFrescoDeck } from '../physics/frescoParser';
import {
  DECK_FILE,
  FIT_COMMANDS,
  FitDataset,
  FitResult,
  FitVariable,
  SEARCH_FILE,
  buildSearchFile,
  parseSfrescoOutput,
  parseSfrescoScan,
  scanCommands,
} from '../physics/sfresco';
import { buildFortranRunResult, failedFortranRun, FortranRunResult, FRESCO_OUTPUT_FILES, projectileSpinOf } from './frescoResult';

// Browser-side runner for the official FRESCO and SFRESCO Fortran compiled to
// WebAssembly (public/fresco, built by wasm/build.sh). Needs no server, so it works on
// static hosting and offline once the PWA has cached the assets.

const ENGINE = 'Fortran FRESCO (WebAssembly)' as const;
const RUN_TIMEOUT_MS = 180_000;
const FIT_TIMEOUT_MS = 30 * 60_000;

interface WorkerResponse {
  id: number;
  exitCode?: number | null;
  stdout: string;
  stderr: string;
  files?: Record<string, string>;
  error?: string;
}

interface WorkerJob {
  program: 'fresco' | 'sfresco';
  input: string;
  inputFiles?: Record<string, string>;
  outputFiles: string[];
  timeoutMs: number;
}

// One worker per program, so a long fit does not block quick FRESCO runs.
const workers = new Map<string, Worker>();
let nextId = 1;
const pending = new Map<number, { worker: string; resolve: (r: WorkerResponse) => void }>();

function resetWorker(key: string, message: string) {
  workers.get(key)?.terminate();
  workers.delete(key);
  for (const [id, job] of pending) {
    if (job.worker !== key) continue;
    pending.delete(id);
    job.resolve({ id, stdout: '', stderr: '', error: message });
  }
}

function getWorker(key: string): Worker {
  let worker = workers.get(key);
  if (!worker) {
    worker = new Worker(new URL('./frescoWasm.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const job = pending.get(event.data.id);
      if (!job) return;
      pending.delete(event.data.id);
      job.resolve(event.data);
    };
    worker.onerror = (event) => resetWorker(key, event.message || 'FRESCO WebAssembly worker crashed');
    workers.set(key, worker);
  }
  return worker;
}

function runJob(job: WorkerJob): Promise<WorkerResponse> {
  return new Promise((resolve) => {
    const id = nextId++;
    const timer = setTimeout(() => resetWorker(job.program, `${job.program.toUpperCase()} did not finish within ${job.timeoutMs / 60000} min`), job.timeoutMs);
    pending.set(id, {
      worker: job.program,
      resolve: (r) => {
        clearTimeout(timer);
        resolve(r);
      },
    });
    const { timeoutMs: _, ...message } = job;
    getWorker(job.program).postMessage({ id, ...message });
  });
}

/** Stops a running SFRESCO search. */
export function cancelSfresco() {
  resetWorker('sfresco', 'Fit cancelled');
}

export async function runFrescoWasm(deck: string | FRESCODeckConfig): Promise<FortranRunResult> {
  const start = performance.now();
  const input = typeof deck === 'string' ? deck : generateFrescoDeck(deck);
  // FRESCO reads its input lines from stdin; make sure the last one is terminated.
  const stdin = input.endsWith('\n') ? input : `${input}\n`;
  const response = await runJob({ program: 'fresco', input: stdin, outputFiles: FRESCO_OUTPUT_FILES, timeoutMs: RUN_TIMEOUT_MS });

  const executionTimeMs = performance.now() - start;
  if (response.error) return failedFortranRun(ENGINE, response.error, executionTimeMs, response.stdout);

  return buildFortranRunResult({
    engine: ENGINE,
    executable: 'fresco.wasm',
    exitCode: response.exitCode ?? null,
    stdout: response.stdout,
    stderr: response.stderr,
    files: response.files || {},
    executionTimeMs,
    projectileSpin: projectileSpinOf(deck),
  });
}

export interface SfrescoRun extends FitResult {
  stdout: string;
  searchFile: string;
  elapsedMs: number;
}

async function runSfresco(config: FRESCODeckConfig, deckText: string, variables: FitVariable[], datasets: FitDataset[], commands: string) {
  const searchFile = buildSearchFile(config, deckText, variables, datasets);
  const response = await runJob({
    program: 'sfresco',
    input: commands,
    inputFiles: { [SEARCH_FILE]: searchFile, [DECK_FILE]: deckText },
    outputFiles: [],
    timeoutMs: FIT_TIMEOUT_MS,
  });
  if (response.error) throw new Error(response.error);
  return { searchFile, stdout: response.stdout, stderr: response.stderr };
}

const tail = (stdout: string, stderr: string) => `${stdout}\n${stderr}`.trim().split('\n').slice(-4).join(' ').trim();

/** Runs an SFRESCO chi-square search (MINUIT MIGRAD) of the variables against the datasets. */
export async function runSfrescoWasm(config: FRESCODeckConfig, deckText: string, variables: FitVariable[], datasets: FitDataset[]): Promise<SfrescoRun> {
  const start = performance.now();
  const { searchFile, stdout, stderr } = await runSfresco(config, deckText, variables, datasets, FIT_COMMANDS);
  const result = parseSfrescoOutput(stdout, variables.length);
  if (result.values.length !== variables.length) throw new Error(`SFRESCO did not report fitted values: ${tail(stdout, stderr)}`);
  return { ...result, stdout, searchFile, elapsedMs: performance.now() - start };
}

/** χ²/N as one variable (1-based index) is stepped through a range, the others fixed (SFRESCO `scan`). */
export async function runSfrescoScan(
  config: FRESCODeckConfig,
  deckText: string,
  variables: FitVariable[],
  datasets: FitDataset[],
  scan: { index: number; from: number; to: number; step: number },
) {
  const { stdout, stderr } = await runSfresco(config, deckText, variables, datasets, scanCommands(scan.index, scan.from, scan.to, scan.step));
  const points = parseSfrescoScan(stdout);
  if (points.length === 0) throw new Error(`SFRESCO did not report a scan: ${tail(stdout, stderr)}`);
  return { points, stdout };
}
