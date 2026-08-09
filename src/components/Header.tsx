import React from 'react';
import {
  Atom,
  Play,
  FileCode,
  Sliders,
  LineChart,
  GitFork,
  History,
  CloudUpload,
  BookOpen,
  Sparkles,
  Download,
  Code,
} from 'lucide-react';
import { PRESET_REACTIONS } from '../physics/presets';
import { PresetReaction } from '../types/fresco';

interface HeaderProps {
  activeTab: 'builder' | 'editor' | 'plotter' | 'fitter' | 'couplings' | 'render' | 'manual' | 'fortran';
  setActiveTab: (tab: 'builder' | 'editor' | 'plotter' | 'fitter' | 'couplings' | 'render' | 'manual' | 'fortran') => void;
  onSelectPreset: (preset: PresetReaction) => void;
  onRunSimulation: () => void;
  isSimulating: boolean;
  onOpenHistory: () => void;
  onExportDeck: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onSelectPreset,
  onRunSimulation,
  isSimulating,
  onOpenHistory,
  onExportDeck,
}) => {
  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 text-slate-100 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center font-bold text-slate-950 shadow-md shadow-cyan-500/20 font-mono text-base">
              F
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-base text-white tracking-tight flex items-center">
                  FRESCO <span className="text-cyan-400 font-mono text-xs ml-1.5 font-normal">v4.2-SIM</span>
                </h1>
                <div className="hidden md:flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-800/80 rounded-full text-[10px] font-mono border border-slate-700 text-slate-300">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                  <span>WASM ENGINE ACTIVE</span>
                </div>
              </div>
            </div>
          </div>

          {/* Preset Reaction Dropdown & Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Reaction Benchmark Presets */}
            <div className="relative">
              <select
                onChange={(e) => {
                  const preset = PRESET_REACTIONS.find((p) => p.id === e.target.value);
                  if (preset) onSelectPreset(preset);
                }}
                defaultValue=""
                className="bg-slate-800/90 text-xs text-slate-200 border border-slate-700/80 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer hover:bg-slate-750 transition font-mono"
                id="preset-reaction-select"
              >
                <option value="" disabled>
                  ⚡ Select Reaction Preset...
                </option>
                {PRESET_REACTIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.category}] {p.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Run Simulation Button */}
            <button
              onClick={onRunSimulation}
              disabled={isSimulating}
              id="run-simulation-btn"
              className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-md shadow-cyan-950 border border-cyan-300/30 transition disabled:opacity-50 cursor-pointer active:scale-95"
            >
              <Play className={`w-3.5 h-3.5 fill-current ${isSimulating ? 'animate-spin' : ''}`} />
              <span>{isSimulating ? 'RUNNING...' : 'RUN SIMULATION'}</span>
            </button>

            {/* Export Deck Button */}
            <button
              onClick={onExportDeck}
              title="Download fresco.in Input Deck"
              className="p-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition cursor-pointer"
              id="export-deck-btn"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Run History Button */}
            <button
              onClick={onOpenHistory}
              title="Saved Run History"
              className="p-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition cursor-pointer"
              id="open-history-btn"
            >
              <History className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation Ribbon */}
        <div className="flex items-center gap-1 overflow-x-auto py-1.5 border-t border-slate-800/80 text-xs scrollbar-none">
          <button
            onClick={() => setActiveTab('builder')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition cursor-pointer whitespace-nowrap text-xs ${
              activeTab === 'builder'
                ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
            id="tab-builder"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Input Generator</span>
          </button>

          <button
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition cursor-pointer whitespace-nowrap text-xs ${
              activeTab === 'editor'
                ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
            id="tab-editor"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>fresco.in Deck Editor</span>
          </button>

          <button
            onClick={() => setActiveTab('plotter')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition cursor-pointer whitespace-nowrap text-xs ${
              activeTab === 'plotter'
                ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
            id="tab-plotter"
          >
            <LineChart className="w-3.5 h-3.5" />
            <span>xfresco Graphics</span>
          </button>

          <button
            onClick={() => setActiveTab('fitter')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition cursor-pointer whitespace-nowrap text-xs ${
              activeTab === 'fitter'
                ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
            id="tab-fitter"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>SFRESCO Fitter</span>
          </button>

          <button
            onClick={() => setActiveTab('couplings')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition cursor-pointer whitespace-nowrap text-xs ${
              activeTab === 'couplings'
                ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
            id="tab-couplings"
          >
            <GitFork className="w-3.5 h-3.5" />
            <span>Channel Couplings</span>
          </button>

          <button
            onClick={() => setActiveTab('render')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition cursor-pointer whitespace-nowrap text-xs ${
              activeTab === 'render'
                ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
            id="tab-render"
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>Docker & Render</span>
          </button>

          <button
            onClick={() => setActiveTab('fortran')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition cursor-pointer whitespace-nowrap text-xs ${
              activeTab === 'fortran'
                ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
            id="tab-fortran"
          >
            <Code className="w-3.5 h-3.5" />
            <span>Raw Fortran Code</span>
          </button>

          <button
            onClick={() => setActiveTab('manual')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition cursor-pointer whitespace-nowrap text-xs ${
              activeTab === 'manual'
                ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
            id="tab-manual"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Fortran Manual</span>
          </button>
        </div>
      </div>
    </header>
  );
};
