# FRESCO Nuclear Physics Simulator

A web GUI, input generator, coupled-channels engine simulator, and interactive plotter for **FRESCO** nuclear reaction calculations.

This platform bridges classical Fortran computational physics with modern web visualization—allowing nuclear physicists, researchers, and students to configure reaction decks, execute native compiled FRESCO binaries server-side, and analyze multi-channel angular cross-section distributions with interactive plots.

---

## Key Features

- **Interactive Input Deck Generator**: Namelist-based form builder and code editor supporting elastic scattering, coupled-channels, inelastic excitation, and transfer reactions (`&FRESCO` namelist generation).
- **Native Fortran Execution Engine**: Runs compiled `fresco` and `sfresco` binaries directly on the server host or container using `gfortran`.
- **Fortran in the Browser (WebAssembly)**: The official FRESCO Fortran is also compiled to WebAssembly (`public/fresco/`), so the app runs real FRESCO calculations with no server: on static hosting such as Vercel, and offline once the PWA is installed.
- **Multi-Channel XMGrace (`fort.16`) Parser**: Robust parser capable of reading multi-state XMGrace outputs, separating angular distributions across reaction channels (elastic ground state vs. excited states), and filtering directives.
- **Interactive Data Visualization**: Responsive plots using Recharts with logarithmic/linear scaling, center-of-mass angular distribution curves, Rutherford ratio plots, and coupling diagrams.
- **Built-in Benchmark Decks**: Presets including elastic scattering (`nalpha.nin`), coupled-channels inelastic scattering (`dexcc.nin`), and Coulomb excitation (`be11.nin`).
- **AI Reaction Assistant**: Integrated Gemini API helper for analyzing input parameters, diagnosing Fortran runtime errors, and explaining reaction outputs.

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
*(Optional: Set `GEMINI_API_KEY` in `.env` for AI Assistant capabilities).*

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

The app also works as a purely static site. `vercel.json` builds only the frontend (`vite build`); with no backend, `/api/fortran/*` requests are answered in the browser (`src/utils/localApiFallback.ts`), which runs FRESCO from `public/fresco/fresco.{js,wasm}` in a Web Worker. The service worker precaches these files, so an installed PWA keeps running calculations offline. The Gemini assistant and server-side compilation need the Node server.

Import the repository in Vercel; no settings or environment variables are needed.

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
├── src/
│   ├── components/          # React UI components (Plotter, Deck Editor, Coupling Diagram)
│   ├── fortran/             # Server-side execution wrapper & binary management
│   ├── physics/             # FRESCO input generator & XMGrace (fort.16) parser
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

---

## License

Distributed under the MIT License. FRESCO source code belongs to its respective authors (I.J. Thompson).
