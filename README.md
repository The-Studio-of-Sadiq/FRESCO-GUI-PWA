# FRESCO Nuclear Physics Simulator

A web GUI, input generator, coupled-channels engine simulator, and interactive plotter for **FRESCO** nuclear reaction calculations.

This platform bridges classical Fortran computational physics with modern web visualization—allowing nuclear physicists, researchers, and students to configure reaction decks, execute native compiled FRESCO binaries server-side, and analyze multi-channel angular cross-section distributions with interactive plots.

---

## Key Features

- **Reaction setup**: Form for projectile, target, energy, angles and optical potentials (with global models), plus partitions, excited states, bound states and inelastic/transfer couplings, drawn as a level scheme. Generates the FRESCO namelist input (`fresco.in`).
- **Input deck**: Edit or upload any FRESCO namelist deck; it runs exactly as written, including options the form has no field for.
- **FRESCO in the browser (WebAssembly)**: The official FRESCO Fortran is compiled to WebAssembly (`public/fresco/`), so the app runs real FRESCO calculations with no server: on static hosting such as Vercel, and offline once the PWA is installed. A Node server with gfortran can run the native `fresco` executable instead; both give the same results (`validations/`).
- **Results**: Angular distributions of every outgoing channel (elastic, inelastic, transfer), σ/σ_Ruth, analysing power, the elastic S-matrix and radial wavefunctions read from FRESCO's `fort.17`, potential curves, FRESCO's output listing, overlay of measured data, CSV export.
- **χ² fitting with SFRESCO**: The Fit tab runs SFRESCO (FRESCO + MINUIT) in WebAssembly. It fits optical-potential parameters, spectroscopic factors, dataset normalisations and R-matrix poles, with optional bounds. Data can be angular distributions at any energy, excitation functions, integrated cross sections or phase shifts, in several datasets at once. χ² scans of one parameter are also available.
- **For agents and scripts**: An MCP server at `/mcp` (tools `list_examples`, `get_example`, `generate_deck`, `run_fresco`, `fit_sfresco`, `chi2_scan`), a JSON API (`/api/run`, `/api/fit`, `/api/examples`, described in `/openapi.json`), `/llms.txt`, and WebMCP tools in browsers that support them.

---

## Prerequisites

Before building or running the project, ensure you have:

- **Node.js**: v18.0.0 or higher
- **npm** or **bun** / **yarn**
- **GNU Fortran Compiler (`gfortran`)** *(Optional)*: For the native server engine (Ubuntu/Debian: `sudo apt-get install gfortran`). Without it, calculations run in the browser's WebAssembly engine.
- **Docker** *(Optional)*: For containerized, zero-configuration reproduction.

---

## Quick Start (Local Reproduction)

### 1. Clone the Repository
```bash
git clone <repository-url>
cd fresco-simulator
```

### 2. Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Start Development Server
```bash
npm run dev
```
The server will start on `http://localhost:3000`. The server automatically checks for `gfortran` and compiles native FRESCO binaries into `src/source/` if needed.

---

## Docker Deployment (Recommended)

To reproduce the exact production container environment with pre-built Fortran binaries:

```bash
# Build Docker image
docker build -t fresco-simulator .

# Run container
docker run -p 3000:3000 fresco-simulator
```

Access the app at `http://localhost:3000`.

---

## Static Deployment on Vercel (Offline PWA)

The app also works as a purely static site. `vercel.json` builds only the frontend (`vite build`); with no backend, `/api/fortran/*` requests are answered in the browser (`src/utils/localApiFallback.ts`), which runs FRESCO from `public/fresco/fresco.{js,wasm}` in a Web Worker. The service worker precaches these files, so an installed PWA keeps running calculations offline. Server-side compilation needs the Node server.

Import the repository in Vercel; no settings or environment variables are needed. Vercel also deploys the functions in `api/` (MCP server and JSON API), which run the same WebAssembly engine in Node. They import `api/_lib/fresco-api.js`, a bundle of `server/`; rebuild it with `npm run build:api` after changing `server/` or `src/physics/`.

## For agents and scripts

- **MCP**: add `https://<your-host>/mcp` as a remote MCP server (Streamable HTTP, no authentication). Tools:
  - `list_examples` and `get_example`: example reactions and their full setups.
  - `generate_deck`: the FRESCO namelist input for an example or setup.
  - `run_fresco`: run an example, a setup, or any deck exactly as written.
  - `fit_sfresco`: SFRESCO/MINUIT fits.
  - `chi2_scan`: χ²/N against one parameter.
- **JSON API**: `POST /api/run`, `POST /api/fit`, `GET /api/examples`, described in `/openapi.json`. For example:

  ```bash
  curl -X POST https://<your-host>/api/run -H 'Content-Type: application/json' -d '{"example":"p_208pb_16mev","overrides":{"eLab":30}}'
  ```

- **`/llms.txt`**: a short guide for language models.
- **WebMCP**: browsers that support WebMCP get the same tools from the page itself, running locally.

### Rebuilding the WebAssembly engine

The compiled engine is committed, so this is only needed after changing the Fortran in `src/source/`. `wasm/build.sh` uses LLVM flang 23.1.4 (e.g. from conda-forge), the matching `llvm-project-23.1.4` source for the Fortran runtime, and Emscripten:

```bash
EMSDK=/path/to/emsdk FLANG=/path/to/flang LLVM_SRC=/path/to/llvm-project-23.1.4.src bash wasm/build.sh
```

Upstream flang cannot target WebAssembly yet, so the script compiles to Win64 LLVM IR and retargets it to wasm64 (`wasm/retarget.py`), then Emscripten lowers the module to wasm32 for all browsers. `node wasm/run-node.mjs deck.in out.txt` runs a deck through the built engine; its cross sections match native gfortran to the printed precision (about 1e-6) for the presets and the `src/test` decks `nalpha`, `be11` and `xetazr`.

---

## Project Structure

```
├── Dockerfile               # Multi-stage build (gfortran + Node production image)
├── server.ts                # Express backend & Vite middleware / API routes
├── server/                  # MCP server, JSON API and FRESCO/SFRESCO runners for Node
├── api/                     # Vercel functions (MCP, JSON API) and their bundle in api/_lib
├── wasm/                    # Build of FRESCO/SFRESCO to WebAssembly (public/fresco)
├── validations/             # WebAssembly vs native gfortran checks
├── src/
│   ├── components/          # React UI: Simulate, Fit, input deck editor, help
│   ├── fortran/             # Native wrapper, WebAssembly runners (browser worker), shared result parsing
│   ├── physics/             # Deck generator/parser, SFRESCO search files, fort.16/fort.17 parsers
│   ├── source/              # Fortran source files & compiled fresco binaries
│   └── types/               # TypeScript interfaces & physics type definitions
├── .env.example             # Required environment variables
├── README.md                # Project introduction & reproduction guide
└── documentation.md         # In-depth architectural & technical documentation
```

---

## npm Scripts Reference

- `npm run dev`: Starts Express + Vite dev server with TypeScript execution (`tsx server.ts`).
- `npm run build`: Bundles client assets with Vite and compiles backend server to `dist/server.cjs` via `esbuild`.
- `npm run start`: Launches production server from `dist/server.cjs`.
- `npm run lint`: Runs TypeScript type checking (`tsc --noEmit`).
- `npm run validate` / `npm run validate:sfresco`: WebAssembly FRESCO / SFRESCO against native gfortran (see `validations/`).
- `npm run build:api`: Rebuilds `api/_lib/fresco-api.js` for the Vercel functions.

---

## License

Distributed under the MIT License. FRESCO source code belongs to its respective authors (I.J. Thompson).
