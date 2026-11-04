import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { BoundState, ChannelCoupling, FRESCODeckConfig, Nucleus, Partition, State } from '../types/fresco';
import { Button, Card, NumField, SelectField, TextField } from './ui';
import { ChannelDiagram } from './ChannelDiagram';

// Edits the reaction channels: partitions (mass partitions), their states, the
// single-particle bound states used by transfers, and the couplings between states.

interface ChannelsEditorProps {
  config: FRESCODeckConfig;
  onChange: (config: FRESCODeckConfig) => void;
  onOpenDeck: () => void;
}

const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const RemoveButton: React.FC<{ label: string; onClick: () => void; disabled?: boolean; title?: string }> = ({ label, onClick, disabled, title }) => (
  <Button variant="ghost" onClick={onClick} disabled={disabled} aria-label={label} title={title ?? label} className="px-2 h-[34px] shrink-0">
    <Trash2 className="w-4 h-4" />
  </Button>
);

const Section: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, action, children }) => (
  <div className="border-t border-slate-800 pt-3 space-y-2">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      {action}
    </div>
    {children}
  </div>
);

export const ChannelsEditor: React.FC<ChannelsEditorProps> = ({ config, onChange, onOpenDeck }) => {
  const potentialOptions = config.potentials.map((p, i) => (
    <option key={p.id} value={i}>
      {i + 1}. {p.name}
    </option>
  ));
  const stateLabel = (s: State) => {
    const pi = config.partitions.findIndex((p) => p.id === s.partitionId);
    return `${config.partitions[pi]?.name ?? '?'} · ${s.name}`;
  };

  const updatePartition = (id: string, patch: Partial<Partition>) =>
    onChange({ ...config, partitions: config.partitions.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const updateNucleus = (p: Partition, which: 'projectile' | 'target', patch: Partial<Nucleus>) => {
    const states =
      patch.spin === undefined
        ? config.states
        : config.states.map((s, i) =>
            s.partitionId === p.id && (which === 'projectile' || config.states.findIndex((x) => x.partitionId === p.id) === i)
              ? { ...s, [which === 'projectile' ? 'projectileSpin' : 'targetSpin']: patch.spin! }
              : s,
          );
    onChange({ ...config, partitions: config.partitions.map((x) => (x.id === p.id ? { ...x, [which]: { ...x[which], ...patch } } : x)), states });
  };
  const updateState = (id: string, patch: Partial<State>) => onChange({ ...config, states: config.states.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const updateBound = (id: string, patch: Partial<BoundState>) =>
    onChange({ ...config, boundStates: config.boundStates.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  const updateCoupling = (id: string, patch: Partial<ChannelCoupling>) =>
    onChange({ ...config, couplings: config.couplings.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const addPartition = () => {
    const entrance = config.partitions[0];
    const id = uid('p');
    const partition: Partition = { id, name: `Partition ${config.partitions.length + 1}`, projectile: { ...entrance.projectile }, target: { ...entrance.target }, qValue: 0 };
    const ground: State = {
      id: uid('s'),
      partitionId: id,
      name: 'Ground state',
      excitationEnergy: 0,
      projectileSpin: partition.projectile.spin,
      targetSpin: partition.target.spin,
      parity: partition.target.parity,
      potentialIndex: 0,
    };
    onChange({ ...config, partitions: [...config.partitions, partition], states: [...config.states, ground] });
  };

  const removePartition = (id: string) => {
    const gone = new Set(config.states.filter((s) => s.partitionId === id).map((s) => s.id));
    onChange({
      ...config,
      partitions: config.partitions.filter((p) => p.id !== id),
      states: config.states.filter((s) => !gone.has(s.id)),
      couplings: config.couplings.filter((c) => !gone.has(c.fromStateId) && !gone.has(c.toStateId)),
    });
  };

  const addState = (p: Partition) => {
    const own = config.states.filter((s) => s.partitionId === p.id);
    const state: State = {
      id: uid('s'),
      partitionId: p.id,
      name: `Excited state ${own.length}`,
      excitationEnergy: 1,
      projectileSpin: p.projectile.spin,
      targetSpin: 2,
      parity: 1,
      potentialIndex: own[0]?.potentialIndex ?? 0,
    };
    // keep each partition's states together, in FRESCO's order
    const lastIndex = config.states.map((s) => s.partitionId).lastIndexOf(p.id);
    const states = [...config.states];
    states.splice(lastIndex + 1, 0, state);
    onChange({ ...config, states });
  };

  const removeState = (id: string) =>
    onChange({ ...config, states: config.states.filter((s) => s.id !== id), couplings: config.couplings.filter((c) => c.fromStateId !== id && c.toStateId !== id) });

  const addBound = () => {
    const core = config.partitions[0]?.target.name ?? 'core';
    const bound: BoundState = {
      id: uid('bs'),
      name: `Bound state ${config.boundStates.length + 1}`,
      coreName: core,
      valenceName: 'n',
      bindingEnergy: 5,
      orbitalL: 0,
      totalJ: 0.5,
      nodes: 0,
      potentialIndex: config.potentials.length - 1,
      searchV0: true,
    };
    onChange({ ...config, boundStates: [...config.boundStates, bound] });
  };

  const addCoupling = (type: ChannelCoupling['couplingType']) => {
    const first = config.states[0];
    const other =
      type === 'transfer-dwba'
        ? config.states.find((s) => s.partitionId !== first?.partitionId)
        : config.states.find((s) => s.partitionId === first?.partitionId && s.id !== first?.id);
    if (!first || !other) return;
    const coupling: ChannelCoupling = {
      id: uid('c'),
      fromStateId: first.id,
      toStateId: other.id,
      couplingType: type,
      lambda: type === 'transfer-dwba' ? 0 : 2,
      beta: type === 'transfer-dwba' ? 0 : 0.1,
      spectroscopicFactor: 1,
      boundStateId: type === 'transfer-dwba' ? config.boundStates[0]?.id : undefined,
    };
    onChange({ ...config, couplings: [...config.couplings, coupling] });
  };

  const canInelastic = config.partitions.some((p) => config.states.filter((s) => s.partitionId === p.id).length > 1);
  const canTransfer = config.partitions.length > 1;

  return (
    <Card
      title="Channels & couplings"
      actions={
        <button type="button" onClick={onOpenDeck} className="text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer">
          Input deck
        </button>
      }
    >
      <div className="space-y-3">
        <ChannelDiagram config={config} />

        <Section
          title="Partitions & states"
          action={
            <Button onClick={addPartition} className="text-xs px-2 py-1">
              <Plus className="w-3.5 h-3.5" /> Partition
            </Button>
          }
        >
          {config.partitions.map((p, pi) => {
            const states = config.states.filter((s) => s.partitionId === p.id);
            return (
              <div key={p.id} className="rounded-lg border border-slate-800 p-2.5 space-y-2">
                <div className="flex items-end gap-2">
                  <div className="flex-1 min-w-0">
                    <TextField label={pi === 0 ? 'Entrance partition' : `Partition ${pi + 1}`} value={p.name} onChange={(name) => updatePartition(p.id, { name })} />
                  </div>
                  {pi > 0 && (
                    <div className="w-24">
                      <NumField label="Q" unit="MeV" step={0.1} value={p.qValue} onChange={(qValue) => updatePartition(p.id, { qValue })} />
                    </div>
                  )}
                  {pi > 0 && <RemoveButton label={`Remove partition ${pi + 1}`} onClick={() => removePartition(p.id)} />}
                </div>
                {pi > 0 &&
                  (['projectile', 'target'] as const).map((which) => (
                    <div key={which} className="grid grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] gap-2">
                      <TextField label={which === 'projectile' ? 'Projectile' : 'Target'} value={p[which].name} onChange={(name) => updateNucleus(p, which, { name })} />
                      <NumField label="A" step={1} min={1} value={p[which].massNumber} onChange={(massNumber) => updateNucleus(p, which, { massNumber })} />
                      <NumField label="Z" step={1} min={0} value={p[which].chargeNumber} onChange={(chargeNumber) => updateNucleus(p, which, { chargeNumber })} />
                      <NumField label="Spin" step={0.5} min={0} value={p[which].spin} onChange={(spin) => updateNucleus(p, which, { spin })} />
                    </div>
                  ))}

                {states.map((s, si) => (
                  <div key={s.id} className="space-y-2 border-t border-slate-800/70 pt-2">
                    <div className="flex items-end gap-2">
                      <div className="flex-1 min-w-0">
                        <TextField label={si === 0 ? 'Target ground state' : `Target state ${si + 1}`} value={s.name} onChange={(name) => updateState(s.id, { name })} />
                      </div>
                      <RemoveButton label={`Remove ${s.name}`} disabled={states.length <= 1} title={states.length <= 1 ? 'A partition needs at least one state' : undefined} onClick={() => removeState(s.id)} />
                    </div>
                    <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,2fr)] gap-2">
                      <NumField label="Eₓ" unit="MeV" step={0.1} min={0} value={s.excitationEnergy} onChange={(excitationEnergy) => updateState(s.id, { excitationEnergy })} />
                      <NumField label="J" step={0.5} min={0} value={s.targetSpin} onChange={(targetSpin) => updateState(s.id, { targetSpin })} />
                      <SelectField label="π" value={String(s.parity)} onChange={(v) => updateState(s.id, { parity: Number(v) as 1 | -1 })}>
                        <option value="1">+</option>
                        <option value="-1">−</option>
                      </SelectField>
                      <SelectField label="Potential" value={String(s.potentialIndex)} onChange={(v) => updateState(s.id, { potentialIndex: Number(v) })}>
                        {potentialOptions}
                      </SelectField>
                    </div>
                  </div>
                ))}
                <Button variant="ghost" onClick={() => addState(p)} className="text-xs px-2 py-1">
                  <Plus className="w-3.5 h-3.5" /> Excited state
                </Button>
              </div>
            );
          })}
        </Section>

        <Section
          title="Bound states (transfer)"
          action={
            <Button onClick={addBound} className="text-xs px-2 py-1">
              <Plus className="w-3.5 h-3.5" /> Bound state
            </Button>
          }
        >
          {config.boundStates.length === 0 && <p className="text-xs text-slate-500">None. Transfers need the bound state of the transferred nucleon.</p>}
          {config.boundStates.map((b) => (
            <div key={b.id} className="rounded-lg border border-slate-800 p-2.5 space-y-2">
              <div className="flex items-end gap-2">
                <div className="flex-1 min-w-0">
                  <TextField label="Name" value={b.name} onChange={(name) => updateBound(b.id, { name })} />
                </div>
                <RemoveButton
                  label={`Remove ${b.name}`}
                  onClick={() =>
                    onChange({
                      ...config,
                      boundStates: config.boundStates.filter((x) => x.id !== b.id),
                      couplings: config.couplings.map((c) => (c.boundStateId === b.id ? { ...c, boundStateId: undefined } : c)),
                    })
                  }
                />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <NumField label="BE (MeV)" step={0.01} value={b.bindingEnergy} onChange={(bindingEnergy) => updateBound(b.id, { bindingEnergy })} hint="Binding energy" />
                <NumField label="ℓ" step={1} min={0} value={b.orbitalL} onChange={(orbitalL) => updateBound(b.id, { orbitalL: Math.round(orbitalL) })} />
                <NumField label="j" step={0.5} min={0.5} value={b.totalJ} onChange={(totalJ) => updateBound(b.id, { totalJ })} />
                <NumField label="Nodes" step={1} min={0} value={b.nodes} onChange={(nodes) => updateBound(b.id, { nodes: Math.round(nodes) })} hint="Radial nodes, not counting the origin" />
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
                <SelectField label="Binding potential" value={String(b.potentialIndex)} onChange={(v) => updateBound(b.id, { potentialIndex: Number(v) })}>
                  {potentialOptions}
                </SelectField>
                <label className="flex items-center gap-1.5 text-xs text-slate-300 pb-2 cursor-pointer" title="Scale the real depth to reproduce the binding energy">
                  <input type="checkbox" className="accent-cyan-500" checked={b.searchV0} onChange={(e) => updateBound(b.id, { searchV0: e.target.checked })} />
                  Fit depth to BE
                </label>
              </div>
            </div>
          ))}
        </Section>

        <Section
          title="Couplings"
          action={
            <span className="flex gap-1">
              <Button onClick={() => addCoupling('inelastic-multipole')} disabled={!canInelastic} title={canInelastic ? undefined : 'Add an excited state first'} className="text-xs px-2 py-1">
                <Plus className="w-3.5 h-3.5" /> Inelastic
              </Button>
              <Button onClick={() => addCoupling('transfer-dwba')} disabled={!canTransfer} title={canTransfer ? undefined : 'Add a second partition first'} className="text-xs px-2 py-1">
                <Plus className="w-3.5 h-3.5" /> Transfer
              </Button>
            </span>
          }
        >
          {config.couplings.length === 0 && <p className="text-xs text-slate-500">None: elastic scattering only.</p>}
          {config.couplings.map((c) => {
            const transfer = c.couplingType === 'transfer-dwba';
            const from = config.states.find((s) => s.id === c.fromStateId);
            const toOptions = config.states.filter((s) => (transfer ? s.partitionId !== from?.partitionId : s.partitionId === from?.partitionId && s.id !== from?.id));
            return (
              <div key={c.id} className="rounded-lg border border-slate-800 p-2.5 space-y-2">
                <div className="flex items-end gap-2">
                  <span className={`text-xs font-medium pb-2 ${transfer ? 'text-amber-300' : 'text-violet-300'}`}>{transfer ? 'Transfer' : 'Inelastic (rotor)'}</span>
                  <span className="flex-1" />
                  <RemoveButton label="Remove coupling" onClick={() => onChange({ ...config, couplings: config.couplings.filter((x) => x.id !== c.id) })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <SelectField label="From" value={c.fromStateId} onChange={(v) => updateCoupling(c.id, { fromStateId: v })}>
                    {config.states.map((s) => (
                      <option key={s.id} value={s.id}>
                        {stateLabel(s)}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField label="To" value={c.toStateId} onChange={(v) => updateCoupling(c.id, { toStateId: v })}>
                    {[...toOptions, ...(toOptions.some((s) => s.id === c.toStateId) ? [] : config.states.filter((s) => s.id === c.toStateId))].map((s) => (
                      <option key={s.id} value={s.id}>
                        {stateLabel(s)}
                      </option>
                    ))}
                  </SelectField>
                </div>
                {transfer ? (
                  <div className="grid grid-cols-[minmax(0,0.6fr)_minmax(0,1.4fr)] gap-2">
                    <NumField label="S" step={0.01} min={0} value={c.spectroscopicFactor} onChange={(spectroscopicFactor) => updateCoupling(c.id, { spectroscopicFactor })} hint="Spectroscopic factor" />
                    <SelectField label="Bound state" value={c.boundStateId ?? config.boundStates[0]?.id ?? ''} onChange={(v) => updateCoupling(c.id, { boundStateId: v })}>
                      {config.boundStates.length === 0 && <option value="">Add a bound state</option>}
                      {config.boundStates.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <NumField label="Multipole λ" step={1} min={1} value={c.lambda} onChange={(lambda) => updateCoupling(c.id, { lambda: Math.round(lambda) })} />
                    <NumField label="Deformation β" step={0.01} value={c.beta} onChange={(beta) => updateCoupling(c.id, { beta })} />
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-xs text-slate-500">
            Transfers use the zero-range approximation for (d,p)-type reactions; inelastic couplings use FRESCO's rotational model, with
            Coulomb and nuclear deformation. For other coupling schemes edit the input deck.
          </p>
        </Section>
      </div>
    </Card>
  );
};
