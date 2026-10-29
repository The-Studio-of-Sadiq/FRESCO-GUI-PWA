import { FRESCODeckConfig } from '../types/fresco';
import { generateFrescoDeck } from '../physics/frescoParser';
import { buildFortranRunResult, failedFortranRun, FortranRunResult, FRESCO_OUTPUT_FILES, projectileSpinOf } from './frescoResult';

// Browser-side runner for the official FRESCO Fortran compiled to WebAssembly
// (public/fresco, built by wasm/build.sh). Needs no server, so it works on static
// hosting and offline once the PWA has cached the assets.

const ENGINE = 'Fortran FRESCO (WebAssembly)' as const;
const RUN_TIMEOUT_MS = 180_000;

interface WorkerResponse {
  id: number;
  exitCode?: number | null;
  stdout: string;
  stderr: string;
  files?: Record<string, string>;
  error?: string;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (r: WorkerResponse) => void>();

function resetWorker(message: string) {
  worker?.terminate();
  worker = null;
  for (const [id, resolve] of pending) resolve({ id, stdout: '', stderr: '', error: message });
  pending.clear();
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./frescoWasm.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const resolve = pending.get(event.data.id);
      if (!resolve) return;
      pending.delete(event.data.id);
      resolve(event.data);
    };
    worker.onerror = (event) => resetWorker(event.message || 'FRESCO WebAssembly worker crashed');
  }
  return worker;
}

export async function runFrescoWasm(deck: string | FRESCODeckConfig): Promise<FortranRunResult> {
  const start = performance.now();
  const input = typeof deck === 'string' ? deck : generateFrescoDeck(deck);
  // FRESCO reads its input lines from stdin; make sure the last one is terminated.
  const stdin = input.endsWith('\n') ? input : `${input}\n`;

  const response = await new Promise<WorkerResponse>((resolve) => {
    const id = nextId++;
    const timer = setTimeout(() => resetWorker(`FRESCO did not finish within ${RUN_TIMEOUT_MS / 1000} s`), RUN_TIMEOUT_MS);
    pending.set(id, (r) => {
      clearTimeout(timer);
      resolve(r);
    });
    getWorker().postMessage({ id, input: stdin, outputFiles: FRESCO_OUTPUT_FILES });
  });

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
