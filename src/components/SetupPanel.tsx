import React, { useState } from 'react';
import { Play } from 'lucide-react';
import { FRESCODeckConfig, Nucleus, OpticalPotential, Partition } from '../types/fresco';
import { PRESET_REACTIONS } from '../physics/presets';
import { OPTICAL_MODEL_LIBRARY } from '../physics/opticalModels';
import { Button, Card, NumField, SelectField, TextField } from './ui';

interface SetupPanelProps {
  config: FRESCODeckConfig;
  onChange: (config: FRESCODeckConfig) => void;
  presetId: string | null;
  onLoadPreset: (id: string) => void;
  onRun: () => void;
  isRunning: boolean;
  onOpenDeck: () => void;
}

const POTENTIAL_TERMS: { label: string; keys: [keyof OpticalPotential, keyof OpticalPotential, keyof OpticalPotential] }[] = [
  { label: 'Real volume', keys: ['V0', 'r0', 'a0'] },
  { label: 'Imaginary volume', keys: ['W0', 'rw', 'aw'] },
  { label: 'Imaginary surface', keys: ['Wd', 'rd', 'ad'] },
  { label: 'Spin-orbit', keys: ['Vso', 'rso', 'aso'] },
];

export const SetupPanel: React.FC<SetupPanelProps> = ({ config, onChange, presetId, onLoadPreset, onRun, isRunning, onOpenDeck }) => {
  const [potIndex, setPotIndex] = useState(0);
  const entrance = config.partitions[0];
  const pot = config.potentials[Math.min(potIndex, config.potentials.length - 1)];
  const preset = PRESET_REACTIONS.find((p) => p.id === presetId);
  const hasChannels =
    config.partitions.length > 1 || config.states.length > 1 || config.boundStates.length > 0 || config.couplings.length > 0;

  const set = <K extends keyof FRESCODeckConfig>(key: K, value: FRESCODeckConfig[K]) => onChange({ ...config, [key]: value });

  // Edits to the entrance partition; spins are mirrored into its first state.
  const updateNucleus = (which: 'projectile' | 'target', patch: Partial<Nucleus>) => {
    if (!entrance) return;
    const updated: Partition = { ...entrance, [which]: { ...entrance[which], ...patch } };
    const firstState = config.states.findIndex((s) => s.partitionId === entrance.id);
    const states =
      patch.spin === undefined || firstState < 0
        ? config.states
        : config.states.map((s, i) =>
            i === firstState ? { ...s, [which === 'projectile' ? 'projectileSpin' : 'targetSpin']: patch.spin! } : s,
          );
    onChange({ ...config, partitions: config.partitions.map((p, i) => (i === 0 ? updated : p)), states });
  };

  const updatePotential = (patch: Partial<OpticalPotential>) => {
    const idx = config.potentials.indexOf(pot);
    set('potentials', config.potentials.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const applyGlobalModel = (modelId: string) => {
    const model = OPTICAL_MODEL_LIBRARY.find((m) => m.id === modelId);
    if (!model || !entrance) return;
    const { target: t, projectile: p } = entrance;
    const calculated = model.calculate(t.massNumber, t.chargeNumber, p.massNumber, p.chargeNumber, config.eLab);
    updatePotential({ ...calculated, id: pot.id, name: `${model.name} (${p.name} + ${t.name})` });
  };

  return (
    <div className="space-y-4">
      <Card title="Reaction">
        <div className="space-y-3">
          <SelectField label="Start from an example" value={presetId ?? ''} onChange={onLoadPreset}>
            <option value="" disabled>
              Custom setup
            </option>
            {PRESET_REACTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </SelectField>
          {preset && <p className="text-xs text-slate-400 leading-relaxed">{preset.description}</p>}

          <TextField label="Title" value={config.title} onChange={(v) => set('title', v)} />

          {entrance && (
            <div className="space-y-2">
              {(['projectile', 'target'] as const).map((which) => {
                const n = entrance[which];
                return (
                  <fieldset key={which} className="grid grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] gap-2 min-w-0">
                    <legend className="sr-only">{which}</legend>
                    <TextField
                      label={which === 'projectile' ? 'Projectile' : 'Target'}
                      value={n.name}
                      onChange={(name) => updateNucleus(which, { name })}
                    />
                    <NumField label="A" step={1} min={1} value={n.massNumber} onChange={(massNumber) => updateNucleus(which, { massNumber })} hint="Mass number" />
                    <NumField label="Z" step={1} min={0} value={n.chargeNumber} onChange={(chargeNumber) => updateNucleus(which, { chargeNumber })} hint="Charge" />
                    <NumField label="Spin" step={0.5} min={0} value={n.spin} onChange={(spin) => updateNucleus(which, { spin })} hint="Ground-state spin" />
                  </fieldset>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <NumField label="E lab" unit="MeV" step={0.1} min={0} value={config.eLab} onChange={(v) => set('eLab', v)} hint="Beam energy in the laboratory frame" />
            </div>
            <NumField label="θ from" unit="deg" step={1} min={0} value={config.angleStart} onChange={(v) => set('angleStart', v)} />
            <NumField label="θ to" unit="deg" step={1} min={0} value={config.angleEnd} onChange={(v) => set('angleEnd', v)} />
            <NumField label="θ step" unit="deg" step={0.5} min={0} value={config.angleStep} onChange={(v) => set('angleStep', v)} />
          </div>
        </div>
      </Card>

      {pot && (
        <Card title="Optical potential" actions={<span className="text-xs text-slate-500">Woods-Saxon, R = r₀·A<sub>t</sub><sup>1/3</sup></span>}>
          <div className="space-y-3">
            {config.potentials.length > 1 && (
              <SelectField label="Potential" value={String(config.potentials.indexOf(pot))} onChange={(v) => setPotIndex(Number(v))}>
                {config.potentials.map((p, i) => (
                  <option key={p.id} value={i}>
                    {i + 1}. {p.name}
                  </option>
                ))}
              </SelectField>
            )}
            <SelectField label="Fill from a global model" value="" onChange={applyGlobalModel}>
              <option value="" disabled>
                {pot.name}
              </option>
              {OPTICAL_MODEL_LIBRARY.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </SelectField>

            <div className="space-y-2.5">
              {POTENTIAL_TERMS.map(({ label, keys: [depth, radius, diffuseness] }) => (
                <div key={label}>
                  <div className="text-xs font-medium text-slate-300 mb-1">{label}</div>
                  <div className="grid grid-cols-3 gap-2">
                    <NumField label="Depth" unit="MeV" step={0.1} value={pot[depth] as number} onChange={(v) => updatePotential({ [depth]: v })} />
                    <NumField label="r₀" unit="fm" step={0.01} min={0} value={pot[radius] as number} onChange={(v) => updatePotential({ [radius]: v })} />
                    <NumField label="a" unit="fm" step={0.01} min={0} value={pot[diffuseness] as number} onChange={(v) => updatePotential({ [diffuseness]: v })} />
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-2">
                <NumField label="Coulomb r₀" unit="fm" step={0.01} min={0} value={pot.rc} onChange={(rc) => updatePotential({ rc })} />
              </div>
            </div>
          </div>
        </Card>
      )}

      {hasChannels && (
        <Card
          title="Channels & couplings"
          actions={
            <button type="button" onClick={onOpenDeck} className="text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer">
              Edit in input deck
            </button>
          }
        >
          <ul className="space-y-2 text-sm">
            {config.partitions.map((p, i) => (
              <li key={p.id} className="text-slate-300">
                <span className="text-slate-500">{i === 0 ? 'Entrance' : `Partition ${i + 1}`}:</span> {p.name}
                {p.qValue !== 0 && <span className="text-slate-500"> · Q = {p.qValue} MeV</span>}
                <ul className="mt-0.5 ml-4 text-xs text-slate-400 list-disc">
                  {config.states
                    .filter((s) => s.partitionId === p.id)
                    .map((s) => (
                      <li key={s.id}>
                        {s.name}
                        {s.excitationEnergy !== 0 && ` · ${s.excitationEnergy} MeV`} · potential {s.potentialIndex + 1}
                      </li>
                    ))}
                </ul>
              </li>
            ))}
            {config.boundStates.map((b) => (
              <li key={b.id} className="text-slate-300">
                <span className="text-slate-500">Bound state:</span> {b.name}
                <span className="text-slate-500">
                  {' '}
                  · BE = {b.bindingEnergy} MeV, ℓ = {b.orbitalL}, j = {b.totalJ}
                </span>
              </li>
            ))}
            {config.couplings.map((c) => {
              const from = config.states.find((s) => s.id === c.fromStateId);
              const to = config.states.find((s) => s.id === c.toStateId);
              return (
                <li key={c.id} className="text-slate-300">
                  <span className="text-slate-500">{c.couplingType === 'transfer-dwba' ? 'Transfer' : 'Inelastic'}:</span>{' '}
                  {from?.name ?? '?'} → {to?.name ?? '?'}
                  <span className="text-slate-500">
                    {' '}
                    · {c.couplingType === 'transfer-dwba' ? `S = ${c.spectroscopicFactor}` : `λ = ${c.lambda}, β = ${c.beta}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <details className="group bg-slate-900 border border-slate-800 rounded-xl">
        <summary className="px-4 py-3 text-sm font-semibold text-slate-100 cursor-pointer select-none list-none flex items-center justify-between">
          Numerical settings
          <span className="text-xs font-normal text-slate-500 group-open:hidden">
            step {config.dr} fm · R<sub>match</sub> {config.rmatch} fm · L<sub>max</sub> {config.lmax}
          </span>
        </summary>
        <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <NumField label="Radial step" unit="fm" step={0.005} min={0.001} value={config.dr} onChange={(v) => set('dr', v)} hint="FRESCO hcm" />
          <NumField label="Matching radius" unit="fm" step={1} min={1} value={config.rmatch} onChange={(v) => set('rmatch', v)} hint="FRESCO rmatch" />
          <NumField label="Max radius" unit="fm" step={1} min={1} value={config.rmax} onChange={(v) => set('rmax', v)} />
          <NumField label="Max partial wave" unit="L" step={1} min={0} value={config.lmax} onChange={(v) => set('lmax', Math.round(v))} hint="Sets FRESCO jtmax" />
        </div>
      </details>

      <Button variant="primary" onClick={onRun} disabled={isRunning} className="w-full py-2.5">
        <Play className="w-4 h-4 fill-current" />
        {isRunning ? 'Running FRESCO…' : 'Run FRESCO'}
      </Button>
    </div>
  );
};
