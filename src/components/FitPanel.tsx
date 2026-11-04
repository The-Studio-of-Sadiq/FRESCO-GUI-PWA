import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, ComposedChart, ErrorBar, Legend, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, AlertTriangle, Loader2, Play, Square, Upload, Download } from 'lucide-react';
import { FRESCODeckConfig, AngularDataPoint } from '../types/fresco';
import { generateFrescoDeck } from '../physics/frescoParser';
import {
  FitDataset,
  FitParameter,
  POTENTIAL_FIT_TERMS,
  applyFitValues,
  locatePotentialParameter,
  parameterId,
} from '../physics/sfresco';
import { cancelSfresco, runFrescoWasm, runSfrescoWasm, SfrescoRun } from '../fortran/frescoWasm';
import { Button, Card, SelectField } from './ui';

interface FitPanelProps {
  config: FRESCODeckConfig;
  /** Put the fitted values into the setup and show them on Simulate. */
  onApply: (config: FRESCODeckConfig) => void;
}

const DEFAULT_RELATIVE_ERROR = 0.1;
const AXIS = '#94a3b8';
const tooltipStyle = { backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', fontSize: 12 };

function parsePoints(text: string): { points: FitDataset['points']; missingErrors: number } {
  const points: FitDataset['points'] = [];
  let missingErrors = 0;
  for (const line of text.split('\n')) {
    if (/^\s*[#!@&]/.test(line)) continue;
    const nums = line.trim().split(/[\s,;]+/).map(Number);
    if (nums.length < 2 || isNaN(nums[0]) || isNaN(nums[1])) continue;
    let error = nums.length >= 3 && !isNaN(nums[2]) && nums[2] > 0 ? nums[2] : NaN;
    if (isNaN(error)) {
      error = Math.abs(nums[1]) * DEFAULT_RELATIVE_ERROR || 1e-6;
      missingErrors++;
    }
    points.push({ angle: nums[0], value: nums[1], error });
  }
  return { points, missingErrors };
}

/** Index of (partition, state) in FRESCO's list of outgoing channels. */
function channelIndex(config: FRESCODeckConfig, partition: number, state: number): number {
  let index = 0;
  for (let p = 0; p < partition - 1; p++) index += Math.max(1, config.states.filter((s) => s.partitionId === config.partitions[p].id).length);
  return index + state - 1;
}

interface FitOutcome {
  run: SfrescoRun;
  parameters: FitParameter[];
  starting: number[];
  fittedConfig: FRESCODeckConfig;
  before: AngularDataPoint[];
  after: AngularDataPoint[];
}

export const FitPanel: React.FC<FitPanelProps> = ({ config, onApply }) => {
  const [dataText, setDataText] = useState('');
  const [quantity, setQuantity] = useState<FitDataset['quantity']>('absolute');
  const [channel, setChannel] = useState('1:1');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(['pot0:V0', 'pot0:W0']));
  const [isFitting, setIsFitting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<FitOutcome | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const deck = useMemo(() => generateFrescoDeck(config), [config]);
  const { points, missingErrors } = useMemo(() => parsePoints(dataText), [dataText]);
  const [partition, state] = channel.split(':').map(Number);
  const elastic = partition === 1 && state === 1;
  const effectiveQuantity = elastic ? quantity : 'absolute';
  const transfers = config.couplings.filter((c) => c.couplingType === 'transfer-dwba');

  useEffect(() => {
    if (!isFitting) return;
    const start = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - start) / 1000), 500);
    return () => clearInterval(timer);
  }, [isFitting]);

  const candidates: { param: FitParameter; label: string; start: number; disabled?: string }[] = [
    ...config.potentials.flatMap((pot, potentialIndex) =>
      POTENTIAL_FIT_TERMS.map((term) => {
        const at = locatePotentialParameter(deck, potentialIndex, term.key);
        return {
          param: { kind: 'potential', potentialIndex, key: term.key } as FitParameter,
          label: `${term.label} (${term.unit})`,
          start: pot[term.key] as number,
          disabled: 'error' in at ? at.error : undefined,
        };
      }),
    ),
    ...transfers.map((c) => {
      const from = config.states.find((s) => s.id === c.fromStateId)?.name ?? '?';
      const to = config.states.find((s) => s.id === c.toStateId)?.name ?? '?';
      return { param: { kind: 'spectroscopic', couplingId: c.id } as FitParameter, label: `Spectroscopic factor S, ${from} → ${to}`, start: c.spectroscopicFactor };
    }),
    { param: { kind: 'normalisation' } as FitParameter, label: 'Data normalisation factor', start: 1 },
  ];
  const chosen = candidates.filter((c) => selected.has(parameterId(c.param)) && !c.disabled);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const runFit = async () => {
    setError(null);
    setOutcome(null);
    setElapsed(0);
    setIsFitting(true);
    try {
      const parameters = chosen.map((c) => c.param);
      const dataset: FitDataset = { partition, state, quantity: effectiveQuantity, points };
      const run = await runSfrescoWasm(config, parameters, dataset);
      // SFRESCO varies the spectroscopic amplitude A; the setup stores S = A².
      const fittedConfig = applyFitValues(config, parameters, run.values);
      const [beforeRun, afterRun] = [await runFrescoWasm(config), await runFrescoWasm(fittedConfig)];
      const pick = (r: typeof beforeRun) => r.output.channels?.[channelIndex(config, partition, state)]?.points ?? [];
      setOutcome({
        run,
        parameters,
        starting: chosen.map((c) => (c.param.kind === 'spectroscopic' ? Math.sqrt(c.start) : c.start)),
        fittedConfig,
        before: pick(beforeRun),
        after: pick(afterRun),
      });
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setIsFitting(false);
      // On narrow screens the result sits below the form
      if (window.matchMedia('(max-width: 1023px)').matches) {
        requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    }
  };

  const norm = outcome ? outcome.run.values[outcome.parameters.findIndex((p) => p.kind === 'normalisation')]?.value ?? 1 : 1;
  const yKey = effectiveQuantity === 'ratio' ? 'ratioRutherford' : 'sigmaMb';
  const plotData = points.map((p) => ({ angle: p.angle, datum: p.value, error: p.error }));
  const curve = (pts: AngularDataPoint[]) => pts.filter((p) => p.angleCm >= 1 || !elastic).map((p) => ({ angle: p.angleCm, y: p[yKey] }));
  const canFit = points.length >= 2 && chosen.length > 0 && chosen.length < points.length && !isFitting;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <div className="lg:col-span-5 space-y-4">
        <Card
          title="Measured data"
          actions={
            <label className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer focus-within:ring-2 focus-within:ring-cyan-400">
              <Upload className="w-4 h-4" />
              Upload
              <input type="file" accept=".dat,.txt,.csv,.tsv" className="sr-only" onChange={(e) => e.target.files?.[0]?.text().then(setDataText)} />
            </label>
          }
        >
          <div className="space-y-3">
            <textarea
              value={dataText}
              onChange={(e) => setDataText(e.target.value)}
              rows={8}
              wrap="off"
              spellCheck={false}
              aria-label="Measured data: angle, value, error"
              placeholder={'θ c.m. (deg)   value   error\n30   1.05   0.05\n40   0.82   0.04\n…'}
              className="w-full bg-slate-950 text-slate-200 border border-slate-700 rounded-md p-2.5 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
            />
            <p className="text-xs text-slate-400">
              {points.length} points.
              {missingErrors > 0 && ` ${missingErrors} without an error column use ${DEFAULT_RELATIVE_ERROR * 100}% of the value.`}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectField label="Channel" value={channel} onChange={setChannel}>
                {config.partitions.flatMap((p, pi) =>
                  config.states
                    .filter((s) => s.partitionId === p.id)
                    .map((s, si) => (
                      <option key={s.id} value={`${pi + 1}:${si + 1}`}>
                        {pi === 0 && si === 0 ? 'Elastic: ' : ''}
                        {p.name}, {s.name}
                      </option>
                    )),
                )}
              </SelectField>
              <SelectField label="Values are" value={effectiveQuantity} onChange={(v) => setQuantity(v as FitDataset['quantity'])}>
                <option value="absolute">Cross section (mb/sr)</option>
                {elastic && <option value="ratio">Ratio to Rutherford</option>}
              </SelectField>
            </div>
            <p className="text-xs text-slate-500">Angles in the centre-of-mass frame, at the setup's beam energy ({config.eLab} MeV).</p>
          </div>
        </Card>

        <Card title="Parameters to fit">
          <div className="space-y-3">
            {config.potentials.map((pot, pi) => (
              <fieldset key={pot.id} className="min-w-0">
                <legend className="text-xs font-medium text-slate-300 mb-1.5">
                  Potential {pi + 1}: {pot.name}
                </legend>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1">
                  {candidates
                    .filter((c) => c.param.kind === 'potential' && c.param.potentialIndex === pi)
                    .map((c) => {
                      const id = parameterId(c.param);
                      return (
                        <label key={id} title={c.disabled} className={`flex items-center gap-2 text-sm ${c.disabled ? 'text-slate-600' : 'text-slate-300 cursor-pointer'}`}>
                          <input type="checkbox" className="accent-cyan-500" disabled={!!c.disabled} checked={selected.has(id) && !c.disabled} onChange={() => toggle(id)} />
                          <span className="truncate">
                            {c.label.split(' ')[0]} <span className="text-slate-500 tabular-nums">{c.start}</span>
                          </span>
                        </label>
                      );
                    })}
                </div>
              </fieldset>
            ))}
            {candidates
              .filter((c) => c.param.kind !== 'potential')
              .map((c) => {
                const id = parameterId(c.param);
                return (
                  <label key={id} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input type="checkbox" className="accent-cyan-500" checked={selected.has(id)} onChange={() => toggle(id)} />
                    {c.label}
                    {c.param.kind === 'spectroscopic' && <span className="text-slate-500 tabular-nums">{c.start}</span>}
                  </label>
                );
              })}
            <p className="text-xs text-slate-500">Greyed-out terms are zero in the setup; give them a starting value on Simulate to fit them.</p>
          </div>
        </Card>

        <div className="flex gap-2">
          <Button variant="primary" onClick={runFit} disabled={!canFit} className="flex-1 py-2.5">
            {isFitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
            {isFitting ? `Fitting… ${elapsed.toFixed(0)} s` : `Fit ${chosen.length} parameter${chosen.length === 1 ? '' : 's'} with SFRESCO`}
          </Button>
          {isFitting && (
            <Button onClick={cancelSfresco} className="py-2.5" title="Stop the search">
              <Square className="w-4 h-4" />
              Stop
            </Button>
          )}
        </div>
        {points.length >= 2 && chosen.length >= points.length && (
          <p className="text-xs text-amber-300">Fit fewer parameters than there are data points.</p>
        )}
      </div>

      <div ref={resultRef} className="lg:col-span-7 lg:sticky lg:top-20 space-y-4 scroll-mt-28">
        <Card title="Fit">
          {error && (
            <div role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-rose-900 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="break-words">{error}</span>
            </div>
          )}
          {!outcome && !isFitting && (
            <p className="text-sm text-slate-400 py-6">
              SFRESCO (FRESCO with the MINUIT minimiser) adjusts the ticked parameters to minimise χ² between FRESCO and your data. Paste
              data, tick parameters and press Fit.
            </p>
          )}
          {isFitting && (
            <p className="text-sm text-slate-400 py-6 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              MINUIT is running FRESCO repeatedly in this browser. Larger fits can take a few minutes.
            </p>
          )}

          {outcome && (
            <div className="space-y-4">
              <div
                role="status"
                className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs border ${
                  outcome.run.converged ? 'bg-emerald-950/40 text-emerald-300 border-emerald-900/60' : 'bg-amber-950/40 text-amber-200 border-amber-900/60'
                }`}
              >
                {outcome.run.converged ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                <span>
                  {outcome.run.status}. χ²/N {outcome.run.initialChi2PerPoint?.toFixed(3) ?? '?'} → {outcome.run.finalChi2PerPoint?.toFixed(3) ?? '?'} ·{' '}
                  {(outcome.run.elapsedMs / 1000).toFixed(1)} s
                  {!outcome.run.converged && ' The values below are the best found; check them before using.'}
                </span>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 text-left">
                    <th className="font-normal pb-1">Parameter</th>
                    <th className="font-normal pb-1 text-right">Start</th>
                    <th className="font-normal pb-1 text-right">Fitted</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {outcome.parameters.map((p, i) => {
                    const c = candidates.find((x) => parameterId(x.param) === parameterId(p));
                    const v = outcome.run.values[i];
                    const isS = p.kind === 'spectroscopic';
                    // S = A², σ_S = 2|A|σ_A
                    const value = isS ? v.value * v.value : v.value;
                    const err = isS ? 2 * Math.abs(v.value) * v.error : v.error;
                    const start = isS ? outcome.starting[i] ** 2 : outcome.starting[i];
                    const label = p.kind === 'potential' ? `Pot ${p.potentialIndex + 1} · ${c?.label ?? p.key}` : c?.label ?? '';
                    return (
                      <tr key={parameterId(p)} className="border-t border-slate-800">
                        <td className="py-1 pr-2 text-slate-300">{label}</td>
                        <td className="py-1 text-right text-slate-400">{Number(start.toPrecision(5))}</td>
                        <td className="py-1 text-right text-white">
                          {Number(value.toPrecision(5))}
                          <span className="text-slate-500"> ± {Number(err.toPrecision(2))}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart margin={{ top: 8, right: 12, left: 4, bottom: 12 }}>
                    <CartesianGrid stroke="#1e293b" />
                    <XAxis dataKey="angle" type="number" domain={['dataMin', 'dataMax']} stroke={AXIS} tick={{ fontSize: 11 }} label={{ value: 'θ c.m. (deg)', position: 'insideBottom', offset: -4, fill: AXIS, fontSize: 12 }} />
                    <YAxis scale="log" domain={['auto', 'auto']} allowDataOverflow stroke={AXIS} tick={{ fontSize: 11 }} width={60} tickFormatter={(v: number) => String(Number(v.toPrecision(2)))} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12 }} />
                    <Line data={curve(outcome.before)} dataKey="y" name="Before" stroke="#64748b" strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                    <Line data={curve(outcome.after)} dataKey="y" name="Fitted" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Scatter data={plotData.map((p) => ({ ...p, datum: p.datum * norm, error: p.error * norm }))} dataKey="datum" name={norm !== 1 ? `Data × ${norm.toPrecision(4)}` : 'Data'} fill="#fbbf24" isAnimationActive={false}>
                      <ErrorBar dataKey="error" direction="y" stroke="#fbbf24" width={3} />
                    </Scatter>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => onApply(outcome.fittedConfig)}>
                  Use fitted values
                </Button>
                <Button
                  onClick={() => {
                    const url = URL.createObjectURL(new Blob([outcome.run.searchFile], { type: 'text/plain' }));
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'fit.search';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  title="SFRESCO search file, to rerun this fit with sfresco"
                >
                  <Download className="w-4 h-4" />
                  Search file
                </Button>
              </div>

              <details className="border border-slate-800 rounded-lg">
                <summary className="px-3 py-2 text-sm text-slate-300 cursor-pointer select-none">SFRESCO output</summary>
                <pre className="max-h-80 overflow-auto px-3 pb-3 text-[11px] leading-snug text-slate-400 font-mono whitespace-pre">{outcome.run.stdout}</pre>
              </details>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
