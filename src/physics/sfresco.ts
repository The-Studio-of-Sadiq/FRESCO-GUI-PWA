import { FRESCODeckConfig, OpticalPotential } from '../types/fresco';
import { generateFrescoDeck, PotentialCard, potentialCards } from './frescoParser';

// Chi-square searches with SFRESCO (FRESCO + MINUIT). This module writes the SFRESCO
// search file for a FRESCO deck made by generateFrescoDeck, and reads SFRESCO's output.

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
  | { kind: 'normalisation' };

export interface FitDataset {
  /** Partition (1-based) and state within it (1-based) of the measured channel. */
  partition: number;
  state: number;
  /** 'absolute': cross section in mb/sr; 'ratio': ratio to Rutherford. */
  quantity: 'absolute' | 'ratio';
  points: { angle: number; value: number; error: number }[];
}

export function parameterId(p: FitParameter): string {
  return p.kind === 'potential' ? `pot${p.potentialIndex}:${p.key}` : p.kind === 'spectroscopic' ? `S:${p.couplingId}` : 'norm';
}

/** Where a potential parameter lives in the deck, or why it cannot be varied. */
export function locatePotentialParameter(
  deckText: string,
  potentialIndex: number,
  key: keyof OpticalPotential,
): { pline: number; col: number } | { error: string } {
  const term = POTENTIAL_FIT_TERMS.find((t) => t.key === key);
  if (!term) return { error: 'not a fittable parameter' };
  const pline = potentialCards(deckText, potentialIndex + 1).indexOf(term.card) + 1;
  if (pline === 0) {
    const what = term.card === 'surface' ? 'W_D' : term.card === 'spinorbit' ? 'V_so' : 'V or W';
    return { error: `Set a non-zero ${what} first: FRESCO has no ${term.card} term to vary` };
  }
  return { pline, col: term.col };
}

const fortranNumber = (v: number) => (Number.isFinite(v) ? Number(v.toPrecision(10)).toString() : '0');

/** The SFRESCO search file: deck names, &variable per parameter, one &data set. */
export function buildSearchFile(config: FRESCODeckConfig, parameters: FitParameter[], dataset: FitDataset): string {
  const deck = generateFrescoDeck(config);
  const transfers = config.couplings.filter((c) => c.couplingType === 'transfer-dwba');
  const lines = [`'${DECK_FILE}' 'fit.out'`, `${parameters.length} 1`];

  parameters.forEach((p, i) => {
    const name = `p${i + 1}`;
    if (p.kind === 'potential') {
      const at = locatePotentialParameter(deck, p.potentialIndex, p.key);
      if ('error' in at) throw new Error(at.error);
      const value = config.potentials[p.potentialIndex][p.key] as number;
      const step = Math.max(Math.abs(value) * 0.01, 0.001);
      lines.push(` &variable kind=1 name='${name}' kp=${p.potentialIndex + 1} pline=${at.pline} col=${at.col} step=${fortranNumber(step)} /`);
    } else if (p.kind === 'spectroscopic') {
      // &cfp namelists are written in the order of the transfer couplings
      const nafrac = transfers.findIndex((c) => c.id === p.couplingId) + 1;
      if (nafrac === 0) throw new Error('Unknown transfer coupling');
      lines.push(` &variable kind=2 name='${name}' nafrac=${nafrac} step=0.01 /`);
    } else {
      lines.push(` &variable kind=5 name='${name}' dataset=1 datanorm=1.0 step=0.01 /`);
    }
  });

  const idir = dataset.quantity === 'ratio' ? 1 : 0;
  const iscale = dataset.quantity === 'ratio' ? -1 : 2;
  lines.push(
    ` &data type=0 idir=${idir} iscale=${iscale} lab=F abserr=T ic=${dataset.partition} ia=${dataset.state} energy=${fortranNumber(config.eLab)} /`,
  );
  for (const pt of dataset.points) lines.push(` ${fortranNumber(pt.angle)} ${fortranNumber(pt.value)} ${fortranNumber(pt.error)}`);
  lines.push('&', '');
  return lines.join('\n');
}

/** SFRESCO commands: report, minimise with MIGRAD, report again, list theory vs data. */
export const SEARCH_COMMANDS = [SEARCH_FILE, 'q', 'min', 'migrad', 'end', 'q', 'show', 'exit', ''].join('\n');

export interface FitResult {
  initialChi2PerPoint: number | null;
  finalChi2PerPoint: number | null;
  converged: boolean;
  status: string;
  /** Fitted values and MINUIT errors, in parameter order. */
  values: { value: number; error: number }[];
  /** Data and fitted theory at the data angles, from SFRESCO's `show`. */
  comparison: { angle: number; datum: number; error: number; theory: number }[];
}

export function parseSfrescoOutput(stdout: string, nParameters: number): FitResult {
  const chi2 = [...stdout.matchAll(/Total ChiSq\/N\s*=\s*([-\d.Ee+]+)/g)].map((m) => parseFloat(m[1]));
  // "Var   1=p1         value     1.181406, step   0.0100, error   0.0004" (last listing wins)
  const values: FitResult['values'] = [];
  for (const m of stdout.matchAll(/Var\s+(\d+)=\S*\s+value\s+([-\d.Ee+]+), step\s+[-\d.Ee+]+, error\s+([-\d.Ee+*]+)/g)) {
    values[parseInt(m[1], 10) - 1] = { value: parseFloat(m[2]), error: parseFloat(m[3]) || 0 };
  }

  const migrad = [...stdout.matchAll(/MIGRAD (MINIMIZATION HAS CONVERGED|TERMINATED WITHOUT CONVERGENCE|FAILS[^\n]*)/g)].map((m) => m[1]);
  const lastStatus = migrad[migrad.length - 1] ?? '';
  const converged = /CONVERGED/.test(lastStatus) && !/WITHOUT/.test(lastStatus);

  const comparison: FitResult['comparison'] = [];
  const showStart = stdout.lastIndexOf('Angle   Datum');
  if (showStart >= 0) {
    for (const line of stdout.slice(showStart).split('\n').slice(1)) {
      const nums = line.trim().split(/\s+/).map(Number);
      if (nums.length >= 4 && nums.slice(0, 4).every((n) => !isNaN(n))) {
        comparison.push({ angle: nums[0], datum: nums[1], error: nums[2], theory: nums[3] });
      } else if (comparison.length > 0) break;
    }
  }

  return {
    initialChi2PerPoint: chi2.length ? chi2[0] : null,
    finalChi2PerPoint: chi2.length ? chi2[chi2.length - 1] : null,
    converged,
    status: lastStatus ? `MIGRAD ${lastStatus.toLowerCase()}` : values.length === nParameters ? 'Search finished' : 'Search did not finish',
    values: values.slice(0, nParameters),
  comparison,
  };
}

/** The setup with fitted values put back (spectroscopic amplitude A -> factor S = A²). */
export function applyFitValues(config: FRESCODeckConfig, parameters: FitParameter[], values: { value: number }[]): FRESCODeckConfig {
  let potentials = config.potentials;
  let couplings = config.couplings;
  parameters.forEach((p, i) => {
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
