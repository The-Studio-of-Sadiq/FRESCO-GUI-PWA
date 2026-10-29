# Validations: WebAssembly FRESCO vs native gfortran

These files show that the FRESCO engine the browser runs (`public/fresco/fresco.wasm`,
built by `wasm/build.sh`) gives the same results as the official FRESCO Fortran
compiled natively with gfortran.

```
validations/
├── decks/              input decks
├── native/             native gfortran FRESCO: stdout (*.out), fort.16, runs.json
├── wasm/               WebAssembly FRESCO:     stdout (*.out), fort.16, runs.json
├── fetch-native.mjs    gets native/ from a deployed server with the gfortran binary
└── compare.mjs         runs decks/ through the WebAssembly engine and compares with native/
```

## Decks

| Deck | Source | Physics |
|---|---|---|
| `p_208pb_16mev.in` | app preset (`generateFrescoDeck`) | p + ²⁰⁸Pb elastic, 16 MeV, spin-orbit, analysing power |
| `d_12c_transfer.in` | app preset | ¹²C(d,p)¹³C zero-range DWBA transfer, 12 MeV, bound-state search |
| `16o_208pb_heavyion.in` | app preset | ¹⁶O + ²⁰⁸Pb heavy-ion elastic, 129.5 MeV |
| `n_56fe_fastneutron.in` | app preset | n + ⁵⁶Fe elastic, 14.1 MeV |
| `nalpha.nin` | FRESCO test suite (`src/test`) | n + α elastic, 1 MeV |
| `be11.nin` | FRESCO test suite | ¹¹Be + ¹⁹⁷Au Coulomb excitation, 2 coupled states |
| `xetazr.nin` | FRESCO test suite | zero-range transfer |

## How the reference was made

`native/` comes from the app's Render deployment, which runs FRESCO compiled with
gfortran in the Docker image (`Dockerfile`): `node validations/fetch-native.mjs` posts
each deck to `/api/fortran/run-fresco` and saves the program's stdout and `fort.16`.
`native/runs.json` records exit codes and stderr.

## Running the comparison

```bash
npm run validate
```

`compare.mjs` loads `public/fresco/fresco.{js,wasm}` in Node, the same module the
browser's Web Worker uses, runs each deck, writes `wasm/`, and compares every printed
result with `native/`:

- **X-S**: differential cross sections (mb/sr) of every outgoing channel
- **/R**: ratios to Rutherford
- **pols**: analysing powers (T10, iT11)
- **CUMUL**: the CUMULATIVE reaction / elastic / outgoing / absorption cross sections
- **fort.16**: every number in the XMGrace cross-section tables

Two values agree when they differ by at most twice the last printed digit (FRESCO
rounds its output to that precision) plus 10⁻⁶ relative. The script exits with code 1
if anything disagrees.

## Results

All 7 decks pass: 3,250 values, every one within the printed precision.

| Deck | Values compared | Worst relative difference | Reaction cross section, native → WebAssembly (mb) |
|---|---|---|---|
| `p_208pb_16mev` | 488 | 1.8×10⁻⁵ (/R, 5 digits printed) | 902.19370 → 902.19375 |
| `d_12c_transfer` | 673 | 1.2×10⁻⁶ | 1054.66835 → 1054.66832 |
| `16o_208pb_heavyion` | 346 | 4.5×10⁻⁷ | 445.59176 → 445.59169 |
| `n_56fe_fastneutron` | 349 | 1.5×10⁻⁴ (fort.16, 4 digits printed) | 1514.62298 → 1514.62291 |
| `nalpha` | 11 | 5.3×10⁻⁷ | 0.00000 → 0.00000 |
| `be11` | 1,262 | 5.9×10⁻⁵ (/R, 5 digits printed) | 2758.68730 → 2758.68756 |
| `xetazr` | 121 | 2.3×10⁻⁷ | 42.95724 → 42.95725 |

Notes:

- The two zero-range transfer decks (`d_12c_transfer`, `xetazr`) crash natively with
  SIGSEGV *after* writing all their output (exit code `null` in `native/runs.json`);
  the WebAssembly engine finishes them with exit code 0. Their results agree.
- The `.out` files differ in layout only: flang and gfortran use different field
  widths for list-directed output (e.g. `M,Mint =  501 501`), and timing lines differ.
- The WebAssembly build compiles `frxx3.f` with `mod(i-is,norto)` guarded against
  `norto = 0` (see `wasm/build.sh`); gfortran avoided that division by zero only by
  short-circuiting `.AND.`. Every other source file is compiled unchanged.
