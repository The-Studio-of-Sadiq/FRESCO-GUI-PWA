import React from 'react';
import { SavedRun } from '../types/fresco';
import { History, Play, Trash2, Download, X, Calendar } from 'lucide-react';

interface RunHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedRuns: SavedRun[];
  onLoadRun: (run: SavedRun) => void;
  onDeleteRun: (id: string) => void;
}

export const RunHistoryModal: React.FC<RunHistoryModalProps> = ({
  isOpen,
  onClose,
  savedRuns,
  onLoadRun,
  onDeleteRun,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[80vh] flex flex-col shadow-2xl text-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-950 text-cyan-400 rounded-xl border border-cyan-800">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Local Run History</h3>
              <p className="text-xs text-slate-400">Stored in browser localStorage for quick access.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Saved Runs List */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {savedRuns.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No saved FRESCO runs found in localStorage. Run a simulation to save history.
            </div>
          ) : (
            savedRuns.map((run) => (
              <div
                key={run.id}
                className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <h4 className="font-bold text-white text-sm">{run.title}</h4>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-cyan-400" />
                      {new Date(run.timestamp).toLocaleString()}
                    </span>
                    <span>
                      σ_R: <strong className="text-cyan-300">{run.output.summary.totalReactionCrossSection.toFixed(1)} mb</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onLoadRun(run);
                      onClose();
                    }}
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Load</span>
                  </button>

                  <button
                    onClick={() => onDeleteRun(run.id)}
                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-slate-800 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
