import React, { useState } from 'react';
import { SimulationOutput, ExperimentalDataSet } from '../types/fresco';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ScatterChart,
  Scatter,
} from 'recharts';
import {
  LineChart as ChartIcon,
  BarChart2,
  Activity,
  Layers,
  Upload,
  Download,
  Info,
  Maximize2,
} from 'lucide-react';

interface XfrescoPlotterProps {
  output: SimulationOutput | null;
  onExportData: () => void;
}

export const XfrescoPlotter: React.FC<XfrescoPlotterProps> = ({ output, onExportData }) => {
  const [plotMode, setPlotMode] = useState<'crossSection' | 'rutherford' | 'potentials' | 'wavefunctions' | 'smatrix'>('crossSection');
  const [isLogScale, setIsLogScale] = useState<boolean>(true);
  const [expData, setExpData] = useState<ExperimentalDataSet | null>(null);

  if (!output) {
    return (
      <div className="max-w-7xl mx-auto p-8 text-center text-slate-400">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 max-w-lg mx-auto space-y-4 shadow-xl">
          <ChartIcon className="w-12 h-12 text-cyan-400 mx-auto animate-bounce" />
          <h3 className="text-lg font-bold text-white">No Simulation Results Yet</h3>
          <p className="text-xs text-slate-400">
            Run a FRESCO calculation or select a benchmark reaction from the top menu to view graphics and plots.
          </p>
        </div>
      </div>
    );
  }

  const { angularDistribution, potentials, wavefunctions, sMatrix, summary } = output;

  // Experimental Data Upload Handler
  const handleExpUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        if (text) {
          const lines = text.split('\n');
          const pts: { angleCm: number; sigmaMb: number }[] = [];
          for (const line of lines) {
            const parts = line.trim().split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
            if (parts.length >= 2) {
              pts.push({ angleCm: parts[0], sigmaMb: parts[1] });
            }
          }
          if (pts.length > 0) {
            setExpData({
              id: `exp_${Date.now()}`,
              name: file.name,
              reference: 'Uploaded Experimental Dataset',
              points: pts,
            });
          }
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 text-slate-100">
      {/* Bento Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow-md border-l-2 border-l-cyan-400">
          <span className="text-slate-400 font-bold block mb-1 text-[10px] uppercase tracking-wider">
            Total Reaction σ_R
          </span>
          <span className="text-2xl font-bold text-white">
            {summary.totalReactionCrossSection.toFixed(1)}{' '}
            <span className="text-xs text-cyan-400 font-normal">mb</span>
          </span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow-md border-l-2 border-l-blue-400">
          <span className="text-slate-400 font-bold block mb-1 text-[10px] uppercase tracking-wider">
            Grazing L_grazing
          </span>
          <span className="text-2xl font-bold text-white">
            {summary.grazingL.toFixed(1)}
          </span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow-md border-l-2 border-l-amber-400">
          <span className="text-slate-400 font-bold block mb-1 text-[10px] uppercase tracking-wider">
            Quarter-Point Angle θ_1/4
          </span>
          <span className="text-2xl font-bold text-white">
            {summary.quarterPointAngle.toFixed(1)}°
          </span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow-md border-l-2 border-l-emerald-400">
          <span className="text-slate-400 font-bold block mb-1 text-[10px] uppercase tracking-wider">
            Execution Runtime
          </span>
          <span className="text-2xl font-bold text-white">
            {summary.executionTimeMs.toFixed(0)}{' '}
            <span className="text-xs text-emerald-400 font-normal">ms</span>
          </span>
        </div>
      </div>

      {/* Main Plot Bento Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        {/* Plot Selector Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-200">
              xfresco Visualization: Cross Section vs Theta
            </h2>
            <div className="flex gap-2 items-center text-[10px] font-mono text-slate-400 ml-3">
              <div className="w-2.5 h-2.5 bg-cyan-400 rounded-sm"></div>
              <span>Calc. Cross Section</span>
              <div className="w-2.5 h-2.5 bg-red-500 rounded-sm ml-1"></div>
              <span>Rutherford</span>
            </div>
          </div>

          {/* Controls & Plot Mode Selector */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setPlotMode('crossSection')}
                className={`px-2.5 py-1 rounded text-xs transition cursor-pointer font-medium ${
                  plotMode === 'crossSection'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                id="plot-crosssection-btn"
              >
                dσ/dΩ
              </button>
              <button
                onClick={() => setPlotMode('rutherford')}
                className={`px-2.5 py-1 rounded text-xs transition cursor-pointer font-medium ${
                  plotMode === 'rutherford'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                id="plot-rutherford-btn"
              >
                σ/σ_R
              </button>
              <button
                onClick={() => setPlotMode('potentials')}
                className={`px-2.5 py-1 rounded text-xs transition cursor-pointer font-medium ${
                  plotMode === 'potentials'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                id="plot-potentials-btn"
              >
                Potentials
              </button>
              <button
                onClick={() => setPlotMode('wavefunctions')}
                className={`px-2.5 py-1 rounded text-xs transition cursor-pointer font-medium ${
                  plotMode === 'wavefunctions'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                id="plot-wavefunctions-btn"
              >
                Wavefunctions
              </button>
              <button
                onClick={() => setPlotMode('smatrix')}
                className={`px-2.5 py-1 rounded text-xs transition cursor-pointer font-medium ${
                  plotMode === 'smatrix'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                id="plot-smatrix-btn"
              >
                S-Matrix
              </button>
            </div>

            {(plotMode === 'crossSection' || plotMode === 'rutherford') && (
              <button
                onClick={() => setIsLogScale(!isLogScale)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono px-2.5 py-1 rounded-lg border border-slate-700 cursor-pointer transition"
                id="toggle-log-scale-btn"
              >
                Scale: {isLogScale ? 'LOG' : 'LIN'}
              </button>
            )}

            <button
              onClick={onExportData}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono px-2.5 py-1 rounded-lg border border-slate-700 flex items-center gap-1 cursor-pointer transition"
              id="export-data-btn"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* 1. Differential Cross Section Plot */}
        {plotMode === 'crossSection' && (
          <div className="h-96 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={angularDistribution} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="angleCm" stroke="#94a3b8" label={{ value: 'Center-of-Mass Angle θ_c.m. (deg)', position: 'insideBottom', offset: -10, fill: '#94a3b8' }} />
                <YAxis
                  scale={isLogScale ? 'log' : 'auto'}
                  domain={isLogScale ? ['auto', 'auto'] : [0, 'auto']}
                  stroke="#94a3b8"
                  label={{ value: 'dσ/dΩ (mb/sr)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                  formatter={(val: any) => [typeof val === 'number' ? val.toFixed(3) : val, '']}
                />
                <Legend verticalAlign="top" height={36} />
                <Line type="monotone" dataKey="sigmaMb" name="FRESCO Calculation dσ/dΩ" stroke="#38bdf8" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="sigmaRutherford" name="Rutherford Pure Coulomb" stroke="#f43f5e" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 2. Rutherford Ratio Plot */}
        {plotMode === 'rutherford' && (
          <div className="h-96 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={angularDistribution} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="angleCm" stroke="#94a3b8" label={{ value: 'Center-of-Mass Angle θ_c.m. (deg)', position: 'insideBottom', offset: -10, fill: '#94a3b8' }} />
                <YAxis
                  scale={isLogScale ? 'log' : 'auto'}
                  domain={isLogScale ? [0.001, 2] : [0, 1.5]}
                  stroke="#94a3b8"
                  label={{ value: 'Rutherford Ratio σ/σ_R', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                <Legend verticalAlign="top" height={36} />
                <Line type="monotone" dataKey="ratioRutherford" name="FRESCO Ratio σ/σ_R" stroke="#22d3ee" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 3. Potentials Plot */}
        {plotMode === 'potentials' && (
          <div className="h-96 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={potentials} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="r" stroke="#94a3b8" label={{ value: 'Radius r (fm)', position: 'insideBottom', offset: -10, fill: '#94a3b8' }} />
                <YAxis stroke="#94a3b8" label={{ value: 'Potential Energy V(r) (MeV)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                <Legend verticalAlign="top" height={36} />
                <Line type="monotone" dataKey="vReal" name="Real Volume V_real(r)" stroke="#38bdf8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="wVol" name="Imaginary Volume W_vol(r)" stroke="#a855f7" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="wSurf" name="Imaginary Surface W_surf(r)" stroke="#ec4899" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="vCoulomb" name="Coulomb V_coulomb(r)" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 4. S-Matrix Transmission & Phase Shifts */}
        {plotMode === 'smatrix' && (
          <div className="h-96 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sMatrix} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="l" stroke="#94a3b8" label={{ value: 'Partial Wave Angular Momentum L', position: 'insideBottom', offset: -10, fill: '#94a3b8' }} />
                <YAxis yAxisId="left" stroke="#38bdf8" label={{ value: 'Transmission |S_L|', angle: -90, position: 'insideLeft', fill: '#38bdf8' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#f43f5e" label={{ value: 'Phase Shift δ_L (deg)', angle: 90, position: 'insideRight', fill: '#f43f5e' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                <Legend verticalAlign="top" height={36} />
                <Line yAxisId="left" type="monotone" dataKey="eta" name="Transmission Coefficient |S_L|" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line yAxisId="right" type="monotone" dataKey="phaseShiftDeg" name="Phase Shift δ_L (deg)" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 5. Wavefunctions */}
        {plotMode === 'wavefunctions' && wavefunctions.length > 0 && (
          <div className="h-96 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={wavefunctions[0].points} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="r" stroke="#94a3b8" label={{ value: 'Radius r (fm)', position: 'insideBottom', offset: -10, fill: '#94a3b8' }} />
                <YAxis stroke="#94a3b8" label={{ value: '|u_L(r)|^2 Probability Density', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                <Legend verticalAlign="top" height={36} />
                <Line type="monotone" dataKey="probDensity" name="L=0 Probability Density |u(r)|^2" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
