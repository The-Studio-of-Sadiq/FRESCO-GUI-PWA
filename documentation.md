# FRESCO Nuclear Physics Simulator Documentation

This document provides a technical guide to the architecture, Fortran integration, parser specification, state management, and API design of the **FRESCO Nuclear Physics Simulator**.

---

## 1. System Architecture Overview

The application utilizes a full-stack Node.js/Express architecture integrated with a native GNU Fortran execution environment:

```
┌─────────────────────────────────────────────────────────────┐
│                       React Frontend                        │
│   Input Builder │ Deck Code Editor │ Recharts Plotter │ AI   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / REST API
┌──────────────────────────────▼──────────────────────────────┐
│                    Express Backend Server                   │
│   /api/fortran/execute  │ /api/fortran/status │ AI API  │
└──────────────────────────────┬──────────────────────────────┘
                               │ Native Process Execution
┌──────────────────────────────▼──────────────────────────────┐
│                  Fortran Execution Layer                    │
│   gfortran compilation │ fresco binary │ temp run dir      │
└──────────────────────────────┬──────────────────────────────┘
                               │ File I/O
┌──────────────────────────────▼──────────────────────────────┐
│                    FRESCO Solver Output                     │
│   fresco.out │ fort.16 (XMGrace) │ fort.13 │ fort.39         │
└─────────────────────────────────────────────────────────────┘
```

- **Frontend**: React 19, Tailwind CSS v4, Lucide Icons, Recharts for data visualization, Motion for transitions.
- **Backend**: Express 4 running on Node.js, bundling server-side execution via `esbuild`.
- **Physics Layer**: `gfortran` compiled FRESCO binaries (I.J. Thompson coupled-channels reaction solver).

---

## 2. Fortran Execution & Binary Management (`/src/fortran/frescoWrapper.ts`)

### Binary Initialization Lifecycle
1. **Environment Audit**: Checks for `gfortran` installation on the host system.
2. **Compilation On-Demand**: If precompiled `fresco` binaries are missing from `src/source/`, the server executes `gfortran` to compile the 40+ Fortran source files into a native executable executable path.
3. **Execution Sandbox**:
   - Creates an isolated temp directory per simulation run (`/tmp/fresco-run-<uuid>`).
   - Writes the input deck (e.g. `input.nin`) into the run directory.
   - Spawns the `fresco` process with stdin redirected from `input.nin` and stdout captured to `fresco.out`.
   - Reads produced output files (`fort.16`, `fresco.out`, etc.).
   - Cleans up temporary run artifacts upon completion.

---

## 3. XMGrace & Output Parsing Engine (`/src/physics/frescoParser.ts`)

The parser interprets FRESCO output files, primarily `fort.16` (XMGrace formatted cross-section data) and fallback stdout prints.

### Multi-Channel `fort.16` XMGrace Parser (`parseFort16Output`)

FRESCO's `fort.16` contains multi-state reaction datasets formatted with XMGrace `@` directives. 

#### Key Parser Safeguards:
- **XMGrace Directive Filter**: Safely ignores `@` formatting lines (e.g., `@type xy`, `@world`, `@legend`).
- **Legend & Channel Extractor**:
  - Matches quoted strings directly: `trimmed.match(/"([^"]+)"/)` to extract state descriptors like `"Partition= 1 Excit= 1 near/far= 1"`.
  - Captures dataset metadata prior to block flush to avoid phase-shift legend overwrites.
- **Block Boundary & Angle Reset Handling**:
  - Monitors monotonic angle progression ($\theta_i > \theta_{i-1}$).
  - Triggers dataset save (`saveCurrentDataset()`) whenever an angle reset ($\theta_i \le \theta_{i-1}$) or explicit `@legend` marker is encountered.
- **Primary Channel Selection**:
  - Automatically identifies the ground-state elastic channel (`Partition=1, Excit=1`) as primary for display while preserving secondary excited channels.

#### Fallback Output Parser (`parseFrescoOutCrossSections`)
When `fort.16` is empty or unwritten (e.g., when `xstabl=0` in input decks), the parser inspects `fresco.out` using strict rules:
1. **Pattern 1 (`deg.: X-S =`)**: Matches exact FRESCO single-channel stdout lines (`50.00 deg.: X-S = 286.779 mb/sr`).
2. **Pattern 2 (Strict Tabular Scanner)**:
   - Requires explicit table headers containing both angle keywords (`ANGLE`, `THETA`, `DEG`) and cross-section keywords (`SIGMA`, `X-S`, `CROSS SECTION`, `MB/SR`).
   - Requires strict monotonic angle increase to prevent vacuuming unrelated quantum-number tables or S-matrix prints.

---

## 4. API Endpoints Reference

### 1. `GET /api/fortran/status`
Returns the status of `gfortran` and the compiled FRESCO binaries.

**Response Example:**
```json
{
  "hasGfortran": true,
  "hasSources": true,
  "hasFrescoBinary": true,
  "hasSfrescoBinary": true,
  "sourceFilesCount": 42,
  "binaryPath": "/app/src/source/fresco",
  "compilerInfo": "GNU Fortran 12.3.0"
}
```

### 2. `POST /api/fortran/execute`
Executes a FRESCO input deck string and returns calculated cross sections and raw logs.

**Request Body:**
```json
{
  "inputDeck": "'11Be on 197Au Coulex' ... &FRESCO ... &END"
}
```

**Response Example:**
```json
{
  "success": true,
  "angularDistribution": [
    { "angleCm": 1.0, "angleLab": 1.0, "sigmaMb": 286.77, "sigmaRutherford": 286.77, "ratioRutherford": 1.0, "ay": 0.0 }
  ],
  "rawOutput": "...",
  "executionTimeMs": 142
}
```

### 3. `GET /api/fortran/decks`
Returns pre-built preset reaction decks (`nalpha.nin`, `dexcc.nin`, `be11.nin`).

---

## 5. Troubleshooting & Common Physics Cases

| Issue / Case | Cause | Fix / Behavior |
| :--- | :--- | :--- |
| `fort.16` is 0 bytes | `xstabl=0` or `thmax=0.0` in namelist | FRESCO is configured not to write angular distribution tables. Parser returns 0 points without generating fake synthetic data. |
| Multiple Channels in Plot | Coupled-channels run (e.g. `be11.nin` with `Excit=1` and `Excit=2`) | The parser separates datasets into discrete channels and selects elastic `Excit=1` as primary. |
| `gfortran` not found | Missing native compiler on host | Install `gfortran` (`apt-get install gfortran`) or build using the included Dockerfile. |

---

## 6. Development Guidelines

When modifying input generation or parsing logic:
1. Always run TypeScript validation via `npm run lint`.
2. Test changes against real FRESCO output files rather than mock numbers.
3. Ensure `@` directive lines in `fort.16` are never tokenized as numeric data rows.
