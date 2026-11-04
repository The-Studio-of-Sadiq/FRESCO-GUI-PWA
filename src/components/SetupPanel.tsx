import React, { useState } from 'react';
import { Play, Plus, Trash2 } from 'lucide-react';
import { FRESCODeckConfig, Nucleus, OpticalPotential, Partition } from '../types/fresco';
import { PRESET_REACTIONS } from '../physics/presets';
import { OPTICAL_MODEL_LIBRARY } from '../physics/opticalModels';
import { Button, Card, NumField, SelectField, TextField } from './ui';
import { ChannelsEditor } from './ChannelsEditor';

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
  const selectedPot = config.potentials.indexOf(pot);
  const potentialUsers = (idx: number) => [
    ...config.states.filter((s) => s.potentialIndex === idx).map((s) => s.name),
    ...config.boundStates.filter((b) => b.potentialIndex === idx).map((b) => b.name),
  ];

  const set =<K extends keyof FRESCODeckConfig>(key: K, value: FRESCODeckConfig[K]) => onChange({ ...config, [key]: value });

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

  const addPotential = () => {
    const copy: OpticalPotential = { ...pot, id: `pot_${Date.now()}`, name: `Potential ${config.potentials.length + 1}` };
    set('potentials', [...config.potentials, copy]);
    setPotIndex(config.potentials.length);
  };

  // Only unused potentials can be deleted; later indices shift down by one.
  const deletePotential = () => {
    const idx = selectedPot;
    const shift = (i: number) => (i > idx ? i - 1 : i);
    onChange({
      ...config,
      potentials: config.potentials.filter((_, i) => i !== idx),
      states: config.states.map((s) => ({ ...s, potentialIndex: shift(s.potentialIndex) })),
      boundStates: config.boundStates.map((b) => ({ ...b, potentialIndex: shift(b.potentialIndex) })),
    });
    setPotIndex(Math.max(0, idx - 1));
  };

  const potentialOptions = config.potentials.map((p, i) => (
    <option key={p.id} value={i}>
      {i + 1}. {p.name}
    </option>
  ));

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
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <SelectField label="Potential" value={String(selectedPot)} onChange={(v) => setPotIndex(Number(v))}>
                  {potentialOptions}
                </SelectField>
              </div>
              <Button onClick={addPotential} title="Add a potential, starting from a copy of this one" aria-label="Add potential" className="px-2.5 h-[34px]">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add</span>
              </Button>
              <Button
                onClick={deletePotential}
                disabled={config.potentials.length <= 1 || potentialUsers(selectedPot).length > 0}
                title={
                  potentialUsers(selectedPot).length > 0
                    ? `Used by ${potentialUsers(selectedPot).join(', ')}: assign another potential to them first`
                    : 'Delete this potential'
                }
                aria-label="Delete potential"
                className="px-2.5 h-[34px]"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <TextField label="Name" value={pot.name} onChange={(name) => updatePotential({ name })} />
            {potentialUsers(selectedPot).length === 0 && (
              <p className="text-xs text-amber-300">Not used yet: assign it to a state under Channels & couplings.</p>
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

      <ChannelsEditor config={config} onChange={onChange} onOpenDeck={onOpenDeck} />

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
