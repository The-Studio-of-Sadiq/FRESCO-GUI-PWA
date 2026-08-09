import React, { useState } from 'react';
import {
  FRESCODeckConfig,
  Partition,
  State,
  OpticalPotential,
  BoundState,
  ChannelCoupling,
} from '../types/fresco';
import { OPTICAL_MODEL_LIBRARY } from '../physics/opticalModels';
import { Plus, Trash2, Zap, HelpCircle, Layers, Shield, Sparkles } from 'lucide-react';

interface FrescoInputBuilderProps {
  config: FRESCODeckConfig;
  onChangeConfig: (newConfig: FRESCODeckConfig) => void;
  onRunSimulation: () => void;
}

export const FrescoInputBuilder: React.FC<FrescoInputBuilderProps> = ({
  config,
  onChangeConfig,
  onRunSimulation,
}) => {
  const [activeSection, setActiveSection] = useState<'kinematics' | 'partitions' | 'states' | 'potentials' | 'bound' | 'couplings'>('kinematics');

  const updateKinematics = (key: keyof FRESCODeckConfig, value: any) => {
    onChangeConfig({ ...config, [key]: value });
  };

  // Optical Model preset applier
  const applySystematicOpticalModel = (modelId: string, potIndex: number) => {
    const model = OPTICAL_MODEL_LIBRARY.find((m) => m.id === modelId);
    if (!model || config.partitions.length === 0) return;

    const p = config.partitions[0];
    const calculatedPot = model.calculate(
      p.target.massNumber,
      p.target.chargeNumber,
      p.projectile.massNumber,
      p.projectile.chargeNumber,
      config.eLab
    );

    const updatedPots = [...config.potentials];
    updatedPots[potIndex] = { ...calculatedPot, name: `${model.name} (${p.projectile.name} + ${p.target.name})` };
    onChangeConfig({ ...config, potentials: updatedPots });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 text-slate-100">
      {/* Bento Grid Top Banner & Section Selector */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-950 text-cyan-400 border border-cyan-800 rounded-lg">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              FRESCO Visual Bento Input Generator
              <span className="text-[10px] bg-slate-800 text-cyan-300 font-mono px-2 py-0.5 rounded border border-slate-700">
                NAMELIST MODE
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Coupled-channels kinematics, optical model potentials, and radial integration grid.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onRunSimulation}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg shadow-md shadow-cyan-950 flex items-center gap-2 cursor-pointer transition active:scale-95"
            id="builder-run-btn"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>RUN SIMULATION</span>
          </button>
        </div>
      </div>

      {/* Main Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Bento Column: Reaction Overview & Presets (col-span-3) */}
        <div className="lg:col-span-3 bg-slate-900/40 rounded-xl border border-slate-800 p-4 flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Reaction Modules
            </h3>
            <span className="text-[10px] font-mono text-cyan-400">CONFIG</span>
          </div>

          <div className="space-y-1.5 font-mono text-xs">
            <button
              onClick={() => setActiveSection('kinematics')}
              className={`w-full text-left p-2.5 rounded-lg border transition cursor-pointer flex items-center justify-between ${
                activeSection === 'kinematics'
                  ? 'bg-slate-800/90 border-cyan-500/50 text-cyan-300 font-bold shadow-sm'
                  : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/40'
              }`}
            >
              <span>1. Grid & Energy</span>
              <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">
                {config.eLab} MeV
              </span>
            </button>

            <button
              onClick={() => setActiveSection('partitions')}
              className={`w-full text-left p-2.5 rounded-lg border transition cursor-pointer flex items-center justify-between ${
                activeSection === 'partitions'
                  ? 'bg-slate-800/90 border-cyan-500/50 text-cyan-300 font-bold shadow-sm'
                  : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/40'
              }`}
            >
              <span>2. Partitions</span>
              <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-cyan-400">
                {config.partitions.length} Channels
              </span>
            </button>

            <button
              onClick={() => setActiveSection('potentials')}
              className={`w-full text-left p-2.5 rounded-lg border transition cursor-pointer flex items-center justify-between ${
                activeSection === 'potentials'
                  ? 'bg-slate-800/90 border-cyan-500/50 text-cyan-300 font-bold shadow-sm'
                  : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/40'
              }`}
            >
              <span>3. Potentials</span>
              <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-amber-400">
                {config.potentials.length} Sets
              </span>
            </button>

            <button
              onClick={() => setActiveSection('states')}
              className={`w-full text-left p-2.5 rounded-lg border transition cursor-pointer flex items-center justify-between ${
                activeSection === 'states'
                  ? 'bg-slate-800/90 border-cyan-500/50 text-cyan-300 font-bold shadow-sm'
                  : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/40'
              }`}
            >
              <span>4. States</span>
              <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">
                {config.states.length} Levels
              </span>
            </button>

            <button
              onClick={() => setActiveSection('bound')}
              className={`w-full text-left p-2.5 rounded-lg border transition cursor-pointer flex items-center justify-between ${
                activeSection === 'bound'
                  ? 'bg-slate-800/90 border-cyan-500/50 text-cyan-300 font-bold shadow-sm'
                  : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/40'
              }`}
            >
              <span>5. Bound Wavefns</span>
              <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">
                {config.boundStates.length} Form
              </span>
            </button>

            <button
              onClick={() => setActiveSection('couplings')}
              className={`w-full text-left p-2.5 rounded-lg border transition cursor-pointer flex items-center justify-between ${
                activeSection === 'couplings'
                  ? 'bg-slate-800/90 border-cyan-500/50 text-cyan-300 font-bold shadow-sm'
                  : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/40'
              }`}
            >
              <span>6. CRC Couplings</span>
              <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">
                {config.couplings.length} Links
              </span>
            </button>
          </div>

          {/* Preset Quick Loader */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
              Quick Benchmarks
            </span>
            {OPTICAL_MODEL_LIBRARY.slice(0, 3).map((lib) => (
              <div
                key={lib.id}
                onClick={() => applySystematicOpticalModel(lib.id, 0)}
                className="p-2 bg-slate-950/60 hover:bg-slate-800/50 rounded border border-slate-800 text-[11px] cursor-pointer transition flex items-center justify-between"
              >
                <span className="font-semibold text-slate-300">{lib.name}</span>
                <span className="text-[9px] text-cyan-400 font-mono">APPLY</span>
              </div>
            ))}
          </div>
        </div>

        {/* Center Bento Column: Input Generator Section (col-span-6) */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h2 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
              Input Generator: FRESCO Reaction Deck
            </h2>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
              TITLE: {config.title}
            </span>
          </div>

          {activeSection === 'kinematics' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-[10px] uppercase text-slate-400 font-bold">
                      Projectile (A, Z, Spin)
                    </span>
                    <div className="flex gap-1.5 mt-1">
                      <input
                        type="text"
                        value={config.partitions[0]?.projectile.name || 'p'}
                        onChange={(e) => {
                          const updated = [...config.partitions];
                          if (updated[0]) updated[0].projectile.name = e.target.value;
                          onChangeConfig({ ...config, partitions: updated });
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono text-white"
                        placeholder="Name"
                      />
                      <input
                        type="number"
                        value={config.partitions[0]?.projectile.massNumber || 1}
                        onChange={(e) => {
                          const updated = [...config.partitions];
                          if (updated[0]) updated[0].projectile.massNumber = parseInt(e.target.value) || 1;
                          onChangeConfig({ ...config, partitions: updated });
                        }}
                        className="w-16 bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono text-white"
                        placeholder="A"
                      />
                      <input
                        type="number"
                        value={config.partitions[0]?.projectile.chargeNumber || 1}
                        onChange={(e) => {
                          const updated = [...config.partitions];
                          if (updated[0]) updated[0].projectile.chargeNumber = parseInt(e.target.value) || 1;
                          onChangeConfig({ ...config, partitions: updated });
                        }}
                        className="w-16 bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono text-white"
                        placeholder="Z"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="text-[10px] uppercase text-slate-400 font-bold">
                      Target (A, Z, Spin)
                    </span>
                    <div className="flex gap-1.5 mt-1">
                      <input
                        type="text"
                        value={config.partitions[0]?.target.name || '40Ca'}
                        onChange={(e) => {
                          const updated = [...config.partitions];
                          if (updated[0]) updated[0].target.name = e.target.value;
                          onChangeConfig({ ...config, partitions: updated });
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono text-white"
                        placeholder="Name"
                      />
                      <input
                        type="number"
                        value={config.partitions[0]?.target.massNumber || 40}
                        onChange={(e) => {
                          const updated = [...config.partitions];
                          if (updated[0]) updated[0].target.massNumber = parseInt(e.target.value) || 40;
                          onChangeConfig({ ...config, partitions: updated });
                        }}
                        className="w-16 bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono text-white"
                        placeholder="A"
                      />
                      <input
                        type="number"
                        value={config.partitions[0]?.target.chargeNumber || 20}
                        onChange={(e) => {
                          const updated = [...config.partitions];
                          if (updated[0]) updated[0].target.chargeNumber = parseInt(e.target.value) || 20;
                          onChangeConfig({ ...config, partitions: updated });
                        }}
                        className="w-16 bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono text-white"
                        placeholder="Z"
                      />
                    </div>
                  </label>
                </div>

                <div className="space-y-3">
                  <label className="block">
                    <span className="text-[10px] uppercase text-slate-400 font-bold">
                      Beam Energy & Radial Grid
                    </span>
                    <div className="grid grid-cols-2 gap-1.5 mt-1">
                      <div>
                        <span className="text-[9px] text-slate-500 block">E_lab (MeV)</span>
                        <input
                          type="number"
                          step="0.1"
                          value={config.eLab}
                          onChange={(e) => updateKinematics('eLab', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono text-cyan-300"
                        />
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block">Step dr (fm)</span>
                        <input
                          type="number"
                          step="0.01"
                          value={config.dr}
                          onChange={(e) => updateKinematics('dr', parseFloat(e.target.value) || 0.05)}
                          className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono text-slate-300"
                        />
                      </div>
                    </div>
                  </label>

                  <label className="block">
                    <span className="text-[10px] uppercase text-slate-400 font-bold">
                      Angular Range θ (start, end, step)
                    </span>
                    <div className="grid grid-cols-3 gap-1 mt-1">
                      <input
                        type="number"
                        value={config.angleStart}
                        onChange={(e) => updateKinematics('angleStart', parseFloat(e.target.value) || 0)}
                        className="bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono text-white"
                      />
                      <input
                        type="number"
                        value={config.angleEnd}
                        onChange={(e) => updateKinematics('angleEnd', parseFloat(e.target.value) || 180)}
                        className="bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono text-white"
                      />
                      <input
                        type="number"
                        step="0.5"
                        value={config.angleStep}
                        onChange={(e) => updateKinematics('angleStep', parseFloat(e.target.value) || 1)}
                        className="bg-slate-950 border border-slate-800 rounded p-1.5 text-xs font-mono text-white"
                      />
                    </div>
                  </label>
                </div>
              </div>

              {/* Auto-compiler Hint Box */}
              <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] text-cyan-400 font-bold uppercase tracking-wider">
                    AUTO-COMPILER HINT
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">
                    Namelist parameters will compile dynamically into standard 80-column FRESCO card formats (`fresco.in`) on-the-fly for WASM execution.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'partitions' && (
            <div className="space-y-3">
              {config.partitions.map((p, idx) => (
                <div key={p.id} className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-cyan-400 font-bold font-mono">
                    <span>Partition #{idx + 1}: {p.name}</span>
                    <span>Q = {p.qValue} MeV</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                    <div>Projectile: <strong>{p.projectile.name}</strong> (A={p.projectile.massNumber}, Z={p.projectile.chargeNumber})</div>
                    <div>Target: <strong>{p.target.name}</strong> (A={p.target.massNumber}, Z={p.target.chargeNumber})</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'potentials' && (
            <div className="space-y-3">
              {config.potentials.map((pot, idx) => (
                <div key={pot.id} className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-amber-400 font-bold font-mono">
                    <span>Potential #{idx + 1}: {pot.name}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-slate-300">
                    <div>V0 = {pot.V0} MeV</div>
                    <div>W0 = {pot.W0} MeV</div>
                    <div>Wd = {pot.Wd} MeV</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(activeSection === 'states' || activeSection === 'bound' || activeSection === 'couplings') && (
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-2">
              <p className="font-semibold text-cyan-400">Section Active: {activeSection.toUpperCase()}</p>
              <p className="text-slate-400">
                Configure reaction channels, single-particle bound states, or CRC coupling terms.
              </p>
            </div>
          )}
        </div>

        {/* Right Bento Column: Potentials & Interactions (col-span-3) */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
              Potentials
            </h2>
            <span className="text-[10px] text-slate-500 font-mono">WOODS-SAXON</span>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto max-h-[260px] pr-1">
            {config.potentials.map((pot, pIdx) => (
              <div key={pot.id} className="text-[11px] font-mono p-2 bg-slate-950 rounded border border-slate-800/80 space-y-1">
                <div className="text-cyan-300 font-bold">TYPE={pIdx + 1} ({pot.name.slice(0, 18)})</div>
                <div className="text-slate-400">V={pot.V0} R={pot.r0} a={pot.a0}</div>
                <div className="text-slate-400">W={pot.W0} Ri={pot.rw} ai={pot.aw}</div>
                <div className="text-slate-400">Vso={pot.Vso} Rso={pot.rso} aso={pot.aso}</div>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              const newPot: OpticalPotential = {
                id: `pot_${Date.now()}`,
                name: `Potential ${config.potentials.length + 1}`,
                type: 'woods-saxon',
                V0: 50.0,
                r0: 1.25,
                a0: 0.65,
                W0: 10.0,
                rw: 1.25,
                aw: 0.65,
                Wd: 5.0,
                rd: 1.25,
                ad: 0.58,
                Vso: 6.0,
                rso: 1.1,
                aso: 0.6,
                rc: 1.25,
              };
              onChangeConfig({ ...config, potentials: [...config.potentials, newPot] });
            }}
            className="w-full py-2 border-dashed border border-slate-700 text-slate-400 hover:text-white text-[11px] font-mono rounded hover:bg-slate-800 cursor-pointer transition"
          >
            + ADD INTERACTION POTENTIAL
          </button>
        </div>
      </div>
    </div>
  );
};
