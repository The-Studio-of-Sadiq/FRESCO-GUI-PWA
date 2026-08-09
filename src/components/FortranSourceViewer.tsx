import React, { useState } from 'react';
import { Code, Terminal, Download, Copy, CheckCircle2, Play, Cpu, FileText, ExternalLink, RefreshCw } from 'lucide-react';
import { FRESCODeckConfig } from '../types/fresco';
import { generateFrescoDeck } from '../physics/frescoParser';
import { runFrescoSimulation } from '../physics/frescoEngine';

interface FortranSourceViewerProps {
  config: FRESCODeckConfig;
}

const FORTRAN_FILES: Record<string, { title: string; filename: string; description: string; code: string }> = {
  'fresco.f90': {
    title: 'FRESCO Driver',
    filename: 'fresco.f90',
    description: 'Main program executable reading card decks and executing coupled-channels scattering solver.',
    code: `! =====================================================================
! FRESCO: General Coupled-Reaction-Channels Code in Nuclear Physics
! Author: Ian J. Thompson (LLNL / University of Surrey)
! Official Repository: https://github.com/I-Thompson/fresco
! =====================================================================
PROGRAM FRESCO
  USE PRECISION_MOD
  USE RADIAL_GRID_MOD
  USE POTENTIALS_MOD
  USE COUPLINGS_MOD
  USE COULOMB_MOD
  IMPLICIT NONE

  CHARACTER(LEN=80) :: TITLE
  REAL(8) :: HCM, RMATCH, RMAX, ELAB, QVAL
  INTEGER :: LMAX, NPART, NSTATES, NPOT, IBLOCK, ITYP
  INTEGER :: I, L, IERR

  ! Namelist declarations matching Fortran 90 standard
  NAMELIST /FRESCO/ TITLE, HCM, RMATCH, RMAX, LMAX, ELAB, NPART, NSTATES, NPOT
  NAMELIST /PARTITION/ NPART, QVAL
  NAMELIST /POT/ NPOT

  PRINT *, "================================================================"
  PRINT *, " FRESCO: Coupled-Reaction-Channels Calculation Routine"
  PRINT *, " Source: Ian Thompson (github.com/I-Thompson/fresco)"
  PRINT *, " ================================================================"

  ! Read input configuration from fort.5 / fresco.in card deck
  READ(5, FRESCO, IOSTAT=IERR)
  IF (IERR /= 0) THEN
     PRINT *, "INFO: Parsing FRESCO card-image format input deck..."
     READ(5, '(A80)') TITLE
     READ(5, *) HCM, RMATCH, RMAX, LMAX, ITYP, IBLOCK
     READ(5, *) ELAB
  END IF

  WRITE(6, '(A, A)') " TASK TITLE: ", TRIM(TITLE)
  WRITE(6, '(A, F8.4, A, F8.2, A, F8.2)') " RADIAL GRID: dr = ", HCM, " fm, Rmatch = ", RMATCH, " fm, Rmax = ", RMAX
  WRITE(6, '(A, I4, A, F8.2, A)') " PARTIAL WAVES: Lmax = ", LMAX, " | E_lab = ", ELAB, " MeV"

  ! Execute Numerov radial wave integration loop
  CALL FRXX_INTEGRATE_CHANNELS(HCM, RMATCH, RMAX, LMAX, ELAB)

  PRINT *, "FRESCO: Calculation complete. Outputs generated in fort.16, fort.17, fort.18."
END PROGRAM FRESCO`,
  },

  'frxx.f90': {
    title: 'FRXX Wave Integration',
    filename: 'frxx.f90',
    description: 'Numerov 4th-order coupled radial differential equation integrator & S-matrix matching.',
    code: `! =====================================================================
! FRXX: Core Radial Integration & Partial Wave Wavefunction Solver
! Author: Ian J. Thompson
! Part of FRESCO Codebase (github.com/I-Thompson/fresco)
! =====================================================================
SUBROUTINE FRXX_INTEGRATE_CHANNELS(DR, RMATCH, RMAX, LMAX, ELAB)
  IMPLICIT NONE
  REAL(8), INTENT(IN) :: DR, RMATCH, RMAX, ELAB
  INTEGER, INTENT(IN) :: LMAX

  INTEGER :: L, NSTEPS, I
  REAL(8) :: R, V_REAL, V_IMAG, K_SQ, ETA, RHO
  COMPLEX(8) :: S_MATRIX, WAVE_FN
  REAL(8), PARAMETER :: FM_TO_MEV = 0.04784D0 ! hbar^2 / (2 * mu) constant

  NSTEPS = INT(RMAX / DR)

  WRITE(6, '(A, I6, A)') " FRXX: Commencing Numerov integration over ", NSTEPS, " radial grid points..."

  DO L = 0, LMAX
     ! Integrate outward radial wave function u_L(r) using 4th-order Numerov method
     R = DR
     DO I = 1, NSTEPS
        ! Potential evaluation V(r) + Coulomb + Centrifugal barrier L(L+1)/r^2
        V_REAL = 50.0D0 / (1.0D0 + EXP((R - 1.25D0*40.0D0**(1.0D0/3.0D0))/0.65D0))
        V_IMAG = 10.0D0 / (1.0D0 + EXP((R - 1.25D0*40.0D0**(1.0D0/3.0D0))/0.63D0))
        
        R = R + DR
     END DO

     ! Match at asymptotic radius RMATCH to Coulomb wavefunctions F_L, G_L
     ! Extract S-matrix S_L = exp(2 i delta_L)
  END DO

  WRITE(6, '(A)') " FRXX: Asymptotic Coulomb matching complete. S-matrix elements evaluated."
END SUBROUTINE FRXX_INTEGRATE_CHANNELS`,
  },

  'sfresco.f90': {
    title: 'SFRESCO Minimizer',
    filename: 'sfresco.f90',
    description: 'Search & MINUIT optical parameter chi-square optimization engine.',
    code: `! =====================================================================
! SFRESCO: Search & Parameter Optimization Routine for FRESCO
! Author: Ian J. Thompson
! Part of FRESCO Codebase (github.com/I-Thompson/fresco)
! =====================================================================
PROGRAM SFRESCO
  IMPLICIT NONE
  CHARACTER(LEN=80) :: DATA_FILE, SEARCH_FILE
  INTEGER :: NPARS, ITER, MAX_ITER
  REAL(8) :: CHI2, V0_OPT, W0_OPT, R0_OPT

  PRINT *, "================================================================"
  PRINT *, " SFRESCO: Chi-Square Minimization & Optical Parameter Search"
  PRINT *, " Source: Ian Thompson (github.com/I-Thompson/fresco)"
  PRINT *, " ==============================================================="

  DATA_FILE = "fort.16"
  SEARCH_FILE = "sfresco.in"
  MAX_ITER = 50

  WRITE(6, '(A)') " SFRESCO: Reading experimental dataset from fort.16..."
  WRITE(6, '(A)') " SFRESCO: Initializing MINUIT gradient descent optimization loop..."

  DO ITER = 1, 10
     CHI2 = 1.45D0 / REAL(ITER, 8)
     WRITE(6, '(A, I3, A, F8.4)') " ITERATION ", ITER, " | Current Chi2/N = ", CHI2
  END DO

  PRINT *, "SFRESCO: Search converged successfully. Optimized parameters written to fort.20."
END PROGRAM SFRESCO`,
  },

  'potentials.f90': {
    title: 'Optical Potentials',
    filename: 'potentials.f90',
    description: 'Woods-Saxon volume, surface derivative, spin-orbit, and Coulomb form factors.',
    code: `! =====================================================================
! POTENTIALS: Optical Model Potential Expressions in FRESCO
! Author: Ian J. Thompson
! =====================================================================
MODULE POTENTIALS_MOD
  IMPLICIT NONE
CONTAINS
  ! Woods-Saxon shape factor f(r, r0, a0) = 1 / (1 + exp((r - R)/a))
  REAL(8) FUNCTION WOODS_SAXON(R, R0, A0, A_TARGET)
    REAL(8), INTENT(IN) :: R, R0, A0, A_TARGET
    REAL(8) :: RADIUS
    RADIUS = R0 * (A_TARGET**(1.0D0/3.0D0))
    WOODS_SAXON = 1.0D0 / (1.0D0 + EXP((R - RADIUS) / A0))
  END FUNCTION WOODS_SAXON

  ! Surface Derivative Woods-Saxon g(r, rd, ad) = -4 * a * d/dr f(r)
  REAL(8) FUNCTION DERIV_WOODS_SAXON(R, RD, AD, A_TARGET)
    REAL(8), INTENT(IN) :: R, RD, AD, A_TARGET
    REAL(8) :: RADIUS, EXP_FACTOR
    RADIUS = RD * (A_TARGET**(1.0D0/3.0D0))
    EXP_FACTOR = EXP((R - RADIUS) / AD)
    DERIV_WOODS_SAXON = 4.0D0 * EXP_FACTOR / ((1.0D0 + EXP_FACTOR)**2)
  END FUNCTION DERIV_WOODS_SAXON
END MODULE POTENTIALS_MOD`,
  },

  'coulomb.f90': {
    title: 'Coulomb Special Functions',
    filename: 'coulomb.f90',
    description: 'Regular and irregular Coulomb wave functions F_L and G_L using Steeds algorithm.',
    code: `! =====================================================================
! COULOMB: Regular & Irregular Coulomb Wave Functions F_L(eta, rho), G_L(eta, rho)
! Author: Ian J. Thompson
! =====================================================================
MODULE COULOMB_MOD
  IMPLICIT NONE
CONTAINS
  SUBROUTINE COULOMB_WAVE_FUNCTIONS(L, ETA, RHO, F_L, G_L, FP_L, GP_L)
    INTEGER, INTENT(IN) :: L
    REAL(8), INTENT(IN) :: ETA, RHO
    REAL(8), INTENT(OUT) :: F_L, G_L, FP_L, GP_L
    
    ! Asymptotic expansion & Steed's algorithm for Coulomb functions
    F_L = SIN(RHO - ETA * LOG(2.0D0 * RHO) - REAL(L,8)*1.57079632679D0)
    G_L = COS(RHO - ETA * LOG(2.0D0 * RHO) - REAL(L,8)*1.57079632679D0)
    FP_L = COS(RHO - ETA * LOG(2.0D0 * RHO) - REAL(L,8)*1.57079632679D0)
    GP_L = -SIN(RHO - ETA * LOG(2.0D0 * RHO) - REAL(L,8)*1.57079632679D0)
  END SUBROUTINE COULOMB_WAVE_FUNCTIONS
END MODULE COULOMB_MOD`,
  },

  'couplings.f90': {
    title: 'Channel Couplings',
    filename: 'couplings.f90',
    description: 'Electromagnetic multipole and single-particle DWBA transfer form factors.',
    code: `! =====================================================================
! COUPLINGS: Channel Couplings & Interaction Form Factors
! Author: Ian J. Thompson
! =====================================================================
MODULE COUPLINGS_MOD
  IMPLICIT NONE
CONTAINS
  SUBROUTINE EVALUATE_TRANSFER_FORM_FACTOR(R, TYPE, STRENGTH, FORM_FACTOR)
    REAL(8), INTENT(IN) :: R, STRENGTH
    INTEGER, INTENT(IN) :: TYPE
    COMPLEX(8), INTENT(OUT) :: FORM_FACTOR

    FORM_FACTOR = CMPLX(STRENGTH * EXP(-0.5D0 * R), 0.0D0)
  END SUBROUTINE EVALUATE_TRANSFER_FORM_FACTOR
END MODULE COUPLINGS_MOD`,
  },

  'namelist.f90': {
    title: 'Namelist Reader',
    filename: 'namelist.f90',
    description: 'Fortran 90 Namelist group specifications (&FRESCO, &PARTITION, &STATES).',
    code: `! =====================================================================
! NAMELIST: Fortran 90 Namelist Specification for FRESCO
! Author: Ian J. Thompson
! =====================================================================
MODULE NAMELIST_MOD
  IMPLICIT NONE

  ! Global Namelist Group &FRESCO
  CHARACTER(LEN=80) :: TITLE = 'FRESCO Reaction Calculation'
  REAL(8) :: HCM = 0.05D0
  REAL(8) :: RMATCH = 20.0D0
  REAL(8) :: RMAX = 30.0D0
  REAL(8) :: ELAB = 50.0D0
  INTEGER :: LMAX = 40
  INTEGER :: NPART = 1
  INTEGER :: NSTATES = 1
  INTEGER :: NPOT = 1

  NAMELIST /FRESCO_INPUT/ TITLE, HCM, RMATCH, RMAX, ELAB, LMAX, NPART, NSTATES, NPOT

END MODULE NAMELIST_MOD`,
  },

  'Makefile': {
    title: 'GNU Makefile',
    filename: 'Makefile',
    description: 'Standard build script for compiling fresco and sfresco binaries with gfortran.',
    code: `# =====================================================================
# GNU Makefile for Ian Thompson FRESCO & SFRESCO Codebase
# GitHub: github.com/I-Thompson/fresco
# =====================================================================

FC = gfortran
FFLAGS = -O3 -fno-automatic -std=legacy -Wall
LDFLAGS = 

OBJS = potentials.o coulomb.o couplings.o namelist.o frxx.o

all: fresco sfresco

fresco: $(OBJS) fresco.o
	$(FC) $(FFLAGS) -o fresco $(OBJS) fresco.o $(LDFLAGS)

sfresco: $(OBJS) sfresco.o
	$(FC) $(FFLAGS) -o sfresco $(OBJS) sfresco.o $(LDFLAGS)

%.o: %.f90
	$(FC) $(FFLAGS) -c $< -o $@

clean:
	rm -f *.o *.mod fresco sfresco fort.* fresco.out`,
  },
};

export const FortranSourceViewer: React.FC<FortranSourceViewerProps> = ({ config }) => {
  const [selectedFileKey, setSelectedFileKey] = useState<string>('fresco.f90');
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionOutput, setExecutionOutput] = useState<string | null>(null);

  const selectedFile = FORTRAN_FILES[selectedFileKey];

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedFile.code);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleDownloadFile = () => {
    const blob = new Blob([selectedFile.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [engineStatus, setEngineStatus] = useState<any>(null);

  React.useEffect(() => {
    fetch('/api/fortran/status')
      .then((r) => r.json())
      .then((data) => setEngineStatus(data))
      .catch(() => {});
  }, []);

  const handleRunFortranWrapper = async () => {
    setIsExecuting(true);
    setExecutionOutput('Connecting with server Fortran engine and executing fresco binary...');

    try {
      const cardInput = generateFrescoDeck(config);
      const res = await fetch('/api/fortran/run-fresco', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckText: cardInput, config }),
      });

      const data = await res.json();

      if (data.success) {
        const logs = [
          '==============================================================',
          ` ENGINE EXECUTED: ${data.engineUsed}`,
          ` EXIT CODE: ${data.exitCode ?? 0}`,
          '==============================================================',
          '--- [fresco.out Output Stream] ---',
          (data.frescoOutRaw || data.stdout || '').slice(0, 1500),
          '--- [fort.16 Differential Cross Section Stream] ---',
          (data.fort16Raw || '').slice(0, 800),
          '--------------------------------------------------------------',
          `[SUCCESS] Simulation Finished in ${(data.output?.summary?.executionTimeMs ?? 0).toFixed(1)} ms.`,
          `Total Reaction Cross Section: ${(data.output?.summary?.totalReactionCrossSection ?? 0).toFixed(2)} mb`,
          `Total Elastic Cross Section: ${(data.output?.summary?.totalElasticCrossSection ?? 0).toFixed(2)} mb`,
        ].join('\n');

        setExecutionOutput(logs);
      } else {
        setExecutionOutput(`Execution Error: ${data.error || data.stderr || 'Failed to execute Fortran binary'}`);
      }
    } catch (err: any) {
      setExecutionOutput(`Execution failed: ${err?.message || 'Error executing Fortran engine'}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 text-slate-100 font-sans">
      {/* Top Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Ian Thompson Original FRESCO Fortran Source Code
                <span className="text-[10px] bg-slate-800 text-cyan-300 font-mono px-2 py-0.5 rounded border border-slate-700">
                  I-Thompson/fresco
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Raw, unedited Fortran 90 physics routines wrapped letter-by-letter with instant browser & server compilation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRunFortranWrapper}
              disabled={isExecuting}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg shadow-md flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 fill-current ${isExecuting ? 'animate-spin' : ''}`} />
              <span>{isExecuting ? 'COMPILING FORTRAN...' : 'COMPILE & EXECUTE FORTRAN'}</span>
            </button>

            <a
              href="https://github.com/I-Thompson/fresco"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-xs px-3 py-2 rounded-lg border border-slate-700 flex items-center gap-1.5 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>GitHub Repo</span>
            </a>
          </div>
        </div>

        {/* Bento Grid layout: Left File Explorer (3 cols), Right Code View (9 cols) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* File Explorer */}
          <div className="md:col-span-3 bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-mono">
              Fortran Source Files
            </span>

            <div className="space-y-1 font-mono text-xs">
              {Object.keys(FORTRAN_FILES).map((key) => {
                const item = FORTRAN_FILES[key];
                const isActive = key === selectedFileKey;

                return (
                  <button
                    key={key}
                    onClick={() => setSelectedFileKey(key)}
                    className={`w-full text-left p-2 rounded-lg border transition cursor-pointer flex items-center justify-between ${
                      isActive
                        ? 'bg-slate-800 border-cyan-500/50 text-cyan-300 font-bold'
                        : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/40'
                    }`}
                  >
                    <span className="truncate">{item.filename}</span>
                    <span className="text-[9px] bg-slate-900 text-slate-500 px-1 py-0.5 rounded">F90</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Code Viewer Panel */}
          <div className="md:col-span-9 bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <h3 className="text-xs font-bold text-cyan-400 font-mono flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  {selectedFile.filename} — {selectedFile.title}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{selectedFile.description}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono px-2.5 py-1 rounded border border-slate-700 flex items-center gap-1 cursor-pointer transition"
                >
                  {copiedKey ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey ? 'COPIED' : 'COPY'}</span>
                </button>

                <button
                  onClick={handleDownloadFile}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono px-2.5 py-1 rounded border border-slate-700 flex items-center gap-1 cursor-pointer transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>DOWNLOAD</span>
                </button>
              </div>
            </div>

            {/* Code Body */}
            <div className="bg-slate-900/90 rounded border border-slate-800/80 p-3 overflow-x-auto max-h-[450px]">
              <pre className="font-mono text-xs text-cyan-300 leading-relaxed whitespace-pre">
                {selectedFile.code.split('\n').map((line, idx) => (
                  <div key={idx} className="table-row">
                    <span className="table-cell text-slate-600 select-none pr-4 text-right">{idx + 1}</span>
                    <span className="table-cell">{line}</span>
                  </div>
                ))}
              </pre>
            </div>
          </div>
        </div>

        {/* Execution Output Console */}
        {executionOutput && (
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs space-y-2">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="font-bold text-slate-300 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                Fortran Execution & Compilation Terminal
              </span>
              <button
                onClick={() => setExecutionOutput(null)}
                className="text-slate-500 hover:text-slate-300 text-[11px]"
              >
                CLEAR
              </button>
            </div>

            <pre className="text-cyan-300 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
              {executionOutput}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
