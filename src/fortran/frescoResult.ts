import { AngularDataPoint, FRESCODeckConfig, SimulationOutput, SimulationSummary } from '../types/fresco';
import { parseFort16Output, parseFrescoDeck, parseFrescoOutCrossSections } from '../physics/frescoParser';

// Turns the raw output of a FRESCO run into the app's result shape. Shared by the
// native gfortran wrapper (Node) and the WebAssembly worker (browser), so both
// engines are read the same way.

export type FortranEngineLabel = 'Native Fortran (gfortran)' | 'Fortran FRESCO (WebAssembly)';

export interface FortranRunResult {
  success: boolean;
  engineUsed: FortranEngineLabel | 'TypeScript High-Speed Physics Engine';
  exitCode: number | null;
  output: SimulationOutput;
  stdout: string;
  stderr: string;
  fort16Raw: string;
  frescoOutRaw: string;
  fort57Raw?: string;
  searchOutRaw?: string;
  error?: string;
}

/** Output files a run may leave behind, read by name (fort.N). */
export const FRESCO_OUTPUT_FILES = ['fresco.out', 'fort.16', 'fort.57', 'fort.13', 'fort.14', 'fort.17', 'fort.38', 'fort.39', 'fort.200'];

export function projectileSpinOf(deck: string | FRESCODeckConfig): number {
  const config = typeof deck === 'string' ? parseFrescoDeck(deck) : deck;
  return config.partitions[0]?.projectile.spin ?? 0;
}

export interface RawFrescoRun {
  engine: FortranEngineLabel;
  executable: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  files: Record<string, string>;
  executionTimeMs: number;
  projectileSpin: number;
}

export function buildFortranRunResult(run: RawFrescoRun): FortranRunResult {
  const { engine, exitCode: code, stdout, stderr, files, executionTimeMs } = run;
  const fort16Raw = files['fort.16'] || '';
  const fort57Raw = files['fort.57'] || '';
  const frescoOutRaw = files['fresco.out'] || stdout;

  // Standard output has absolute elastic cross sections (fort.16 holds only sigma/Rutherford
  // for charged particles), so read it first and fall back to the fort.* tables.
  let angularDistribution: AngularDataPoint[] = parseFrescoOutCrossSections(frescoOutRaw, run.projectileSpin);
  if (angularDistribution.length === 0 && fort16Raw) {
    angularDistribution = parseFort16Output(fort16Raw);
  }

  // If fort.16 is empty, check other standard fort.* angular cross section files
  if (angularDistribution.length === 0) {
    for (const file of ['fort.13', 'fort.14', 'fort.17', 'fort.38', 'fort.39', 'fort.200']) {
      const parsedAlt = files[file] ? parseFort16Output(files[file]) : [];
      if (parsedAlt.length >= 2) {
        angularDistribution = parsedAlt;
        break;
      }
    }
  }

  const summary: SimulationSummary = {
    totalReactionCrossSection: 0,
    totalElasticCrossSection: 0,
    rutherfordRadius: 1.25,
    grazingL: 0,
    quarterPointAngle: 0,
    executionTimeMs,
    engineUsed: engine,
    exitCode: code,
  };

  // Extract integrated cross sections from fresco.out, e.g.
  // "0CUMULATIVE REACTION cross section = 902.19370" ("CUMULATIVE  ELASTIC" only for neutral projectiles)
  if (frescoOutRaw) {
    const reactMatch = frescoOutRaw.match(/CUMULATIVE\s+REACTION cross section\s*=\s*([\d.+E-]+)/i);
    if (reactMatch) summary.totalReactionCrossSection = parseFloat(reactMatch[1]);

    const elastMatch = frescoOutRaw.match(/CUMULATIVE\s+ELASTIC cross section\s*=\s*([\d.+E-]+)/i);
    if (elastMatch) summary.totalElasticCrossSection = parseFloat(elastMatch[1]);
  }

  // FRESCO reports input/numerical problems on stdout and stops with exit code 0, e.g.
  // "Step size HCM 0.05000 is too large: REDUCE TO < 0.02163, so STOP!"
  const stopLine = frescoOutRaw.split('\n').find((l) => /\bSTOP!?\s*$/.test(l.trim()));

  const output: SimulationOutput = {
    angularDistribution,
    potentials: [],
    wavefunctions: [],
    sMatrix: [],
    summary,
    logs: [
      `[${engine}] Executed ${run.executable}`,
      `[${engine}] Exit Code: ${code}`,
      `[${engine}] Execution Time: ${executionTimeMs.toFixed(1)} ms`,
      `[Fortran stdout] Captured ${stdout.length} bytes`,
    ],
    frescoOut: frescoOutRaw,
    fort16: fort16Raw,
  };

  // A run without an angular distribution is a failure, not an empty result
  const error = stopLine
    ? `FRESCO stopped: ${stopLine.trim()}`
    : angularDistribution.length === 0
      ? `FRESCO produced no cross sections (exit code ${code}). ${stderr.trim().split('\n')[0] || ''}`.trim()
      : undefined;

  return {
    success: !error,
    engineUsed: engine,
    exitCode: code,
    output,
    stdout,
    stderr,
    fort16Raw,
    frescoOutRaw,
    fort57Raw,
    error,
  };
}

export function failedFortranRun(engine: FortranEngineLabel, message: string, executionTimeMs: number, stdout = ''): FortranRunResult {
  return {
    success: false,
    engineUsed: engine,
    exitCode: -1,
    output: {
      angularDistribution: [],
      potentials: [],
      wavefunctions: [],
      sMatrix: [],
      summary: {
        totalReactionCrossSection: 0,
        totalElasticCrossSection: 0,
        rutherfordRadius: 0,
        grazingL: 0,
        quarterPointAngle: 0,
        executionTimeMs,
      },
      logs: [`[Error] ${message}`],
      frescoOut: '',
      fort16: '',
    },
    stdout,
    stderr: message,
    fort16Raw: '',
    frescoOutRaw: '',
    error: message,
  };
}
