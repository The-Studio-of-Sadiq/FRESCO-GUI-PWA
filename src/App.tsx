import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FRESCODeckConfig, SimulationOutput, SavedRun } from './types/fresco';
import { PRESET_REACTIONS } from './physics/presets';
import { runFrescoSimulation } from './physics/frescoEngine';
import { generateFrescoDeck } from './physics/frescoParser';

import { AppTab, Header } from './components/Header';
import { SetupPanel } from './components/SetupPanel';
import { ResultsPanel } from './components/ResultsPanel';
import { FrescoDeckEditor } from './components/FrescoDeckEditor';
import { HelpPanel } from './components/HelpPanel';
import { RunHistoryModal } from './components/RunHistoryModal';
import { Footer } from './components/Footer';

const HISTORY_KEY = 'fresco_saved_runs';
const HISTORY_LIMIT = 20;

function downloadText(filename: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Runs FRESCO (in-browser WebAssembly or server); falls back to the TypeScript model and says why. */
async function runFresco(config: FRESCODeckConfig): Promise<{ output: SimulationOutput; fallbackReason: string | null }> {
  const deckText = generateFrescoDeck(config);
  let reason: string | null = null;
  try {
    const response = await fetch('/api/fortran/run-fresco', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deckText, config }),
    });
    const data = await response.json().catch(() => null);
    if (response.ok && data?.success && data.output) return { output: data.output, fallbackReason: null };
    reason = data?.error || `request failed (${response.status})`;
  } catch (err: any) {
    reason = err?.message || String(err);
  }
  return { output: await runFrescoSimulation(config), fallbackReason: reason };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('simulate');
  const [presetId, setPresetId] = useState<string | null>(PRESET_REACTIONS[0].id);
  const [deckConfig, setDeckConfig] = useState<FRESCODeckConfig>(PRESET_REACTIONS[0].config);
  const [output, setOutput] = useState<SimulationOutput | null>(null);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [savedRuns, setSavedRuns] = useState<SavedRun[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const saveRuns = (runs: SavedRun[]) => {
    setSavedRuns(runs);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(runs));
    } catch {
      // storage full or unavailable: keep the in-memory history
    }
  };

  const run = useCallback(async (config: FRESCODeckConfig, { remember = true } = {}) => {
    setIsRunning(true);
    setRunError(null);
    try {
      const result = await runFresco(config);
      setOutput(result.output);
      setFallbackReason(result.fallbackReason);
      if (remember) {
        const entry: SavedRun = {
          id: `run_${Date.now()}`,
          timestamp: new Date().toISOString(),
          title: config.title,
          deckConfig: config,
          output: result.output,
          formattedInputText: generateFrescoDeck(config),
        };
        setSavedRuns((prev) => {
          const runs = [entry, ...prev].slice(0, HISTORY_LIMIT);
          try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(runs));
          } catch {
            // ignore
          }
          return runs;
        });
      }
    } catch (err: any) {
      setRunError(err?.message || 'The calculation failed.');
    } finally {
      setIsRunning(false);
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) setSavedRuns(JSON.parse(saved));
    } catch {
      // ignore unreadable history
    }
    // Show a result straight away; this first run is not added to the history.
    run(PRESET_REACTIONS[0].config, { remember: false });
  }, [run]);

  const runCurrent = () => {
    setActiveTab('simulate');
    run(deckConfig);
    // On narrow screens the results sit below the form: bring them into view.
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  const changeConfig = (config: FRESCODeckConfig) => {
    setDeckConfig(config);
    setPresetId(null);
  };

  const loadPreset = (id: string) => {
    const preset = PRESET_REACTIONS.find((p) => p.id === id);
    if (!preset) return;
    setDeckConfig(preset.config);
    setPresetId(preset.id);
    run(preset.config);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-slate-950">
      <Header
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0 });
        }}
        onRun={runCurrent}
        isRunning={isRunning}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onDownloadDeck={() => downloadText('fresco.in', generateFrescoDeck(deckConfig))}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-5">
        {runError && (
          <div role="alert" className="mb-4 rounded-lg border border-rose-900 bg-rose-950/40 px-4 py-2 text-sm text-rose-200">
            {runError}
          </div>
        )}

        {activeTab === 'simulate' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-5">
              <SetupPanel
                config={deckConfig}
                onChange={changeConfig}
                presetId={presetId}
                onLoadPreset={loadPreset}
                onRun={runCurrent}
                isRunning={isRunning}
                onOpenDeck={() => setActiveTab('deck')}
              />
            </div>
            <div ref={resultsRef} className="lg:col-span-7 lg:sticky lg:top-20 scroll-mt-28">
              <ResultsPanel output={output} isRunning={isRunning} fallbackReason={fallbackReason} />
            </div>
          </div>
        )}

        {activeTab === 'deck' && <FrescoDeckEditor config={deckConfig} onChangeConfig={changeConfig} onRunSimulation={runCurrent} />}

        {activeTab === 'help' && <HelpPanel />}
      </main>

      <Footer />

      <RunHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        savedRuns={savedRuns}
        onLoadRun={(saved) => {
          setDeckConfig(saved.deckConfig);
          setPresetId(null);
          setOutput(saved.output);
          setFallbackReason(null);
          setActiveTab('simulate');
        }}
        onDeleteRun={(id) => saveRuns(savedRuns.filter((r) => r.id !== id))}
      />
    </div>
  );
}
