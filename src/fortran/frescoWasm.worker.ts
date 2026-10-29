/// <reference lib="webworker" />
/// <reference types="vite/client" />
// Runs the official FRESCO Fortran (compiled to WebAssembly by wasm/build.sh)
// off the main thread. Each run gets a fresh module instance so Fortran module
// state and the virtual file system start clean.

interface RunRequest {
  id: number;
  input: string;
  outputFiles: string[];
}

const base = new URL(`${import.meta.env.BASE_URL}fresco/`, self.location.origin).href;

interface Assets {
  createFresco: (opts: Record<string, unknown>) => Promise<any>;
  wasmBinary: ArrayBuffer;
}

let assets: Promise<Assets> | null = null;

// Fetch the module and wasm once; later runs reuse them.
function loadAssets(): Promise<Assets> {
  if (!assets) {
    assets = Promise.all([
      import(/* @vite-ignore */ `${base}fresco.js`),
      fetch(base + 'fresco.wasm').then((res) => {
        if (!res.ok) throw new Error(`Failed to load fresco.wasm (${res.status})`);
        return res.arrayBuffer();
      }),
    ]).then(([mod, wasmBinary]) => ({ createFresco: mod.default, wasmBinary }));
    assets.catch(() => (assets = null));
  }
  return assets;
}

self.onmessage = async (event: MessageEvent<RunRequest>) => {
  const { id, input, outputFiles } = event.data;
  const stdout: string[] = [];
  const stderr: string[] = [];
  let exitCode: number | null = 0;
  let module: any = null;
  try {
    const { createFresco, wasmBinary } = await loadAssets();
    let pos = 0;
    module = await createFresco({
      wasmBinary,
      locateFile: (name: string) => base + name,
      stdin: () => (pos < input.length ? input.charCodeAt(pos++) : null),
      print: (line: string) => stdout.push(line),
      printErr: (line: string) => stderr.push(line),
    });

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
