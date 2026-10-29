import { runFrescoWasm } from '../fortran/frescoWasm';
import { generateFrescoDeck } from '../physics/frescoParser';

// When the app is served as a static site (e.g. Vercel) or the device is offline,
// there is no Express backend: /api/* requests fail, 404, or return the SPA's HTML.
// This shim detects that and answers those requests in the browser. Simulations run
// the official FRESCO Fortran compiled to WebAssembly (public/fresco, built by
// wasm/build.sh).
//
// The WebAssembly engine is also used when a backend exists but has no compiled
// FRESCO binary, since that backend would otherwise answer with the approximate
// TypeScript engine.

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const serverOnly = (feature: string) =>
  jsonResponse({ error: `${feature} needs the Node server (npm run dev or the Docker image); it is not available in the browser-only build.` }, 503);

function isBackendResponse(res: Response): boolean {
  return res.status !== 404 && (res.headers.get('content-type') || '').includes('application/json');
}

async function readJsonBody(init?: RequestInit): Promise<any> {
  if (typeof init?.body !== 'string') return {};
  return JSON.parse(init.body);
}

async function runLocally(init?: RequestInit): Promise<Response> {
  const { deckText, config } = await readJsonBody(init);
  const deck = deckText || (config ? generateFrescoDeck(config) : '');
  if (!deck) return jsonResponse({ error: 'No valid FRESCO configuration or deck text provided.' }, 400);
  return jsonResponse(await runFrescoWasm(deck));
}

async function handleLocally(pathname: string, method: string, init?: RequestInit): Promise<Response> {
  try {
    if (method === 'GET' && pathname === '/api/health') {
      return jsonResponse({ status: 'ok', app: 'FRESCO Nuclear Physics Simulator Engine (browser)' });
    }
    if (method === 'GET' && pathname === '/api/fortran/status') {
      return jsonResponse({
        hasGfortran: false,
        hasSources: true,
        hasFrescoBinary: true,
        hasSfrescoBinary: false,
        sourceFilesCount: 0,
        binaryPath: 'fresco.wasm',
        compilerInfo: 'Official FRESCO Fortran compiled to WebAssembly (LLVM flang + Emscripten), running in this browser',
      });
    }
    if (method === 'POST' && pathname === '/api/fortran/run-fresco') return await runLocally(init);
    if (pathname === '/api/fortran/compile') return serverOnly('Compiling Fortran');
    if (pathname === '/api/gemini') return serverOnly('The Gemini AI assistant');
    return jsonResponse({ error: `Unknown API route ${pathname}` }, 404);
  } catch (err: any) {
    return jsonResponse({ error: err?.message || String(err) }, 500);
  }
}

export function installLocalApiFallback() {
  if (typeof window === 'undefined' || (window as any).__frescoApiFallback) return;
  (window as any).__frescoApiFallback = true;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) {
      return nativeFetch(input, init);
    }
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

    if (!navigator.onLine) return handleLocally(url.pathname, method, init);

    let res: Response;
    try {
      res = await nativeFetch(input, init);
    } catch {
      return handleLocally(url.pathname, method, init);
    }
    if (!isBackendResponse(res)) return handleLocally(url.pathname, method, init);

    // A backend without a FRESCO binary answers with the TypeScript approximation: run the real Fortran here instead.
    if (method === 'POST' && url.pathname === '/api/fortran/run-fresco') {
      const data = await res.clone().json().catch(() => null);
      if (data?.engineUsed === 'TypeScript High-Speed Physics Engine') return handleLocally(url.pathname, method, init);
    }
    return res;
  };
}
