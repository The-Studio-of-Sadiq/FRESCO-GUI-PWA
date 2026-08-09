import React, { useState, useEffect } from 'react';
import { FRESCODeckConfig } from '../types/fresco';
import { generateFrescoDeck, parseFrescoDeck } from '../physics/frescoParser';
import { Copy, Download, Upload, Check, Play, FileCode, AlertCircle } from 'lucide-react';

interface FrescoDeckEditorProps {
  config: FRESCODeckConfig;
  onChangeConfig: (newConfig: FRESCODeckConfig) => void;
  onRunSimulation: () => void;
}

export const FrescoDeckEditor: React.FC<FrescoDeckEditorProps> = ({
  config,
  onChangeConfig,
  onRunSimulation,
}) => {
  const [deckText, setDeckText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    setDeckText(generateFrescoDeck(config));
  }, [config]);

  const handleTextChange = (text: string) => {
    setDeckText(text);
    try {
      const parsed = parseFrescoDeck(text);
      setParseError(null);
      onChangeConfig(parsed);
    } catch (err: any) {
      setParseError(err.message || 'Error parsing FRESCO input deck syntax.');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(deckText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([deckText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fresco.in';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        if (text) handleTextChange(text);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 text-slate-100">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        {/* Editor Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                fresco.in Raw Input Deck Editor
              </h2>
              <p className="text-xs text-slate-400">
                Official Fortran FRESCO namelist input card format.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Upload File */}
            <label className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer transition">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload fresco.in</span>
              <input type="file" accept=".in,.txt,.dat" onChange={handleFileUpload} className="hidden" />
            </label>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer transition"
              id="copy-deck-btn"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer transition"
              id="download-deck-btn"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .in</span>
            </button>

            {/* Run Button */}
            <button
              onClick={onRunSimulation}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold px-4 py-2 rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition"
              id="editor-run-btn"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Deck</span>
            </button>
          </div>
        </div>

        {parseError && (
          <div className="bg-red-950/60 border border-red-800/80 rounded-xl p-3 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{parseError}</span>
          </div>
        )}

        {/* Monospace Code Editor */}
        <div className="relative font-mono text-xs">
          <textarea
            value={deckText}
            onChange={(e) => handleTextChange(e.target.value)}
            rows={22}
            className="w-full bg-slate-950 text-cyan-300 border border-slate-800 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 leading-relaxed font-mono resize-y shadow-inner"
            placeholder="'Title line'&#10;  0.050  20.00  30.00  40  0  0..."
            spellCheck={false}
            id="fresco-deck-textarea"
          />
        </div>
      </div>
    </div>
  );
};
