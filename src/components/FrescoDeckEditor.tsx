import React, { useState } from 'react';
import { Check, Copy, Download, Play, RotateCcw, Upload } from 'lucide-react';
import { Button, Card } from './ui';

interface FrescoDeckEditorProps {
  /** The deck FRESCO will run: your edited deck, or the one generated from the Simulate form. */
  deckText: string;
  /** True when deckText is your own deck rather than the form's. */
  isCustom: boolean;
  onDeckChange: (text: string) => void;
  /** Throw away the edited deck and go back to the one generated from the form. */
  onDiscard: () => void;
  onRunSimulation: () => void;
}

export const FrescoDeckEditor: React.FC<FrescoDeckEditorProps> = ({ deckText, isCustom, onDeckChange, onDiscard, onRunSimulation }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(deckText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const url = URL.createObjectURL(new Blob([deckText], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fresco.in';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card
      title="Input deck (fresco.in)"
      actions={
        <>
          <label className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer focus-within:ring-2 focus-within:ring-cyan-400">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Upload</span>
            <input type="file" accept=".in,.nin,.txt,.dat" className="sr-only" onChange={(e) => e.target.files?.[0]?.text().then(onDeckChange)} />
          </label>
          <Button variant="ghost" onClick={handleCopy}>
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </Button>
          <Button variant="ghost" onClick={handleDownload}>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download</span>
          </Button>
          <Button variant="primary" onClick={onRunSimulation}>
            <Play className="w-3.5 h-3.5 fill-current" />
            Run
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {isCustom ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cyan-900 bg-cyan-950/40 px-3 py-2 text-xs text-cyan-200">
            <span>
              Your own deck: FRESCO runs it exactly as written, including options the Simulate form has no field for. The form shows what it
              can read from it; changing the form replaces this deck.
            </span>
            <Button variant="ghost" onClick={onDiscard} className="text-xs">
              <RotateCcw className="w-3.5 h-3.5" />
              Use the form's deck
            </Button>
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            Generated from the Simulate form. Edit or upload any FRESCO namelist input and it will run exactly as written.
          </p>
        )}
        <textarea
          value={deckText}
          onChange={(e) => onDeckChange(e.target.value)}
          rows={24}
          wrap="off"
          spellCheck={false}
          aria-label="FRESCO input deck"
          className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-lg p-3 font-mono text-xs leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
        />
      </div>
    </Card>
  );
};
