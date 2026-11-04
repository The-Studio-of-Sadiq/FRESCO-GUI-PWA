import React from 'react';
import { FRESCODeckConfig } from '../types/fresco';

// Level scheme of the reaction: one column per partition, each state drawn at its
// energy relative to the entrance-channel ground state (excitation energy − Q), with
// arrows for the inelastic and transfer couplings.

const COLUMN = 150;
const GAP = 56;
const TOP = 50;
const BOTTOM = 26;
const PLOT_HEIGHT = 120;
const COLORS = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24'];

const spinLabel = (j: number, parity: number) => `${Number.isInteger(j) ? j : `${Math.round(j * 2)}/2`}${parity < 0 ? '−' : '+'}`;

export const ChannelDiagram: React.FC<{ config: FRESCODeckConfig }> = ({ config }) => {
  const columns = config.partitions.map((p, pi) => ({
    partition: p,
    x: pi * (COLUMN + GAP),
    states: config.states.filter((s) => s.partitionId === p.id).map((s) => ({ state: s, energy: s.excitationEnergy - p.qValue })),
  }));
  const energies = columns.flatMap((c) => c.states.map((s) => s.energy));
  const lo = Math.min(0, ...energies);
  const hi = Math.max(0, ...energies);
  const y = (e: number) => (hi === lo ? TOP + PLOT_HEIGHT / 2 : TOP + ((hi - e) / (hi - lo)) * PLOT_HEIGHT);
  const width = columns.length * COLUMN + (columns.length - 1) * GAP;
  const height = TOP + PLOT_HEIGHT + BOTTOM;

  const position = new Map<string, { x: number; y: number; column: number }>();
  columns.forEach((c, ci) => c.states.forEach((s) => position.set(s.state.id, { x: c.x, y: y(s.energy), column: ci })));

  return (
    <svg viewBox={`-6 0 ${width + 12} ${height}`} className="w-full h-auto" role="img" aria-label="Level scheme of the reaction channels and couplings">
      <defs>
        {['transfer', 'inelastic'].map((kind) => (
          <marker key={kind} id={`arrow-${kind}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={kind === 'transfer' ? '#fbbf24' : '#a78bfa'} />
          </marker>
        ))}
      </defs>

      {columns.map((c, ci) => (
        <g key={c.partition.id}>
          <text x={c.x + COLUMN / 2} y={16} textAnchor="middle" className="fill-slate-100" fontSize={15} fontWeight={600}>
            {c.partition.name}
          </text>
          <text x={c.x + COLUMN / 2} y={33} textAnchor="middle" className="fill-slate-500" fontSize={12}>
            {ci === 0 ? 'entrance' : `Q = ${c.partition.qValue} MeV`}
          </text>
          {c.states.map(({ state, energy }, si) => {
            const ly = y(energy);
            // Alternate label sides when levels sit close together
            const below = si > 0 && Math.abs(ly - y(c.states[si - 1].energy)) < 16 && si % 2 === 1;
            return (
              <g key={state.id}>
                <line x1={c.x + 14} x2={c.x + COLUMN - 14} y1={ly} y2={ly} stroke={COLORS[ci % COLORS.length]} strokeWidth={2.5} strokeLinecap="round" />
                <text x={c.x + 16} y={below ? ly + 13 : ly - 5} className="fill-slate-300" fontSize={13}>
                  {spinLabel(state.targetSpin, state.parity)}
                  {state.excitationEnergy !== 0 ? ` ${state.excitationEnergy} MeV` : ' g.s.'}
                </text>
                <text x={c.x + COLUMN - 16} y={below ? ly + 13 : ly - 5} textAnchor="end" className="fill-slate-500" fontSize={12}>
                  pot {state.potentialIndex + 1}
                </text>
              </g>
            );
          })}
        </g>
      ))}

      {config.couplings.map((cp) => {
        const a = position.get(cp.fromStateId);
        const b = position.get(cp.toStateId);
        if (!a || !b) return null;
        const transfer = cp.couplingType === 'transfer-dwba';
        const color = transfer ? '#fbbf24' : '#a78bfa';
        const label = transfer ? `S = ${cp.spectroscopicFactor}` : `λ=${cp.lambda}, β=${cp.beta}`;
        if (a.column === b.column) {
          // Inelastic: arc on the right of the column
          const x = a.x + COLUMN - 22;
          const bulge = Math.max(24, Math.abs(b.y - a.y) / 2);
          return (
            <g key={cp.id}>
              <path d={`M${x},${a.y} C${x + bulge},${a.y} ${x + bulge},${b.y} ${x},${b.y}`} fill="none" stroke={color} strokeWidth={1.5} markerEnd="url(#arrow-inelastic)" />
              <text x={x + bulge * 0.75 + 4} y={(a.y + b.y) / 2 + 4} className="fill-violet-300" fontSize={12}>
                {label}
              </text>
            </g>
          );
        }
        const [left, right] = a.x < b.x ? [a, b] : [b, a];
        const x1 = left.x + COLUMN - 10;
        const x2 = right.x + 10;
        const mid = (x1 + x2) / 2;
        return (
          <g key={cp.id}>
            <path
              d={`M${x1},${left.y} C${mid},${left.y} ${mid},${right.y} ${x2},${right.y}`}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
              markerEnd={a.x < b.x ? 'url(#arrow-transfer)' : undefined}
              markerStart={a.x < b.x ? undefined : 'url(#arrow-transfer)'}
            />
            <text x={mid} y={(left.y + right.y) / 2 - 7} textAnchor="middle" className="fill-amber-300" fontSize={12}>
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
