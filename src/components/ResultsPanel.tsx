import React, { useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, CheckCircle2, Download, Loader2, Upload, X } from 'lucide-react';
import { AngularChannel, ExperimentalDataSet, SimulationOutput } from '../types/fresco';
import { Button, Card, Segmented, SelectField } from './ui';

interface ResultsPanelProps {
  output: SimulationOutput | null;
  isRunning: boolean;
  /** Why the real FRESCO engine was not used for the current result, if it wasn't. */
  fallbackReason: string | null;
}

type View = 'xs' | 'ratio' | 'ay' | 'potentials' | 'smatrix' | 'wavefunctions';

const AXIS = '#94a3b8';
const GRID = '#1e293b';
const tooltipStyle = { backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', fontSize: 12 };
const fmt = (v: unknown) => (typeof v === 'number' ? (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-2 && v !== 0) ? v.toExponential(3) : v.toPrecision(4)) : String(v));
const tickFmt = (v: number) => (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-2 && v !== 0) ? v.toExponential(0).replace('e+', 'e') : String(Number(v.toPrecision(3))));

/** Powers of ten spanning the positive values, for log axes. */
function decadeTicks(values: (number | null | undefined)[]): number[] | undefined {
  const positive = values.filter((v): v is number => typeof v === 'number' && v > 0);
  if (positive.length === 0) return undefined;
  const lo = Math.floor(Math.log10(Math.min(...positive)));
  const hi = Math.ceil(Math.log10(Math.max(...positive)));
  const step = Math.max(1, Math.ceil((hi - lo) / 8));
  const ticks: number[] = [];
  for (let e = lo; e <= hi; e += step) ticks.push(Math.pow(10, e));
  return ticks;
}

/** Round-number angle ticks (every 5, 10, 20 or 30 degrees) covering [lo, hi]. */
function angleTicks(lo: number, hi: number): number[] {
  const span = hi - lo;
  const step = span > 120 ? 30 : span > 60 ? 20 : span > 25 ? 10 : 5;
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) ticks.push(t);
  return ticks;
}

function downloadCsv(channel: AngularChannel) {
  const csv = [
    'theta_cm_deg,sigma_mb_sr,sigma_rutherford_mb_sr,ratio_to_rutherford,Ay',
    ...channel.points.map((p) => `${p.angleCm},${p.sigmaMb},${p.sigmaRutherford},${p.ratioRutherford},${p.ay}`),
  ].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `fresco_${channel.label.replace(/[^\w.+-]+/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function engineInfo(engine?: string) {
  if (engine?.includes('WebAssembly')) return { label: 'FRESCO Fortran · in this browser', ok: true };
  if (engine?.includes('gfortran')) return { label: 'FRESCO Fortran · server', ok: true };
  return { label: 'Approximate model (not FRESCO)', ok: false };
}

function parseDataFile(name: string, text: string): ExperimentalDataSet | null {
  const points: ExperimentalDataSet['points'] = [];
  for (const line of text.split('\n')) {
    if (/^\s*[#!@&]/.test(line)) continue;
    const nums = line.trim().split(/[\s,;]+/).map(Number);
    if (nums.length >= 2 && nums.slice(0, 2).every((n) => !isNaN(n))) {
      points.push({ angleCm: nums[0], sigmaMb: nums[1], errorMb: nums.length >= 3 && !isNaN(nums[2]) ? nums[2] : undefined });
    }
  }
  return points.length ? { id: `exp_${Date.now()}`, name, reference: 'Uploaded data', points } : null;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({ output, isRunning, fallbackReason }) => {
  const [view, setView] = useState<View>('xs');
  const [channelIndex, setChannelIndex] = useState(0);
  const [logScale, setLogScale] = useState(true);
  const [expData, setExpData] = useState<ExperimentalDataSet | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // FRESCO runs list every outgoing channel; the approximate model has only the elastic one.
  const channels: AngularChannel[] = output?.channels?.length
    ? output.channels
    : [{ label: 'Elastic', points: output?.angularDistribution ?? [] }];
  const channel = channels[Math.min(channelIndex, channels.length - 1)];
  const charged = channel.points.some((p) => p.sigmaRutherford > 0);
  // Charged-particle cross sections diverge towards 0° (FRESCO prints 0° as 0.01°): start the plot at 1°.
  const ad = charged ? channel.points.filter((p) => p.angleCm >= 1) : channel.points;
  const hasAy = ad.some((p) => p.ay !== 0);

  const views = useMemo(() => {
    const v: { value: View; label: string }[] = [{ value: 'xs', label: 'dσ/dΩ' }];
    if (charged) v.push({ value: 'ratio', label: 'σ/σ_Ruth' });
    if (hasAy) v.push({ value: 'ay', label: 'Analysing power' });
    if (output?.potentials.length) v.push({ value: 'potentials', label: 'Potential' });
    if (output?.sMatrix.length) v.push({ value: 'smatrix', label: 'S-matrix' });
    if (output?.wavefunctions.length) v.push({ value: 'wavefunctions', label: 'Wavefunction' });
    return v;
  }, [charged, hasAy, output]);
  const activeView = views.some((v) => v.value === view) ? view : 'xs';

  // Rutherford is 0 for neutral projectiles; leave it out rather than plot zeros on a log axis.
  const chartData = useMemo(
    () => ad.map((p) => ({ ...p, sigmaRutherford: p.sigmaRutherford > 0 ? p.sigmaRutherford : null })),
    [ad],
  );
  // Scale to FRESCO's curve (and any data), not to Rutherford, which keeps rising at forward angles.
  const xsTicks = useMemo(
    () => decadeTicks([...ad.map((p) => p.sigmaMb), ...(expData?.points.map((p) => p.sigmaMb) ?? [])]),
    [ad, expData],
  );
  const angleRange = useMemo(() => {
    const angles = [...ad.map((p) => p.angleCm), ...(expData?.points.map((p) => p.angleCm) ?? [])];
    return angles.length ? [Math.min(...angles), Math.max(...angles)] : [0, 180];
  }, [ad, expData]);
  const ratioTicks = useMemo(() => decadeTicks(ad.map((p) => p.ratioRutherford)), [ad]);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    file.text().then((text) => {
      const parsed = parseDataFile(file.name, text);
      setExpData(parsed);
      setDataError(parsed ? null : `No “angle  cross-section” columns found in ${file.name}.`);
      if (parsed) setView('xs');
    });
  };

  if (!output) {
    return (
      <Card className="min-h-[24rem] flex items-center justify-center">
        <div className="text-center text-slate-400 py-16 space-y-2">
          {isRunning ? <Loader2 className="w-8 h-8 mx-auto animate-spin text-cyan-400" /> : null}
          <p className="text-sm">{isRunning ? 'Running FRESCO…' : 'Run FRESCO to see the results here.'}</p>
        </div>
      </Card>
    );
  }

  const { summary } = output;
  const engine = engineInfo(summary.engineUsed);
  const stats = [
    { label: 'Reaction σ', value: summary.totalReactionCrossSection, unit: 'mb' },
    { label: 'Elastic σ', value: summary.totalElasticCrossSection, unit: 'mb' },
    ...(channelIndex > 0 && channel.integratedMb ? [{ label: `σ, ${angleRange[0]}–${angleRange[1]}°`, value: channel.integratedMb, unit: 'mb' }] : []),
    { label: 'Grazing L', value: summary.grazingL, unit: '' },
    { label: 'Quarter-point angle', value: summary.quarterPointAngle, unit: '°' },
  ].filter((s) => s.value > 0);

  const xAxis = (
    <XAxis
      dataKey="angleCm"
      type="number"
      domain={angleRange}
      ticks={angleTicks(angleRange[0], angleRange[1])}
      stroke={AXIS}
      tick={{ fontSize: 11 }}
      label={{ value: 'θ c.m. (deg)', position: 'insideBottom', offset: -4, fill: AXIS, fontSize: 12 }}
    />
  );

  return (
    <Card
      title="Results"
      actions={
        <>
          <Button variant="ghost" onClick={() => fileInput.current?.click()} title="Overlay measured cross sections (angle, mb/sr[, error])">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Overlay data</span>
          </Button>
          <Button variant="ghost" onClick={() => downloadCsv(channel)} title="Download this channel's angular distribution as CSV">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
          <input ref={fileInput} type="file" accept=".dat,.txt,.csv,.tsv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        </>
      }
    >
      <div className="space-y-4">
        <div
          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
            engine.ok ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-900/60' : 'bg-amber-950/40 text-amber-200 border border-amber-900/60'
          }`}
          role="status"
        >
          {engine.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <div className="min-w-0">
            <span className="font-medium">{engine.label}</span>
            <span className="opacity-80"> · {summary.executionTimeMs.toFixed(0)} ms</span>
            {!engine.ok && (
              <p className="mt-0.5 opacity-90 break-words">
                {fallbackReason ? `FRESCO could not run this setup: ${fallbackReason}` : 'The FRESCO engine was unavailable.'} These
                numbers come from a simplified TypeScript model and are only indicative.
              </p>
            )}
          </div>
        </div>

        {stats.length > 0 && (
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2">
                <dt className="text-xs text-slate-400">{s.label}</dt>
                <dd className="text-lg font-semibold text-white tabular-nums">
                  {s.value.toFixed(s.value >= 100 ? 1 : 2)}
                  {s.unit && <span className="text-xs font-normal text-slate-400 ml-1">{s.unit}</span>}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {channels.length > 1 && (
          <SelectField label="Channel" value={String(channels.indexOf(channel))} onChange={(v) => setChannelIndex(Number(v))}>
            {channels.map((c, i) => (
              <option key={i} value={i}>
                {i === 0 ? `Elastic: ${c.label}` : c.label}
              </option>
            ))}
          </SelectField>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented label="Plot" options={views} value={activeView} onChange={setView} />
          {(activeView === 'xs' || activeView === 'ratio') && (
            <Segmented
              label="Y axis scale"
              options={[
                { value: 'log', label: 'Log' },
                { value: 'lin', label: 'Linear' },
              ]}
              value={logScale ? 'log' : 'lin'}
              onChange={(v) => setLogScale(v === 'log')}
            />
          )}
        </div>

        {expData && (
          <div className="flex items-center justify-between gap-2 text-xs text-slate-300 bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-1.5">
            <span className="truncate">
              Overlay: <span className="text-amber-300">{expData.name}</span> ({expData.points.length} points)
            </span>
            <button type="button" onClick={() => setExpData(null)} aria-label="Remove overlay" className="text-slate-400 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {dataError && <p className="text-xs text-rose-300">{dataError}</p>}

        <div className={`relative h-80 sm:h-96 transition-opacity ${isRunning ? 'opacity-40' : ''}`}>
          {isRunning && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            </div>
          )}
          {ad.length === 0 && activeView === 'xs' ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">No angular distribution in this result.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {activeView === 'xs' ? (
                <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 12 }}>
                  <CartesianGrid stroke={GRID} />
                  {xAxis}
                  <YAxis
                    scale={logScale ? 'log' : 'linear'}
                    domain={logScale ? (xsTicks ? [xsTicks[0], xsTicks[xsTicks.length - 1]] : ['auto', 'auto']) : [0, 'auto']}
                    ticks={logScale ? xsTicks : undefined}
                    allowDataOverflow
                    stroke={AXIS}
                    tick={{ fontSize: 11 }}
                    tickFormatter={tickFmt}
                    width={64}
                    label={{ value: 'dσ/dΩ (mb/sr)', angle: -90, position: 'insideLeft', fill: AXIS, fontSize: 12 }}
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} labelFormatter={(l) => `θ = ${l}°`} />
                  <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="sigmaMb" name="FRESCO" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} />
                  {charged && (
                    <Line type="monotone" dataKey="sigmaRutherford" name="Rutherford" stroke="#f43f5e" strokeWidth={1.25} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                  )}
                  {expData && <Scatter data={expData.points} dataKey="sigmaMb" name={expData.name} fill="#fbbf24" isAnimationActive={false} />}
                </ComposedChart>
              ) : activeView === 'ratio' ? (
                <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 12 }}>
                  <CartesianGrid stroke={GRID} />
                  {xAxis}
                  <YAxis
                    scale={logScale ? 'log' : 'linear'}
                    domain={logScale && ratioTicks ? [ratioTicks[0], ratioTicks[ratioTicks.length - 1]] : ['auto', 'auto']}
                    ticks={logScale ? ratioTicks : undefined}
                    allowDataOverflow
                    stroke={AXIS}
                    tick={{ fontSize: 11 }}
                    tickFormatter={tickFmt}
                    width={64}
                    label={{ value: 'σ / σ_Ruth', angle: -90, position: 'insideLeft', fill: AXIS, fontSize: 12 }}
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} labelFormatter={(l) => `θ = ${l}°`} />
                  <Line type="monotone" dataKey="ratioRutherford" name="σ/σ_Ruth" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} />
                </ComposedChart>
              ) : activeView === 'ay' ? (
                <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 12 }}>
                  <CartesianGrid stroke={GRID} />
                  {xAxis}
                  <YAxis domain={[-1, 1]} stroke={AXIS} tick={{ fontSize: 11 }} width={64} label={{ value: 'A_y', angle: -90, position: 'insideLeft', fill: AXIS, fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} labelFormatter={(l) => `θ = ${l}°`} />
                  <Line type="monotone" dataKey="ay" name="A_y" stroke="#a78bfa" strokeWidth={2} dot={false} isAnimationActive={false} />
                </ComposedChart>
              ) : activeView === 'potentials' ? (
                <ComposedChart data={output.potentials} margin={{ top: 8, right: 12, left: 4, bottom: 12 }}>
                  <CartesianGrid stroke={GRID} />
                  <XAxis dataKey="r" type="number" stroke={AXIS} tick={{ fontSize: 11 }} label={{ value: 'r (fm)', position: 'insideBottom', offset: -4, fill: AXIS, fontSize: 12 }} />
                  <YAxis stroke={AXIS} tick={{ fontSize: 11 }} width={64} label={{ value: 'MeV', angle: -90, position: 'insideLeft', fill: AXIS, fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
                  <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12 }} />
                  <Line dataKey="vReal" name="Real" stroke="#22d3ee" dot={false} isAnimationActive={false} />
                  <Line dataKey="wVol" name="Imag. volume" stroke="#a78bfa" dot={false} isAnimationActive={false} />
                  <Line dataKey="wSurf" name="Imag. surface" stroke="#f472b6" dot={false} isAnimationActive={false} />
                  <Line dataKey="vCoulomb" name="Coulomb" stroke="#fbbf24" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                </ComposedChart>
              ) : activeView === 'smatrix' ? (
                <ComposedChart data={output.sMatrix} margin={{ top: 8, right: 12, left: 4, bottom: 12 }}>
                  <CartesianGrid stroke={GRID} />
                  <XAxis dataKey="l" type="number" stroke={AXIS} tick={{ fontSize: 11 }} label={{ value: 'L', position: 'insideBottom', offset: -4, fill: AXIS, fontSize: 12 }} />
                  <YAxis yAxisId="eta" domain={[0, 1]} stroke="#22d3ee" tick={{ fontSize: 11 }} width={48} />
                  <YAxis yAxisId="phase" orientation="right" stroke="#f43f5e" tick={{ fontSize: 11 }} width={48} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
                  <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12 }} />
                  <Line yAxisId="eta" dataKey="eta" name="|S_L|" stroke="#22d3ee" dot={{ r: 2 }} isAnimationActive={false} />
                  <Line yAxisId="phase" dataKey="phaseShiftDeg" name="δ_L (deg)" stroke="#f43f5e" dot={{ r: 2 }} isAnimationActive={false} />
                </ComposedChart>
              ) : (
                <ComposedChart data={output.wavefunctions[0]?.points ?? []} margin={{ top: 8, right: 12, left: 4, bottom: 12 }}>
                  <CartesianGrid stroke={GRID} />
                  <XAxis dataKey="r" type="number" stroke={AXIS} tick={{ fontSize: 11 }} label={{ value: 'r (fm)', position: 'insideBottom', offset: -4, fill: AXIS, fontSize: 12 }} />
                  <YAxis stroke={AXIS} tick={{ fontSize: 11 }} width={64} tickFormatter={tickFmt} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v)} />
                  <Line dataKey="probDensity" name="|u(r)|²" stroke="#4ade80" dot={false} isAnimationActive={false} />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          )}
        </div>

        {output.frescoOut && (
          <details className="group border border-slate-800 rounded-lg">
            <summary className="px-3 py-2 text-sm text-slate-300 cursor-pointer select-none">FRESCO output listing</summary>
            <pre className="max-h-80 overflow-auto px-3 pb-3 text-[11px] leading-snug text-slate-400 font-mono whitespace-pre">{output.frescoOut}</pre>
          </details>
        )}
      </div>
    </Card>
  );
};
