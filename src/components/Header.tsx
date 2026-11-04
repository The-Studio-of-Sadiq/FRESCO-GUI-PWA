import React from 'react';
import { Download, History, Play } from 'lucide-react';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { Button } from './ui';

export type AppTab = 'simulate' | 'deck' | 'help';

const TABS: { id: AppTab; label: string }[] = [
  { id: 'simulate', label: 'Simulate' },
  { id: 'deck', label: 'Input deck' },
  { id: 'help', label: 'Help' },
];

interface HeaderProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onRun: () => void;
  isRunning: boolean;
  onOpenHistory: () => void;
  onDownloadDeck: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange, onRun, isRunning, onOpenHistory, onDownloadDeck }) => (
  <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur border-b border-slate-800">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center gap-x-6 gap-y-2 py-2.5">
      <a href="/" className="flex items-center gap-2 shrink-0" aria-label="FRESCO home">
        <img src="/favicon.svg" alt="" className="w-7 h-7 rounded-md" />
        <span className="font-semibold text-white tracking-tight">FRESCO</span>
      </a>

      <nav aria-label="Main" className="order-last w-full md:order-none md:w-auto -mx-1 flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            className={`px-3 py-1.5 rounded-md text-sm transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              activeTab === tab.id ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1.5">
        <PWAInstallPrompt />
        <Button variant="ghost" onClick={onOpenHistory} title="Saved runs" aria-label="Saved runs" className="px-2">
          <History className="w-4 h-4" />
        </Button>
        <Button variant="ghost" onClick={onDownloadDeck} title="Download input deck (fresco.in)" aria-label="Download input deck" className="px-2">
          <Download className="w-4 h-4" />
        </Button>
        <Button variant="primary" onClick={onRun} disabled={isRunning} className="ml-1">
          <Play className="w-3.5 h-3.5 fill-current" />
          {isRunning ? 'Running…' : 'Run'}
        </Button>
      </div>
    </div>
  </header>
);
