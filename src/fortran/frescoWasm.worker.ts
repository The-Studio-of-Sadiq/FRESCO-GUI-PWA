/// <reference lib="webworker" />
/// <reference types="vite/client" />
// Runs the official FRESCO / SFRESCO Fortran (compiled to WebAssembly by wasm/build.sh)
// off the main thread. Each run gets a fresh module instance so Fortran module
// state and the virtual file system start clean.

type Program = 'fresco' | 'sfresco';

interface RunRequest {
  id: number;
  program: Program;
  /** Standard input: the FRESCO deck, or SFRESCO's commands. */
  input: string;
  /** Files placed in the working directory before the run. */
  inputFiles?: Record<string, string>;
  outputFiles: string[];
}

const base = new URL(`${import.meta.env.BASE_URL}fresco/`, self.location.origin).href;
const EXPORT_NAMES: Record<Program, string> = { fresco: 'createFresco', sfresco: 'createSfresco' };

interface Assets {
  create: (opts: Record<string, unknown>) => Promise<any>;
  wasmBinary: ArrayBuffer;
}

const assets = new Map<Program, Promise<Assets>>();

// Fetch each module and its wasm once; later runs reuse them.
function loadAssets(program: Program): Promise<Assets> {
  let loading = assets.get(program);
  if (!loading) {
    loading = Promise.all([
      import(/* @vite-ignore */ `${base}${program}.js`),
      fetch(`${base}${program}.wasm`).then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${program}.wasm (${res.status})`);
        return res.arrayBuffer();
      }),
    ]).then(([mod, wasmBinary]) => ({ create: mod.default ?? mod[EXPORT_NAMES[program]], wasmBinary }));
    loading.catch(() => assets.delete(program));
    assets.set(program, loading);
  }
  return loading;
}

self.onmessage = async (event: MessageEvent<RunRequest>) => {
  const { id, program, input, inputFiles = {}, outputFiles } = event.data;
  const stdout: string[] = [];
  const stderr: string[] = [];
  let exitCode: number | null = 0;
  let module: any = null;
  try {
    const { create, wasmBinary } = await loadAssets(program);
    let pos = 0;
    module = await create({
      wasmBinary,
      locateFile: (name: string) => base + name,
      stdin: () => (pos < input.length ? input.charCodeAt(pos++) : null),
      print: (line: string) => stdout.push(line),
      printErr: (line: string) => stderr.push(line),
    });
    for (const [name, text] of Object.entries(inputFiles)) module.FS.writeFile(`/${name}`, text);

    try {
      exitCode = module.callMain([]);
    } catch (err: any) {
      if (err?.name === 'ExitStatus') {
        // Fortran STOP / error termination
        exitCode = err.status;
      } else {
        // A trap after FRESCO has written its results still leaves usable output
        exitCode = null;
        stderr.push(`WebAssembly runtime error: ${err?.message || String(err)}`);
      }
    }

    const files: Record<string, string> = {};
    for (const name of outputFiles) {
      try {
        files[name] = module.FS.readFile(`/${name}`, { encoding: 'utf8' });
      } catch {
        // not written by this run
      }
    }
    self.postMessage({ id, exitCode, stdout: stdout.join('\n'), stderr: stderr.join('\n'), files });
  } catch (err: any) {
    self.postMessage({ id, error: err?.message || String(err), stdout: stdout.join('\n'), stderr: stderr.join('\n') });
  }
};
