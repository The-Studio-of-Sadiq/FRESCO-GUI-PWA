import React from 'react';
import { FRESCODeckConfig } from '../types/fresco';
import { GitFork, ArrowRight, Shield } from 'lucide-react';

interface CouplingDiagramProps {
  config: FRESCODeckConfig;
}

export const CouplingDiagram: React.FC<CouplingDiagramProps> = ({ config }) => {
  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 text-slate-100">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
            <GitFork className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Nuclear Energy Levels & Channel Couplings</h2>
            <p className="text-xs text-slate-400">
              Coupled Reaction Channels (CRC) and DWBA transition matrix connections.
            </p>
          </div>
        </div>

        {/* Partition & Level Diagram Canvas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {config.partitions.map((p, pIdx) => {
            const partitionStates = config.states.filter((s) => s.partitionId === p.id || config.partitions.length === 1);
            return (
              <div key={p.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs uppercase font-bold text-cyan-400 tracking-wider">
                    Partition #{pIdx + 1}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    Q = {p.qValue} MeV
                  </span>
                </div>

                <div className="text-center py-2 bg-slate-900/80 rounded-xl border border-slate-800">
                  <h4 className="font-bold text-white text-base">
                    {p.projectile.name} + {p.target.name}
                  </h4>
                  <p className="text-xs text-slate-400">
                    (A={p.projectile.massNumber}, Z={p.projectile.chargeNumber}) + (A={p.target.massNumber}, Z={p.target.chargeNumber})
                  </p>
                </div>

                {/* Energy Levels */}
                <div className="space-y-2 pt-2">
                  <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Configured Energy States ({partitionStates.length})
                  </h5>
                  {partitionStates.map((st, stIdx) => (
                    <div
                      key={st.id}
                      className="bg-slate-900 border-l-4 border-l-cyan-400 border border-slate-800 rounded-xl p-3 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-white text-sm block">{st.name}</span>
                        <span className="text-xs text-slate-400">
                          E_ex = {st.excitationEnergy} MeV | J^π = {st.targetSpin}
                          {st.parity === 1 ? '⁺' : '⁻'}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-1 bg-slate-800 rounded text-cyan-300">
                        Pot #{st.potentialIndex + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bound States & Transfer Form Factors */}
        {config.boundStates.length > 0 && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" /> Bound Single-Particle Wavefunctions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {config.boundStates.map((bs) => (
                <div key={bs.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
                  <h4 className="font-bold text-white text-sm">{bs.name}</h4>
                  <div className="text-xs text-slate-300 grid grid-cols-2 gap-2">
                    <div>Core: <span className="font-mono text-cyan-300">{bs.coreName}</span></div>
                    <div>Valence: <span className="font-mono text-cyan-300">{bs.valenceName}</span></div>
                    <div>Binding E: <span className="font-mono text-cyan-300">{bs.bindingEnergy} MeV</span></div>
                    <div>Orbital L: <span className="font-mono text-cyan-300">{bs.orbitalL}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
