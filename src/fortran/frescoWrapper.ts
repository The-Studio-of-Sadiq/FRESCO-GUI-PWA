import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { FRESCODeckConfig, SimulationOutput, AngularDataPoint, SMatrixElement, SimulationSummary } from '../types/fresco';
import { generateFrescoDeck, parseFort16Output, parseFrescoOutCrossSections } from '../physics/frescoParser';

const execAsync = promisify(exec);

export interface FortranEngineStatus {
  hasGfortran: boolean;
  hasSources: boolean;
  hasFrescoBinary: boolean;
  hasSfrescoBinary: boolean;
  sourceFilesCount: number;
  binaryPath?: string;
  sfrescoBinaryPath?: string;
  compilerInfo?: string;
}

export interface FortranRunOptions {
  workingDir?: string;
  timeoutMs?: number;
}

export interface FortranRunResult {
  success: boolean;
  engineUsed: 'Native Fortran (gfortran)' | 'TypeScript High-Speed Physics Engine';
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

const SOURCE_DIR = path.join(process.cwd(), 'src', 'source');
const FRESCO_BIN = path.join(SOURCE_DIR, 'fresco');
const SFRESCO_BIN = path.join(SOURCE_DIR, 'sfresco');

/**
  * Checks system status for Fortran compiler and compiled binaries.
  */
export async function getFortranEngineStatus(): Promise<FortranEngineStatus> {
  let hasGfortran = false;
  let compilerInfo = '';

  try {
    const { stdout } = await execAsync('gfortran --version');
    hasGfortran = true;
    compilerInfo = stdout.split('\n')[0] || 'GNU Fortran';
  } catch {
    hasGfortran = false;
  }

  const hasSources = fs.existsSync(SOURCE_DIR);
  let sourceFilesCount = 0;
  if (hasSources) {
    const files = fs.readdirSync(SOURCE_DIR);
    sourceFilesCount = files.filter(f => f.endsWith('.f') || f.endsWith('.f90') || f.endsWith('.f77')).length;
  }

  const hasFrescoBinary = fs.existsSync(FRESCO_BIN);
  const hasSfrescoBinary = fs.existsSync(SFRESCO_BIN);

  return {
    hasGfortran,
    hasSources,
    hasFrescoBinary,
    hasSfrescoBinary,
    sourceFilesCount,
    binaryPath: hasFrescoBinary ? FRESCO_BIN : undefined,
    sfrescoBinaryPath: hasSfrescoBinary ? SFRESCO_BIN : undefined,
    compilerInfo,
  };
}

/**
  * Compiles original Fortran source files in `src/source/` using `gfortran`.
  * STRICT RULE: Does NOT touch or alter original source files!
  */
export async function compileFortranSources(): Promise<{ success: boolean; log: string }> {
  const status = await getFortranEngineStatus();
  if (!status.hasGfortran) {
    return { success: false, log: 'gfortran compiler is not installed on the server host.' };
  }
  if (!status.hasSources) {
    return { success: false, log: `Fortran source directory not found at ${SOURCE_DIR}` };
  }

  const compileCmd = `gfortran -O3 -std=legacy -w -o ${FRESCO_BIN} ` +
    `globx7.f frxx0.f frxx1.f frxx2.f frxx3.f frxx4.f frxx5.f frxx6.f frxx7a.f frxx7b.f frxx8.f coulfg.f ` +
    `frxx9.f frxx10.f frxx11.f frxx13.f frxx16.f frxx17.f lapack.f cdc.f cpu_time.f fresco.f nagstub.f`;

  const sfrescoCompileCmd = `gfortran -O3 -std=legacy -w -o ${SFRESCO_BIN} ` +
    `globx7.f frxx0.f frxx1.f frxx2.f frxx3.f frxx4.f frxx5.f frxx6.f frxx7a.f frxx7b.f frxx8.f coulfg.f ` +
    `frxx9.f frxx10.f frxx11.f frxx13.f frxx16.f frxx17.f lapack.f cdc.f cpu_time.f sfresco.f nagstub.f minuit.f`;

  let logs: string[] = [];
  logs.push(`[Fortran Compiler] Compiling FRESCO engine from ${status.sourceFilesCount} Fortran files...`);

  try {
    const res1 = await execAsync(compileCmd, { cwd: SOURCE_DIR });
    if (res1.stderr) logs.push(res1.stderr);
    logs.push(`[Fortran Compiler] Successfully built 'fresco' binary.`);

    const res2 = await execAsync(sfrescoCompileCmd, { cwd: SOURCE_DIR });
    if (res2.stderr) logs.push(res2.stderr);
    logs.push(`[Fortran Compiler] Successfully built 'sfresco' binary.`);

    return { success: true, log: logs.join('\n') };
  } catch (err: any) {
    logs.push(`[Fortran Compiler Error] ${err.message || err}`);
    return { success: false, log: logs.join('\n') };
  }
}

/**
  * Executes full Fortran FRESCO simulation deck using compiled native executable.
  */
export async function runFortranFresco(
  deckContentOrConfig: string | FRESCODeckConfig,
  options: FortranRunOptions = {}
): Promise<FortranRunResult> {
  const startTime = performance.now();
  let status = await getFortranEngineStatus();

  // Auto-compile if binary missing but gfortran + sources present
  if (!status.hasFrescoBinary && status.hasGfortran && status.hasSources) {
    console.log('FRESCO binary missing. Triggering Fortran source compilation...');
    await compileFortranSources();
    status = await getFortranEngineStatus();
  }

  if (!status.hasFrescoBinary) {
    throw new Error('Native Fortran FRESCO executable is unavailable.');
  }

  const deckText = typeof deckContentOrConfig === 'string'
    ? deckContentOrConfig
    : generateFrescoDeck(deckContentOrConfig);

  // Create isolated execution directory to prevent race conditions
  const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const runDir = path.join(process.cwd(), 'dist', 'runs', runId);
  fs.mkdirSync(runDir, { recursive: true });

  const inputPath = path.join(runDir, 'fresco.in');
  fs.writeFileSync(inputPath, deckText, 'utf-8');

  return new Promise((resolve) => {
    const timeoutMs = options.timeoutMs || 15000;
    let stdoutData = '';
    let stderrData = '';

    const child = spawn(FRESCO_BIN, [], {
      cwd: runDir,
      env: { ...process.env },
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      stderrData += '\nExecution timed out after 15 seconds.';
    }, timeoutMs);

    // Pass input deck via stdin
    child.stdin.write(deckText);
    child.stdin.end();

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const executionTimeMs = performance.now() - startTime;

      // Read output files produced by Fortran FRESCO
      const fort16Path = path.join(runDir, 'fort.16');
      const fort16Raw = fs.existsSync(fort16Path) ? fs.readFileSync(fort16Path, 'utf-8') : '';

      const fort57Path = path.join(runDir, 'fort.57');
      const fort57Raw = fs.existsSync(fort57Path) ? fs.readFileSync(fort57Path, 'utf-8') : '';

      const frescoOutPath = path.join(runDir, 'fresco.out');
      const frescoOutRaw = fs.existsSync(frescoOutPath)
        ? fs.readFileSync(frescoOutPath, 'utf-8')
        : stdoutData;

      // Parse fort.16 angular distribution data
      let angularDistribution: AngularDataPoint[] = [];
      if (fort16Raw) {
        angularDistribution = parseFort16Output(fort16Raw);
      }
      if (angularDistribution.length === 0 && frescoOutRaw) {
        angularDistribution = parseFrescoOutCrossSections(frescoOutRaw);
      }

      // Cleanup run directory
      try {
        fs.rmSync(runDir, { recursive: true, force: true });
      } catch {
        // ignore
      }

      const summary: SimulationSummary = {
        totalReactionCrossSection: 0,
        totalElasticCrossSection: 0,
        rutherfordRadius: 1.25,
        grazingL: 0,
        quarterPointAngle: 0,
        executionTimeMs,
        engineUsed: 'Native Fortran (gfortran)',
        exitCode: code,
      };

      // Extract cross sections from fresco.out if available
      if (frescoOutRaw) {
        const reactMatch = frescoOutRaw.match(/TOTAL REACTION CROSS SECTION\s*=\s*([\d\.\+E\-]+)/i);
        if (reactMatch) summary.totalReactionCrossSection = parseFloat(reactMatch[1]);

        const elastMatch = frescoOutRaw.match(/TOTAL ELASTIC CROSS SECTION\s*=\s*([\d\.\+E\-]+)/i);
        if (elastMatch) summary.totalElasticCrossSection = parseFloat(elastMatch[1]);
      }

      const output: SimulationOutput = {
        angularDistribution,
        potentials: [],
        wavefunctions: [],
        sMatrix: [],
        summary,
        logs: [
          `[Native Fortran Wrapper] Executed ${FRESCO_BIN}`,
          `[Native Fortran Wrapper] Exit Code: ${code}`,
          `[Native Fortran Wrapper] Execution Time: ${executionTimeMs.toFixed(1)} ms`,
          `[Fortran stdout] Captured ${stdoutData.length} bytes`,
        ],
        frescoOut: frescoOutRaw,
        fort16: fort16Raw,
      };

      resolve({
        success: code === 0 || angularDistribution.length > 0,
        engineUsed: 'Native Fortran (gfortran)',
        exitCode: code,
        output,
        stdout: stdoutData,
        stderr: stderrData,
        fort16Raw,
        frescoOutRaw,
        fort57Raw,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        success: false,
        engineUsed: 'Native Fortran (gfortran)',
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
            executionTimeMs: performance.now() - startTime,
          },
          logs: [`[Error] ${err.message}`],
          frescoOut: '',
          fort16: '',
        },
        stdout: stdoutData,
        stderr: err.message,
        fort16Raw: '',
        frescoOutRaw: '',
        error: err.message,
      });
    });
  });
}
