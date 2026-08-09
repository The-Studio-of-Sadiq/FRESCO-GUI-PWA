import React, { useState } from 'react';
import { BookOpen, Code, Terminal, FileText, CheckCircle2, Copy, ExternalLink, HelpCircle } from 'lucide-react';

export const FrescoFortranManual: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'cards' | 'namelists' | 'files' | 'fortran'>('cards');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const sampleNamelist = `&FRESCO
  title = '16O + 208Pb Elastic Scattering at 80 MeV'
  hcm = 0.05, rmatch = 20.0, rmax = 35.0, lmax = 50
  thmin = 0.0, thmax = 180.0, thinc = 1.0, elab = 80.0
  npart = 1, nstates = 1, npot = 1
/
&PARTITION namep='16O', massp=16.0, zp=8, namet='208Pb', masst=208.0, zt=82, qval=0.0 /
&STATES ep=0.0, jp=0.0, jt=0.0, pots=1 /
&POT type=1, v0=50.0, r0=1.24, a0=0.63, w0=10.0, rw=1.24, aw=0.63, rc=1.24 /
&END`;

  const sampleCardFormat = `'16O + 208Pb Elastic Scattering at 80 MeV'
   0.050   20.00   35.00     50      0      0
   0.000  180.00    1.00   80.000
1  1  1
 '16O'  16.0  8  0.0  1  '208Pb'  208.0  82  0.0  1  0.0
 1  0.0  0.0  0.0  1  0
1
1  1  50.000  1.240  0.630  10.000  1.240  0.630  1.240
0`;

  return (
    <div className="max-w-7xl mx-auto space-y-4 text-slate-100 font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Ian Thompson FRESCO Fortran Specification & Manual
                <span className="text-[10px] bg-slate-800 text-cyan-300 font-mono px-2 py-0.5 rounded border border-slate-700">
                  I-Thompson/fresco
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Official FRESCO Coupled-Channels Fortran 90 input formats, cards 1–15, namelists, and output streams.
              </p>
            </div>
          </div>

          <a
            href="https://github.com/I-Thompson/fresco"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-xs px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1.5 shrink-0 transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>I-Thompson/fresco GitHub</span>
          </a>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-slate-800 pb-2 text-xs font-mono">
          <button
            onClick={() => setActiveTab('cards')}
            className={`px-3 py-1.5 rounded-lg border transition cursor-pointer ${
              activeTab === 'cards'
                ? 'bg-slate-800 border-cyan-500/50 text-cyan-400 font-bold'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            🎴 Card-Image Inputs (Card 1..15)
          </button>

          <button
            onClick={() => setActiveTab('namelists')}
            className={`px-3 py-1.5 rounded-lg border transition cursor-pointer ${
              activeTab === 'namelists'
                ? 'bg-slate-800 border-cyan-500/50 text-cyan-400 font-bold'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            📋 Fortran 90 NAMELISTS
          </button>

          <button
            onClick={() => setActiveTab('files')}
            className={`px-3 py-1.5 rounded-lg border transition cursor-pointer ${
              activeTab === 'files'
                ? 'bg-slate-800 border-cyan-500/50 text-cyan-400 font-bold'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            📁 Output Streams (fort.16..fort.20)
          </button>

          <button
            onClick={() => setActiveTab('fortran')}
            className={`px-3 py-1.5 rounded-lg border transition cursor-pointer ${
              activeTab === 'fortran'
                ? 'bg-slate-800 border-cyan-500/50 text-cyan-400 font-bold'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            ⚙️ Fortran Core Architecture
          </button>
        </div>

        {/* Tab 1: Cards */}
        {activeTab === 'cards' && (
          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-300 font-mono text-xs">
                Card-Image Format Specification (fresco.in)
              </span>
              <button
                onClick={() => copyToClipboard(sampleCardFormat, 'cards')}
                className="text-slate-400 hover:text-white flex items-center gap-1 font-mono text-[11px]"
              >
                {copiedCode === 'cards' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                Copy Sample
              </button>
            </div>

            <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-cyan-300 leading-relaxed overflow-x-auto">
              {sampleCardFormat}
            </pre>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="font-bold text-amber-400 block">CARD 1: Title Card</span>
                <p className="text-slate-400">80-column text string in single quotes describing calculation.</p>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="font-bold text-amber-400 block">CARD 2: Grid & Angular Momentum</span>
                <p className="text-slate-400">HCM (dr), RMATCH, RMAX, LMAX, ITYP, IBLOCK.</p>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="font-bold text-amber-400 block">CARD 2b: Angular & Energy Limits</span>
                <p className="text-slate-400">THMIN, THMAX, THINC, ELAB (Lab beam energy MeV).</p>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="font-bold text-amber-400 block">CARD 3: Partitions</span>
                <p className="text-slate-400">NPART, NAMEP, MASSP, ZP, NAMET, MASST, ZT, QVAL.</p>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="font-bold text-amber-400 block">CARD 4: States</span>
                <p className="text-slate-400">NSTATES, EP, JP, JT, POTS (Potential assignments).</p>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="font-bold text-amber-400 block">CARD 5: Optical Potentials</span>
                <p className="text-slate-400">NPOT, TYPE, V0, r0, a0, W0, rw, aw, Wd, rd, ad, Vso, rso, aso, rc.</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Namelists */}
        {activeTab === 'namelists' && (
          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-300 font-mono text-xs">
                Fortran 90 Standard NAMELIST Specification (&FRESCO, &PARTITION, &POT)
              </span>
              <button
                onClick={() => copyToClipboard(sampleNamelist, 'namelist')}
                className="text-slate-400 hover:text-white flex items-center gap-1 font-mono text-[11px]"
              >
                {copiedCode === 'namelist' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                Copy Namelist
              </button>
            </div>

            <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-cyan-300 leading-relaxed overflow-x-auto">
              {sampleNamelist}
            </pre>
          </div>
        )}

        {/* Tab 3: Output Streams */}
        {activeTab === 'files' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
              <span className="font-bold text-cyan-400 text-sm flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-cyan-400" /> fort.16
              </span>
              <p className="text-slate-300 text-[11px]">
                Differential angular distribution σ(θ) in mb/sr, Rutherford cross section σ_R, and ratio σ/σ_R.
              </p>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
              <span className="font-bold text-cyan-400 text-sm flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-cyan-400" /> fort.17
              </span>
              <p className="text-slate-300 text-[11px]">
                Radial wavefunctions u_L(r) extracted from Numerov integration for each partial wave L.
              </p>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
              <span className="font-bold text-cyan-400 text-sm flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-cyan-400" /> fort.18
              </span>
              <p className="text-slate-300 text-[11px]">
                Scattering matrix S_L, transmission coefficients η_L, and nuclear phase shifts δ_L.
              </p>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
              <span className="font-bold text-cyan-400 text-sm flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-cyan-400" /> fort.20 (sfresco)
              </span>
              <p className="text-slate-300 text-[11px]">
                Chi-square minimization search output and parameter optimization log for optical models.
              </p>
            </div>
          </div>
        )}

        {/* Tab 4: Fortran Core */}
        {activeTab === 'fortran' && (
          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono space-y-2 text-slate-300">
            <span className="font-bold text-cyan-400 text-sm block">
              Ian Thompson FRESCO Fortran Source Structure
            </span>
            <p className="leading-relaxed">
              Main driver executable: <code className="text-amber-400">fresco.f90</code> / <code className="text-amber-400">sfresco.f90</code>
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 pt-1">
              <li><code className="text-cyan-300">frxx.f90</code>: Core coupled-channels radial wave matrixsolver (R-matrix & Numerov).</li>
              <li><code className="text-cyan-300">potentials.f90</code>: Woods-Saxon, Gaussian, Yukawa, and folding potential routines.</li>
              <li><code className="text-cyan-300">couplings.f90</code>: Electromagnetic multipole & transfer DWBA interaction matrix.</li>
              <li><code className="text-cyan-300">coulomb.f90</code>: Special functions for regular/irregular Coulomb functions F_L, G_L.</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
