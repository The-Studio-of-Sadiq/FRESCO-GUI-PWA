import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, ComposedChart, ErrorBar, Legend, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CheckCircle2, Download, Loader2, Play, Plus, Square, Trash2, Upload } from 'lucide-react';
import { FRESCODeckConfig } from '../types/fresco';
import {
  DatasetComparison,
  DatasetType,
  FitDataset,
  FitParameter,
  FitVariable,
  IntegratedQuantity,
  POTENTIAL_FIT_TERMS,
  applyFitValues,
  applyFitValuesToDeck,
  locatePotentialParameter,
  parameterId,
  startingValue,
} from '../physics/sfresco';
import { cancelSfresco, runSfrescoScan, runSfrescoWasm, SfrescoRun } from '../fortran/frescoWasm';
import { Button, Card, NumField, SelectField, Segmented } from './ui';

interface FitPanelProps {
  config: FRESCODeckConfig;
  /** The deck SFRESCO varies: your own deck, or the one generated from the form. */
  deckText: string;
  isCustomDeck: boolean;
  /** Put the fitted values into the setup (and into your own deck, if any) and show them on Simulate. */
  onApply: (fitted: { config: FRESCODeckConfig; deckText?: string }) => void;
}

const DEFAULT_RELATIVE_ERROR = 0.1;
const AXIS = '#94a3b8';
const tooltipStyle = { backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', fontSize: 12 };

interface DatasetDraft {
  id: number;
  type: DatasetType;
  channel: string; // "partition:state"
  quantity: 'absolute' | 'ratio';
  /** Lab energy of an angular distribution; null follows the setup. */
  energy: number | null;
  angle: number;
  integrated: IntegratedQuantity;
  jtot: number;
  parity: 1 | -1;
  ccChannel: number;
  fitNorm: boolean;
  text: string;
}

interface PoleDraft {
  id: number;
  jtot: number;
  parity: 1 | -1;
  energy: number;
  channel: number;
  width: number;
}

const TYPE_LABELS: Record<DatasetType, string> = {
  angular: 'Angular distribution',
  excitation: 'Excitation function (fixed angle)',
  integrated: 'Integrated cross section vs energy',
  phase: 'Phase shift vs energy',
};

const X_LABEL: Record<DatasetType, string> = {
  angular: 'θ c.m. (deg)',
  excitation: 'E lab (MeV)',
  integrated: 'E lab (MeV)',
  phase: 'E lab (MeV)',
};

const Y_LABEL = (d: DatasetDraft) =>
  d.type === 'phase' ? 'phase shift (deg)' : d.type === 'integrated' ? 'σ (mb)' : d.type === 'angular' && d.quantity === 'ratio' ? 'σ/σ_Ruth' : 'dσ/dΩ (mb/sr)';

function parsePoints(text: string, relativeErrors: boolean): { points: FitDataset['points']; missingErrors: number } {
  const points: FitDataset['points'] = [];
  let missingErrors = 0;
  for (const line of text.split('\n')) {
    if (/^\s*[#!@&]/.test(line)) continue;
    const nums = line.trim().split(/[\s,;]+/).map(Number);
    if (nums.length < 2 || isNaN(nums[0]) || isNaN(nums[1])) continue;
    let error = nums.length >= 3 && !isNaN(nums[2]) && nums[2] > 0 ? nums[2] : NaN;
    if (isNaN(error)) {
      error = relativeErrors ? Math.abs(nums[1]) * DEFAULT_RELATIVE_ERROR || 1e-6 : 1;
      missingErrors++;
    }
    points.push({ x: nums[0], value: nums[1], error });
  }
  return { points, missingErrors };
}

let nextId = 1;

export const FitPanel: React.FC<FitPanelProps> = ({ config, deckText, isCustomDeck, onApply }) => {
  const newDataset = (): DatasetDraft => ({
    id: nextId++,
    type: 'angular',
    channel: '1:1',
    quantity: 'absolute',
    energy: null,
    angle: 90,
    integrated: 'reaction',
    jtot: 0.5,
    parity: 1,
    ccChannel: 1,
    fitNorm: false,
    text: '',
  });
  const [datasets, setDatasets] = useState<DatasetDraft[]>(() => [newDataset()]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(['pot0:V0', 'pot0:W0']));
  const [bounds, setBounds] = useState<Record<string, { min?: number; max?: number }>>({});
  const [poles, setPoles] = useState<PoleDraft[]>([]);
  const [mode, setMode] = useState<'fit' | 'scan'>('fit');
  const [scan, setScan] = useState({ index: 0, from: 0, to: 0, step: 0 });
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ run: SfrescoRun; variables: FitVariable[]; starting: number[]; drafts: DatasetDraft[] } | null>(null);
  const [scanResult, setScanResult] = useState<{ label: string; points: { value: number; chi2PerPoint: number }[] } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const transfers = config.couplings.filter((c) => c.couplingType === 'transfer-dwba');
  const channelOptions = config.partitions.flatMap((p, pi) =>
    config.states
      .filter((s) => s.partitionId === p.id)
      .map((s, si) => ({ value: `${pi + 1}:${si + 1}`, label: `${pi === 0 && si === 0 ? 'Elastic: ' : ''}${p.name}, ${s.name}` })),
  );

  useEffect(() => {
    if (!isRunning) return;
    const start = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - start) / 1000), 500);
    return () => clearInterval(timer);
  }, [isRunning]);

  const parsed = useMemo(() => datasets.map((d) => parsePoints(d.text, d.type !== 'phase')), [datasets]);
  const updateDataset = (id: number, patch: Partial<DatasetDraft>) => setDatasets((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  // Every variable that can be offered, with its label and why it may be unavailable
  const candidates: { param: FitParameter; label: string; group: string; disabled?: string }[] = [
    ...config.potentials.flatMap((pot, potentialIndex) =>
      POTENTIAL_FIT_TERMS.map((term) => {
        const at = locatePotentialParameter(deckText, potentialIndex, term.key);
        return {
          param: { kind: 'potential', potentialIndex, key: term.key } as FitParameter,
          label: `${term.label} (${term.unit})`,
          group: `Potential ${potentialIndex + 1}: ${pot.name}`,
          disabled: 'error' in at ? at.error : undefined,
        };
      }),
    ),
    ...transfers.map((c) => {
      const from = config.states.find((s) => s.id === c.fromStateId)?.name ?? '?';
      const to = config.states.find((s) => s.id === c.toStateId)?.name ?? '?';
      return { param: { kind: 'spectroscopic', couplingId: c.id } as FitParameter, label: `S, ${from} → ${to}`, group: 'Spectroscopic factors' };
    }),
  ];

  const variables: FitVariable[] = [
    ...candidates.filter((c) => selected.has(parameterId(c.param)) && !c.disabled).map((c) => ({ param: c.param, ...bounds[parameterId(c.param)] })),
    ...datasets.flatMap((d, i) => (d.fitNorm ? [{ param: { kind: 'normalisation', dataset: i } as FitParameter, ...bounds[`norm:${i}`] }] : [])),
    ...poles.flatMap((p, i) => [
      { param: { kind: 'rmatrix-energy', term: i + 1, jtot: p.jtot, parity: p.parity, energy: p.energy } as FitParameter, ...bounds[`rmE:${i + 1}`] },
      { param: { kind: 'rmatrix-width', term: i + 1, channel: p.channel, width: p.width } as FitParameter, ...bounds[`rmW:${i + 1}:${p.channel}`] },
    ]),
  ];

  const labelOf = (p: FitParameter) => {
    if (p.kind === 'potential') return `Pot ${p.potentialIndex + 1} · ${POTENTIAL_FIT_TERMS.find((t) => t.key === p.key)?.label}`;
    if (p.kind === 'spectroscopic') return candidates.find((c) => parameterId(c.param) === parameterId(p))?.label ?? 'S';
    if (p.kind === 'normalisation') return `Normalisation, dataset ${p.dataset + 1}`;
    if (p.kind === 'rmatrix-energy') return `Pole ${p.term} energy (MeV)`;
    return `Pole ${p.term} width, channel ${p.channel}`;
  };

  const fitDatasets = (): FitDataset[] =>
    datasets.map((d, i) => {
      const [partition, state] = d.channel.split(':').map(Number);
      return {
        type: d.type,
        partition,
        state,
        quantity: d.type === 'angular' && d.channel === '1:1' ? d.quantity : 'absolute',
        energy: d.energy ?? config.eLab,
        angle: d.angle,
        integrated: d.integrated,
        jtot: d.jtot,
        parity: d.parity,
        channel: d.ccChannel,
        points: parsed[i].points,
      };
    });

  const totalPoints = parsed.reduce((n, p) => n + p.points.length, 0);
  const emptyDataset = parsed.findIndex((p) => p.points.length === 0);
  const problem =
    variables.length === 0
      ? 'Tick at least one parameter.'
      : emptyDataset >= 0
        ? `Dataset ${emptyDataset + 1} has no data points.`
        : totalPoints <= variables.length
          ? 'Fit fewer parameters than there are data points.'
          : null;

  const finish = () => {
    setIsRunning(false);
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  const runFit = async () => {
    setError(null);
    setOutcome(null);
    setScanResult(null);
    setElapsed(0);
    setIsRunning(true);
    try {
      const run = await runSfrescoWasm(config, deckText, variables, fitDatasets());
      setOutcome({ run, variables, starting: variables.map((v) => startingValue(config, v.param)), drafts: datasets });
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      finish();
    }
  };

  const runScan = async () => {
    setError(null);
    setScanResult(null);
    setIsRunning(true);
    try {
      const v = variables[scan.index];
      const { points } = await runSfrescoScan(config, deckText, variables, fitDatasets(), { index: scan.index + 1, from: scan.from, to: scan.to, step: scan.step });
      setScanResult({ label: labelOf(v.param), points });
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      finish();
    }
  };

  const apply = () => {
    if (!outcome) return;
    const fittedConfig = applyFitValues(config, outcome.variables, outcome.run.values);
    onApply({ config: fittedConfig, deckText: isCustomDeck ? applyFitValuesToDeck(deckText, config, outcome.variables, outcome.run.values) : undefined });
  };

  // Default scan range around the chosen variable's starting value
  const pickScanVariable = (index: number) => {
    const v = variables[index];
    const start = v ? startingValue(config, v.param) : 0;
    const span = Math.max(Math.abs(start) * 0.2, 0.1);
    setScan({ index, from: Number((start - span).toPrecision(4)), to: Number((start + span).toPrecision(4)), step: Number((span / 5).toPrecision(3)) });
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const boundField = (id: string, which: 'min' | 'max') => (
    <input
      type="number"
      aria-label={`${which === 'min' ? 'Lower' : 'Upper'} bound`}
      placeholder={which}
      value={bounds[id]?.[which] ?? ''}
      onChange={(e) => {
        const n = e.target.value === '' ? undefined : Number(e.target.value);
        setBounds((b) => ({ ...b, [id]: { ...b[id], [which]: n !== undefined && Number.isFinite(n) ? n : undefined } }));
      }}
      className="w-20 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-xs font-mono text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
    />
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <div className="lg:col-span-5 space-y-4">
        {isCustomDeck && (
          <p className="rounded-lg border border-cyan-900 bg-cyan-950/40 px-3 py-2 text-xs text-cyan-200">
            Fitting your own input deck. "Use fitted values" writes them into it.
          </p>
        )}

        {datasets.map((d, i) => {
          const { points, missingErrors } = parsed[i];
          const elastic = d.channel === '1:1';
          return (
            <Card
              key={d.id}
              title={`Dataset ${i + 1}`}
              actions={
                <>
                  <label className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer focus-within:ring-2 focus-within:ring-cyan-400">
                    <Upload className="w-4 h-4" />
                    <span className="hidden sm:inline">Upload</span>
                    <input type="file" accept=".dat,.txt,.csv,.tsv" className="sr-only" onChange={(e) => e.target.files?.[0]?.text().then((text) => updateDataset(d.id, { text }))} />
                  </label>
                  {datasets.length > 1 && (
                    <Button variant="ghost" className="px-2" aria-label={`Remove dataset ${i + 1}`} onClick={() => setDatasets((ds) => ds.filter((x) => x.id !== d.id))}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </>
              }
            >
              <div className="space-y-3">
                <SelectField label="Data" value={d.type} onChange={(v) => updateDataset(d.id, { type: v as DatasetType })}>
                  {(Object.keys(TYPE_LABELS) as DatasetType[]).map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </SelectField>

                <div className="grid grid-cols-2 gap-3">
                  {(d.type === 'angular' || d.type === 'excitation' || (d.type === 'integrated' && d.integrated === 'channel')) && (
                    <div className="col-span-2">
                      <SelectField label="Channel" value={d.channel} onChange={(v) => updateDataset(d.id, { channel: v })}>
                        {channelOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                  )}
                  {d.type === 'angular' && (
                    <>
                      <NumField label="E lab" unit="MeV" step={0.1} min={0} value={d.energy ?? config.eLab} onChange={(energy) => updateDataset(d.id, { energy })} />
                      <SelectField label="Values are" value={elastic ? d.quantity : 'absolute'} onChange={(v) => updateDataset(d.id, { quantity: v as DatasetDraft['quantity'] })}>
                        <option value="absolute">mb/sr</option>
                        {elastic && <option value="ratio">σ/σ_Ruth</option>}
                      </SelectField>
                    </>
                  )}
                  {d.type === 'excitation' && (
                    <NumField label="Angle θ c.m." unit="deg" step={1} min={0} value={d.angle} onChange={(angle) => updateDataset(d.id, { angle })} />
                  )}
                  {d.type === 'integrated' && (
                    <div className="col-span-2">
                      <SelectField label="Cross section" value={d.integrated} onChange={(v) => updateDataset(d.id, { integrated: v as IntegratedQuantity })}>
                        <option value="reaction">Total reaction</option>
                        <option value="total">Total (neutrons)</option>
                        <option value="elastic">Integrated elastic</option>
                        <option value="channel">Integrated, one channel</option>
                        <option value="fusion">Fusion (needs kfus in the deck)</option>
                      </SelectField>
                    </div>
                  )}
                  {d.type === 'phase' && (
                    <>
                      <NumField label="J" step={0.5} min={0} value={d.jtot} onChange={(jtot) => updateDataset(d.id, { jtot })} />
                      <SelectField label="Parity" value={String(d.parity)} onChange={(v) => updateDataset(d.id, { parity: Number(v) as 1 | -1 })}>
                        <option value="1">+</option>
                        <option value="-1">−</option>
                      </SelectField>
                      <NumField label="Channel in J^π set" step={1} min={1} value={d.ccChannel} onChange={(ccChannel) => updateDataset(d.id, { ccChannel: Math.round(ccChannel) })} />
                    </>
                  )}
                </div>

                <textarea
                  value={d.text}
                  onChange={(e) => updateDataset(d.id, { text: e.target.value })}
                  rows={6}
                  wrap="off"
                  spellCheck={false}
                  aria-label={`Dataset ${i + 1}: ${X_LABEL[d.type]}, value, error`}
                  placeholder={`${X_LABEL[d.type]}   ${Y_LABEL(d)}   error\n…`}
                  className="w-full bg-slate-950 text-slate-200 border border-slate-700 rounded-md p-2.5 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <span>
                    {points.length} points.
                    {missingErrors > 0 && (d.type === 'phase' ? ` ${missingErrors} without errors use 1°.` : ` ${missingErrors} without errors use ${DEFAULT_RELATIVE_ERROR * 100}%.`)}
                  </span>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" className="accent-cyan-500" checked={d.fitNorm} onChange={(e) => updateDataset(d.id, { fitNorm: e.target.checked })} />
                    Fit normalisation
                  </label>
                </div>
              </div>
            </Card>
          );
        })}
        <Button onClick={() => setDatasets((ds) => [...ds, newDataset()])} className="w-full">
          <Plus className="w-4 h-4" />
          Add dataset
        </Button>

        <Card title="Parameters to fit">
          <div className="space-y-3">
            {[...new Set(candidates.map((c) => c.group))].map((group) => (
              <fieldset key={group} className="min-w-0">
                <legend className="text-xs font-medium text-slate-300 mb-1.5">{group}</legend>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1">
                  {candidates
                    .filter((c) => c.group === group)
                    .map((c) => {
                      const id = parameterId(c.param);
                      const start = c.param.kind === 'spectroscopic' ? startingValue(config, c.param) ** 2 : startingValue(config, c.param);
                      return (
                        <label key={id} title={c.disabled} className={`flex items-center gap-2 text-sm ${c.disabled ? 'text-slate-600' : 'text-slate-300 cursor-pointer'}`}>
                          <input type="checkbox" className="accent-cyan-500" disabled={!!c.disabled} checked={selected.has(id) && !c.disabled} onChange={() => toggle(id)} />
                          <span className="truncate">
                            {c.label.split(' (')[0]} <span className="text-slate-500 tabular-nums">{Number(start?.toPrecision(5))}</span>
                          </span>
                        </label>
                      );
                    })}
                </div>
              </fieldset>
            ))}

            <details className="border-t border-slate-800 pt-2">
              <summary className="text-xs font-medium text-slate-300 cursor-pointer select-none">R-matrix poles ({poles.length})</summary>
              <div className="space-y-2 mt-2">
                <p className="text-xs text-slate-500">
                  Adds R-matrix terms to the J^π set; their energies (MeV c.m.) and partial widths are fitted. Usually fitted to phase shifts or
                  excitation functions.
                </p>
                {poles.map((p, i) => (
                  <div key={p.id} className="grid grid-cols-[repeat(4,minmax(0,1fr))_auto] gap-2 items-end">
                    <NumField label="J" step={0.5} min={0} value={p.jtot} onChange={(jtot) => setPoles((ps) => ps.map((x) => (x.id === p.id ? { ...x, jtot } : x)))} />
                    <SelectField label="π" value={String(p.parity)} onChange={(v) => setPoles((ps) => ps.map((x) => (x.id === p.id ? { ...x, parity: Number(v) as 1 | -1 } : x)))}>
                      <option value="1">+</option>
                      <option value="-1">−</option>
                    </SelectField>
                    <NumField label="Energy" unit="MeV" step={0.01} value={p.energy} onChange={(energy) => setPoles((ps) => ps.map((x) => (x.id === p.id ? { ...x, energy } : x)))} />
                    <NumField label="Width" step={0.01} value={p.width} onChange={(width) => setPoles((ps) => ps.map((x) => (x.id === p.id ? { ...x, width } : x)))} />
                    <Button variant="ghost" className="px-2 mb-0.5" aria-label={`Remove pole ${i + 1}`} onClick={() => setPoles((ps) => ps.filter((x) => x.id !== p.id))}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button onClick={() => setPoles((ps) => [...ps, { id: nextId++, jtot: 0.5, parity: 1, energy: 1, channel: 1, width: 0.5 }])} className="text-xs">
                  <Plus className="w-3.5 h-3.5" />
                  Add pole
                </Button>
              </div>
            </details>

            {variables.length > 0 && (
              <details className="border-t border-slate-800 pt-2">
                <summary className="text-xs font-medium text-slate-300 cursor-pointer select-none">Bounds (optional)</summary>
                <table className="mt-2 w-full text-xs">
                  <tbody>
                    {variables.map((v) => {
                      const id = parameterId(v.param);
                      return (
                        <tr key={id}>
                          <td className="py-0.5 pr-2 text-slate-300">{labelOf(v.param)}</td>
                          <td className="py-0.5">{boundField(id, 'min')}</td>
                          <td className="py-0.5 pl-1">{boundField(id, 'max')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </details>
            )}
            <p className="text-xs text-slate-500">Greyed-out terms are zero in the deck; give them a starting value first.</p>
          </div>
        </Card>

        <Card>
          <div className="space-y-3">
            <Segmented
              label="Search"
              options={[
                { value: 'fit', label: 'Fit (MIGRAD)' },
                { value: 'scan', label: 'χ² scan' },
              ]}
              value={mode}
              onChange={(m) => {
                setMode(m);
                if (m === 'scan') pickScanVariable(Math.min(scan.index, Math.max(0, variables.length - 1)));
              }}
            />
            {mode === 'scan' && variables.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="col-span-2 sm:col-span-4">
                  <SelectField label="Scan" value={String(scan.index)} onChange={(v) => pickScanVariable(Number(v))}>
                    {variables.map((v, i) => (
                      <option key={parameterId(v.param)} value={i}>
                        {labelOf(v.param)}
                      </option>
                    ))}
                  </SelectField>
                </div>
                <NumField label="From" value={scan.from} onChange={(from) => setScan((s) => ({ ...s, from }))} />
                <NumField label="To" value={scan.to} onChange={(to) => setScan((s) => ({ ...s, to }))} />
                <NumField label="Step" min={0} value={scan.step} onChange={(step) => setScan((s) => ({ ...s, step }))} />
              </div>
            )}
            {mode === 'scan' && <p className="text-xs text-slate-500">χ²/N at each value, with the other parameters fixed at their starting values.</p>}
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={mode === 'fit' ? runFit : runScan}
                disabled={!!problem || isRunning || (mode === 'scan' && !(scan.step > 0 && scan.to > scan.from))}
                className="flex-1 py-2.5"
              >
                {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                {isRunning
                  ? `Running SFRESCO… ${elapsed.toFixed(0)} s`
                  : mode === 'fit'
                    ? `Fit ${variables.length} parameter${variables.length === 1 ? '' : 's'}`
                    : 'Scan χ²'}
              </Button>
              {isRunning && (
                <Button onClick={cancelSfresco} className="py-2.5" title="Stop SFRESCO">
                  <Square className="w-4 h-4" />
                  Stop
                </Button>
              )}
            </div>
            {problem && <p className="text-xs text-amber-300">{problem}</p>}
          </div>
        </Card>
      </div>

      <div ref={resultRef} className="lg:col-span-7 lg:sticky lg:top-20 space-y-4 scroll-mt-28">
        <Card title={scanResult ? 'χ² scan' : 'Fit'}>
          {error && (
            <div role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-rose-900 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="break-words">{error}</span>
            </div>
          )}
          {!outcome && !scanResult && !isRunning && (
            <p className="text-sm text-slate-400 py-6">
              SFRESCO (FRESCO with the MINUIT minimiser) varies the ticked parameters to minimise χ² between FRESCO and your data. Add one
              or more datasets, tick parameters and press Fit.
            </p>
          )}
          {isRunning && (
            <p className="text-sm text-slate-400 py-6 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              SFRESCO is running FRESCO repeatedly in this browser. Searches over several datasets or energies can take a few minutes.
            </p>
          )}

          {scanResult && !isRunning && (
            <div className="space-y-2">
              <p className="text-sm text-slate-300">
                Lowest χ²/N {Math.min(...scanResult.points.map((p) => p.chi2PerPoint)).toPrecision(4)} at {scanResult.label} ={' '}
                {scanResult.points.reduce((a, b) => (b.chi2PerPoint < a.chi2PerPoint ? b : a)).value}
              </p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={scanResult.points} margin={{ top: 8, right: 12, left: 4, bottom: 12 }}>
                    <CartesianGrid stroke="#1e293b" />
                    <XAxis dataKey="value" type="number" domain={['dataMin', 'dataMax']} stroke={AXIS} tick={{ fontSize: 11 }} label={{ value: scanResult.label, position: 'insideBottom', offset: -4, fill: AXIS, fontSize: 12 }} />
                    <YAxis scale="log" domain={['auto', 'auto']} allowDataOverflow stroke={AXIS} tick={{ fontSize: 11 }} width={60} tickFormatter={(v: number) => String(Number(v.toPrecision(2)))} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line dataKey="chi2PerPoint" name="χ²/N" stroke="#22d3ee" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {outcome && !scanResult && (
            <div className="space-y-4">
              <div
                role="status"
                className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs border ${
                  outcome.run.converged ? 'bg-emerald-950/40 text-emerald-300 border-emerald-900/60' : 'bg-amber-950/40 text-amber-200 border-amber-900/60'
                }`}
              >
                {outcome.run.converged ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                <span>
                  {outcome.run.status}. χ²/N {outcome.run.initialChi2PerPoint?.toPrecision(4) ?? '?'} → {outcome.run.finalChi2PerPoint?.toPrecision(4) ?? '?'} ·{' '}
                  {(outcome.run.elapsedMs / 1000).toFixed(1)} s{!outcome.run.converged && '. The values below are the best found; check them before using.'}
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
                  {outcome.variables.map((v, i) => {
                    const r = outcome.run.values[i];
                    const isS = v.param.kind === 'spectroscopic';
                    // S = A², σ_S = 2|A|σ_A
                    const value = isS ? r.value * r.value : r.value;
                    const err = isS ? 2 * Math.abs(r.value) * r.error : r.error;
                    const start = isS ? outcome.starting[i] ** 2 : outcome.starting[i];
                    return (
                      <tr key={parameterId(v.param)} className="border-t border-slate-800">
                        <td className="py-1 pr-2 text-slate-300">{labelOf(v.param)}</td>
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

              {outcome.run.comparison.map((after, i) => (
                <DatasetPlot key={i} index={i} draft={outcome.drafts[i]} before={outcome.run.before[i]} after={after} />
              ))}

              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={apply}>
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

/** Data with SFRESCO's theory at the data points, before and after the search. */
const DatasetPlot: React.FC<{ index: number; draft?: DatasetDraft; before?: DatasetComparison; after: DatasetComparison }> = ({ index, draft, before, after }) => {
  if (!draft || after.rows.length === 0) return null;
  const rows = after.rows.map((r, k) => ({ x: r.x, datum: r.datum, error: r.error, fitted: r.theory, start: before?.rows[k]?.theory }));
  const log = draft.type !== 'phase' && rows.every((r) => r.datum > 0 && r.fitted > 0);
  return (
    <div>
      <div className="text-xs text-slate-400 mb-1">
        Dataset {index + 1}: {TYPE_LABELS[draft.type]}
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 12, left: 4, bottom: 12 }}>
            <CartesianGrid stroke="#1e293b" />
            <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} stroke={AXIS} tick={{ fontSize: 11 }} label={{ value: X_LABEL[draft.type], position: 'insideBottom', offset: -4, fill: AXIS, fontSize: 12 }} />
            <YAxis scale={log ? 'log' : 'linear'} domain={['auto', 'auto']} allowDataOverflow stroke={AXIS} tick={{ fontSize: 11 }} width={60} tickFormatter={(v: number) => String(Number(v.toPrecision(3)))} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12 }} />
            {before && <Line dataKey="start" name="Before" stroke="#64748b" strokeDasharray="5 4" dot={false} isAnimationActive={false} />}
            <Line dataKey="fitted" name="Fitted" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Scatter dataKey="datum" name="Data" fill="#fbbf24" isAnimationActive={false}>
              <ErrorBar dataKey="error" direction="y" stroke="#fbbf24" width={3} />
            </Scatter>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
