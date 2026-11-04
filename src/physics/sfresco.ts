import { FRESCODeckConfig, OpticalPotential } from '../types/fresco';
import { PotentialCard, groupTransfers, patchDeckCfp, patchDeckPotential, potentialCards } from './frescoParser';

// Chi-square searches with SFRESCO (FRESCO + MINUIT). This module writes the SFRESCO
// search file for a FRESCO deck and reads SFRESCO's output.

export const SEARCH_FILE = 'fit.search';
export const DECK_FILE = 'fit.in';

/** Potential parameters SFRESCO can vary: which card (pline) and column (col = p1..p6) hold them. */
export const POTENTIAL_FIT_TERMS: { key: keyof OpticalPotential; label: string; card: PotentialCard; col: number; unit: string }[] = [
  { key: 'V0', label: 'V', card: 'volume', col: 1, unit: 'MeV' },
  { key: 'r0', label: 'r_V', card: 'volume', col: 2, unit: 'fm' },
  { key: 'a0', label: 'a_V', card: 'volume', col: 3, unit: 'fm' },
  { key: 'W0', label: 'W', card: 'volume', col: 4, unit: 'MeV' },
  { key: 'rw', label: 'r_W', card: 'volume', col: 5, unit: 'fm' },
  { key: 'aw', label: 'a_W', card: 'volume', col: 6, unit: 'fm' },
  { key: 'Wd', label: 'W_D', card: 'surface', col: 4, unit: 'MeV' },
  { key: 'rd', label: 'r_D', card: 'surface', col: 5, unit: 'fm' },
  { key: 'ad', label: 'a_D', card: 'surface', col: 6, unit: 'fm' },
  { key: 'Vso', label: 'V_so', card: 'spinorbit', col: 1, unit: 'MeV' },
  { key: 'rso', label: 'r_so', card: 'spinorbit', col: 2, unit: 'fm' },
  { key: 'aso', label: 'a_so', card: 'spinorbit', col: 3, unit: 'fm' },
];

export type FitParameter =
  | { kind: 'potential'; potentialIndex: number; key: keyof OpticalPotential }
  | { kind: 'spectroscopic'; couplingId: string }
  | { kind: 'normalisation'; dataset: number }
  | { kind: 'rmatrix-energy'; term: number; jtot: number; parity: 1 | -1; energy: number }
  | { kind: 'rmatrix-width'; term: number; channel: number; width: number };

export interface FitVariable {
  param: FitParameter;
  /** Optional strict bounds (MINUIT valmin/valmax). */
  min?: number;
  max?: number;
}

export type DatasetType =
  /** dσ/dΩ (or σ/σ_Ruth) against angle at one energy */
  | 'angular'
  /** dσ/dΩ against lab energy at one angle */
  | 'excitation'
  /** angle-integrated cross section against lab energy */
  | 'integrated'
  /** phase shift (degrees) against lab energy for one J^π */
  | 'phase';

export type IntegratedQuantity = 'channel' | 'reaction' | 'total' | 'elastic' | 'fusion';

export interface FitDataset {
  type: DatasetType;
  /** Partition (1-based) and state within it (1-based) of the measured channel. */
  partition: number;
  state: number;
  /** angular: 'absolute' mb/sr, or 'ratio' to Rutherford. */
  quantity: 'absolute' | 'ratio';
  /** Lab energy of an angular distribution (MeV). */
  energy?: number;
  /** Centre-of-mass angle of an excitation function (deg). */
  angle?: number;
  integrated?: IntegratedQuantity;
  /** Phase shift: total J, parity and entrance channel number. */
  jtot?: number;
  parity?: 1 | -1;
  channel?: number;
  /** x = angle (angular) or lab energy (others); value; absolute error. */
  points: { x: number; value: number; error: number }[];
}

export function parameterId(p: FitParameter): string {
  switch (p.kind) {
    case 'potential':
      return `pot${p.potentialIndex}:${p.key}`;
    case 'spectroscopic':
      return `S:${p.couplingId}`;
    case 'normalisation':
      return `norm:${p.dataset}`;
    case 'rmatrix-energy':
      return `rmE:${p.term}`;
    case 'rmatrix-width':
      return `rmW:${p.term}:${p.channel}`;
  }
}

/** Where a potential parameter lives in the deck, or why it cannot be varied. */
export function locatePotentialParameter(
  deckText: string,
  potentialIndex: number,
  key: keyof OpticalPotential,
): { kp: number; pline: number; col: number; card: PotentialCard } | { error: string } {
  const term = POTENTIAL_FIT_TERMS.find((t) => t.key === key);
  if (!term) return { error: 'not a fittable parameter' };
  const kp = potentialIndex + 1;
  const pline = potentialCards(deckText, kp).indexOf(term.card) + 1;
  if (pline === 0) {
    const what = term.card === 'surface' ? 'W_D' : term.card === 'spinorbit' ? 'V_so' : 'V or W';
    return { error: `Set a non-zero ${what} first: FRESCO has no ${term.card} term to vary` };
  }
  return { kp, pline, col: term.col, card: term.card };
}

const num = (v: number) => (Number.isFinite(v) ? Number(v.toPrecision(10)).toString() : '0');

/** The transfer couplings in &cfp order (one &cfp per transfer, as generateFrescoDeck writes them). */
function transferIds(config: FRESCODeckConfig) {
  return groupTransfers(config)
    .flat()
    .map((c) => c.id);
}

/** Starting value of a variable, in SFRESCO's units (spectroscopic: amplitude A = √S). */
export function startingValue(config: FRESCODeckConfig, p: FitParameter): number {
  switch (p.kind) {
    case 'potential':
      return config.potentials[p.potentialIndex]?.[p.key] as number;
    case 'spectroscopic':
      return Math.sqrt(Math.max(0, config.couplings.find((c) => c.id === p.couplingId)?.spectroscopicFactor ?? 0));
    case 'normalisation':
      return 1;
    case 'rmatrix-energy':
      return p.energy;
    case 'rmatrix-width':
      return p.width;
  }
}

/** The SFRESCO search file: deck names, one &variable per variable, then the datasets. */
export function buildSearchFile(config: FRESCODeckConfig, deckText: string, variables: FitVariable[], datasets: FitDataset[]): string {
  const lines = [`'${DECK_FILE}' 'fit.out'`, `${variables.length} ${datasets.length}`];
  const bounds = (v: FitVariable) =>
    `${v.min !== undefined ? ` valmin=${num(v.min)}` : ''}${v.max !== undefined ? ` valmax=${num(v.max)}` : ''}`;

  variables.forEach((v, i) => {
    const p = v.param;
    const name = `p${i + 1}`;
    const step = Math.max(Math.abs(startingValue(config, p)) * 0.01, 0.001);
    if (p.kind === 'potential') {
      const at = locatePotentialParameter(deckText, p.potentialIndex, p.key);
      if ('error' in at) throw new Error(at.error);
      lines.push(` &variable kind=1 name='${name}' kp=${at.kp} pline=${at.pline} col=${at.col} step=${num(step)}${bounds(v)} /`);
    } else if (p.kind === 'spectroscopic') {
      const nafrac = transferIds(config).indexOf(p.couplingId) + 1;
      if (nafrac === 0) throw new Error('Unknown transfer coupling');
      lines.push(` &variable kind=2 name='${name}' nafrac=${nafrac} step=0.01${bounds(v)} /`);
    } else if (p.kind === 'normalisation') {
      lines.push(` &variable kind=5 name='${name}' dataset=${p.dataset + 1} datanorm=1.0 step=0.01${bounds(v)} /`);
    } else if (p.kind === 'rmatrix-energy') {
      lines.push(
        ` &variable kind=3 name='${name}' term=${p.term} jtot=${num(p.jtot)} par=${p.parity} energy=${num(p.energy)} step=${num(step)}${bounds(v)} /`,
      );
    } else {
      lines.push(` &variable kind=4 name='${name}' term=${p.term} channel=${p.channel} width=${num(p.width)} step=${num(step)}${bounds(v)} /`);
    }
  });

  for (const d of datasets) {
    // `points=` instead of a closing `&` line: flang's runtime does not skip that line
    // before the next namelist, as gfortran's does.
    const common = `abserr=T lab=F points=${d.points.length}`;
    if (d.type === 'angular') {
      const ratio = d.quantity === 'ratio';
      lines.push(
        ` &data type=0 idir=${ratio ? 1 : 0} iscale=${ratio ? -1 : 2} ic=${d.partition} ia=${d.state} energy=${num(d.energy ?? config.eLab)} ${common} /`,
      );
    } else if (d.type === 'excitation') {
      lines.push(` &data type=2 idir=0 iscale=2 ic=${d.partition} ia=${d.state} angle=${num(d.angle ?? 90)} ${common} /`);
    } else if (d.type === 'integrated') {
      // SFRESCO: ic=0 selects ia = 1 reaction, -2 total, -1 elastic, 0 fusion
      const q = d.integrated ?? 'reaction';
      const [ic, ia] = q === 'channel' ? [d.partition, d.state] : [0, { reaction: 1, total: -2, elastic: -1, fusion: 0 }[q]];
      lines.push(` &data type=3 idir=0 iscale=2 ic=${ic} ia=${ia} ${common} /`);
    } else {
      lines.push(` &data type=4 iscale=-1 jtot=${num(d.jtot ?? 0.5)} par=${d.parity ?? 1} channel=${d.channel ?? 1} ${common} /`);
    }
    for (const pt of d.points) lines.push(` ${num(pt.x)} ${num(pt.value)} ${num(pt.error)}`);
  }
  lines.push('');
  return lines.join('\n');
}

/** SFRESCO commands: report, minimise with MIGRAD, report again, list theory vs data. */
export const FIT_COMMANDS = [SEARCH_FILE, 'q', 'show', 'min', 'migrad', 'end', 'q', 'show', 'exit', ''].join('\n');

/** SFRESCO commands for a χ² scan of variable `index` (1-based) with the others fixed. */
export function scanCommands(index: number, from: number, to: number, step: number): string {
  return [SEARCH_FILE, `scan ${index} ${num(from)} ${num(to)} ${num(step)}`, 'exit', ''].join('\n');
}

export interface DatasetComparison {
  /** x = angle or lab energy, as in the dataset. */
  rows: { x: number; datum: number; error: number; theory: number }[];
}

export interface FitResult {
  initialChi2PerPoint: number | null;
  finalChi2PerPoint: number | null;
  converged: boolean;
  status: string;
  /** Fitted values and MINUIT errors, in variable order. */
  values: { value: number; error: number }[];
  /** Data and theory at the data points, per dataset, from SFRESCO's `show` before and after the search. */
  before: DatasetComparison[];
  comparison: DatasetComparison[];
}

/** Every `show` listing in the output: per dataset, rows "x datum error theory chi". */
function parseShows(stdout: string): DatasetComparison[][] {
  return stdout
    .split('sfresco> ')
    .filter((chunk) => /^\s*\n\s*Dataset\s+\d+\s*<=>/.test(chunk))
    .map((chunk) =>
      chunk
        .split(/\n\s*Dataset\s+\d+\s*<=>/)
        .slice(1)
        .map((block) => {
          const rows: DatasetComparison['rows'] = [];
          for (const line of block.split('\n').slice(2)) {
            const nums = line.trim().split(/\s+/).map(Number);
            if (nums.length >= 4 && nums.slice(0, 4).every((n) => !isNaN(n))) rows.push({ x: nums[0], datum: nums[1], error: nums[2], theory: nums[3] });
            else if (rows.length > 0) break;
          }
          return { rows };
        }),
    );
}

export function parseSfrescoOutput(stdout: string, nVariables: number): FitResult {
  const chi2 = [...stdout.matchAll(/Total ChiSq\/N\s*=\s*([-\d.Ee+]+)/g)].map((m) => parseFloat(m[1]));
  // "Var   1=p1         value     1.181406, step   0.0100, error   0.0004" (last listing wins)
  const values: FitResult['values'] = [];
  for (const m of stdout.matchAll(/Var\s+(\d+)=\S*\s+value\s+([-\d.Ee+]+), step\s+[-\d.Ee+]+, error\s+([-\d.Ee+*]+)/g)) {
    values[parseInt(m[1], 10) - 1] = { value: parseFloat(m[2]), error: parseFloat(m[3]) || 0 };
  }

  const migrad = [...stdout.matchAll(/MIGRAD (MINIMIZATION HAS CONVERGED|TERMINATED WITHOUT CONVERGENCE|FAILS[^\n]*)/g)].map((m) => m[1]);
  const lastStatus = migrad[migrad.length - 1] ?? '';
  const converged = /CONVERGED/.test(lastStatus) && !/WITHOUT/.test(lastStatus);

  const shows = parseShows(stdout);

  return {
    initialChi2PerPoint: chi2.length ? chi2[0] : null,
    finalChi2PerPoint: chi2.length ? chi2[chi2.length - 1] : null,
    converged,
    status: lastStatus ? `MIGRAD ${lastStatus.toLowerCase()}` : values.length === nVariables ? 'Search finished' : 'Search did not finish',
    values: values.slice(0, nVariables),
    before: shows.length > 1 ? shows[0] : [],
    comparison: shows.length ? shows[shows.length - 1] : [],
  };
}

/** "Variable   1:V =   40.00    : ChiSq/N =222341.249 from ..." */
export function parseSfrescoScan(stdout: string): { value: number; chi2PerPoint: number }[] {
  return [...stdout.matchAll(/Variable\s+\d+:\S*\s*=\s*([-\d.Ee+]+)\s*:\s*ChiSq\/N\s*=\s*([-\d.Ee+]+)/g)].map((m) => ({
    value: parseFloat(m[1]),
    chi2PerPoint: parseFloat(m[2]),
  }));
}

/** The setup with fitted values put back (spectroscopic amplitude A -> factor S = A²). */
export function applyFitValues(config: FRESCODeckConfig, variables: FitVariable[], values: { value: number }[]): FRESCODeckConfig {
  let potentials = config.potentials;
  let couplings = config.couplings;
  variables.forEach(({ param: p }, i) => {
    const v = values[i]?.value;
    if (v === undefined || !Number.isFinite(v)) return;
    if (p.kind === 'potential') {
      potentials = potentials.map((pot, idx) => (idx === p.potentialIndex ? { ...pot, [p.key]: Number(v.toPrecision(6)) } : pot));
    } else if (p.kind === 'spectroscopic') {
      couplings = couplings.map((c) => (c.id === p.couplingId ? { ...c, spectroscopicFactor: Number((v * v).toPrecision(6)) } : c));
    }
  });
  return { ...config, potentials, couplings };
}

/** A deck written by hand, with the fitted potential values and spectroscopic amplitudes put in. */
export function applyFitValuesToDeck(deckText: string, config: FRESCODeckConfig, variables: FitVariable[], values: { value: number }[]): string {
  let deck = deckText;
  const transfers = transferIds(config);
  variables.forEach(({ param: p }, i) => {
    const v = values[i]?.value;
    if (v === undefined || !Number.isFinite(v)) return;
    if (p.kind === 'potential') {
      const at = locatePotentialParameter(deck, p.potentialIndex, p.key);
      if (!('error' in at)) deck = patchDeckPotential(deck, at.kp, at.card, at.col, Number(v.toPrecision(6)));
    } else if (p.kind === 'spectroscopic') {
      deck = patchDeckCfp(deck, transfers.indexOf(p.couplingId) + 1, Number(v.toPrecision(6)));
    }
  });
  return deck;
}
