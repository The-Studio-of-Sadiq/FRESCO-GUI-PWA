import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { FRESCODeckConfig } from '../types/fresco';
import { generateFrescoDeck } from '../physics/frescoParser';
import { buildFortranRunResult, failedFortranRun, FortranRunResult, FRESCO_OUTPUT_FILES, projectileSpinOf } from './frescoResult';

export type { FortranRunResult } from './frescoResult';

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

const SOURCE_DIR = path.join(process.cwd(), 'src', 'source');
// gfortran on Windows (MinGW) appends .exe to the output name
const EXE_SUFFIX = process.platform === 'win32' ? '.exe' : '';
const FRESCO_BIN = path.join(SOURCE_DIR, `fresco${EXE_SUFFIX}`);
const SFRESCO_BIN = path.join(SOURCE_DIR, `sfresco${EXE_SUFFIX}`);

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

  const compileCmd = `gfortran -O3 -std=legacy -w -o "${FRESCO_BIN}" ` +
    `globx7.f frxx0.f frxx1.f frxx2.f frxx3.f frxx4.f frxx5.f frxx6.f frxx7a.f frxx7b.f frxx8.f coulfg.f ` +
    `frxx9.f frxx10.f frxx11.f frxx13.f frxx16.f frxx17.f lapack.f cdc.f cpu_time.f fresco.f nagstub.f`;

  const sfrescoCompileCmd = `gfortran -O3 -std=legacy -w -o "${SFRESCO_BIN}" ` +
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
  const projectileSpin = projectileSpinOf(deckContentOrConfig);

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

      // Read output files produced by Fortran FRESCO
      const files: Record<string, string> = {};
      for (const name of FRESCO_OUTPUT_FILES) {
        const filePath = path.join(runDir, name);
        if (fs.existsSync(filePath)) files[name] = fs.readFileSync(filePath, 'utf-8');
      }

      // Cleanup run directory
      try {
        fs.rmSync(runDir, { recursive: true, force: true });
      } catch {
        // ignore
      }

      resolve(buildFortranRunResult({
        engine: 'Native Fortran (gfortran)',
        executable: FRESCO_BIN,
        exitCode: code,
        stdout: stdoutData,
        stderr: stderrData,
        files,
        executionTimeMs: performance.now() - startTime,
        projectileSpin,
      }));
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve(failedFortranRun('Native Fortran (gfortran)', err.message, performance.now() - startTime, stdoutData));
    });
  });
}
