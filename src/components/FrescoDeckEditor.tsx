import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Copy, Download, Play, Upload } from 'lucide-react';
import { FRESCODeckConfig } from '../types/fresco';
import { generateFrescoDeck, parseFrescoDeck } from '../physics/frescoParser';
import { Button, Card } from './ui';

interface FrescoDeckEditorProps {
  config: FRESCODeckConfig;
  onChangeConfig: (newConfig: FRESCODeckConfig) => void;
  onRunSimulation: () => void;
}

export const FrescoDeckEditor: React.FC<FrescoDeckEditorProps> = ({ config, onChangeConfig, onRunSimulation }) => {
  const [deckText, setDeckText] = useState<string>(() => generateFrescoDeck(config));
  const [copied, setCopied] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  // The config this editor produced last: regenerating the text from it would rewrite what is being typed.
  const ownConfig = useRef<FRESCODeckConfig | null>(null);

  useEffect(() => {
    if (config !== ownConfig.current) setDeckText(generateFrescoDeck(config));
  }, [config]);

  const handleTextChange = (text: string) => {
    setDeckText(text);
    try {
      const parsed = parseFrescoDeck(text);
      setParseError(null);
      ownConfig.current = parsed;
      onChangeConfig(parsed);
    } catch (err: any) {
      setParseError(err.message || 'Could not read this deck.');
    }
  };

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
            <input type="file" accept=".in,.nin,.txt,.dat" className="sr-only" onChange={(e) => e.target.files?.[0]?.text().then(handleTextChange)} />
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
        <p className="text-xs text-slate-400">
          The FRESCO namelist input sent to the Fortran engine. Edits update the Simulate form; settings the form has no field for are not
          kept.
        </p>
        {parseError && (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-rose-900 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {parseError}
          </div>
        )}
        <textarea
          value={deckText}
          onChange={(e) => handleTextChange(e.target.value)}
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
