import React, { useState } from 'react';
import { FRESCODeckConfig } from '../types/fresco';
import { Bot, Send, Sparkles, AlertCircle, HelpCircle } from 'lucide-react';

interface GeminiAssistantProps {
  config: FRESCODeckConfig;
}

export const GeminiAssistant: React.FC<GeminiAssistantProps> = ({ config }) => {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content:
        'Hello! I am your FRESCO Nuclear Physics AI Assistant. Ask me to debug your `fresco.in` deck, recommend global optical model parameters (Koning-Delaroche, CH89, Perey-Perey), or explain reaction mechanisms (Coulomb barrier interference, DWBA stripping, coupled channels).',
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSend = async (customPrompt?: string) => {
    const promptToSend = customPrompt || inputPrompt;
    if (!promptToSend.trim() || isLoading) return;

    const newMessages = [...messages, { role: 'user' as const, content: promptToSend }];
    setMessages(newMessages);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `User Prompt: ${promptToSend}\n\nCurrent FRESCO Reaction Deck Config:\nTitle: ${config.title}\nBeam Energy E_lab: ${config.eLab} MeV\nPartitions: ${JSON.stringify(config.partitions)}\nPotentials: ${JSON.stringify(config.potentials)}`,
          systemInstruction:
            'You are an expert nuclear reaction physicist and FRESCO code specialist. Answer user questions about FRESCO card inputs, optical model potentials, reaction kinematics, phase shifts, and DWBA transfer reactions concisely and accurately.',
        }),
      });

      const data = await res.json();
      if (data.text) {
        setMessages([...newMessages, { role: 'assistant', content: data.text }]);
      } else {
        setMessages([
          ...newMessages,
          { role: 'assistant', content: 'Unable to connect to Gemini AI model. Please check GEMINI_API_KEY settings.' },
        ]);
      }
    } catch (err: any) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: `Error querying AI Assistant: ${err.message || 'Network error'}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 text-slate-100">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col h-[650px]">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4 shrink-0">
          <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Gemini Nuclear Physics Assistant</h2>
            <p className="text-xs text-slate-400">
              AI-driven FRESCO deck validator, optical model tuning, and physical interpretation.
            </p>
          </div>
        </div>

        {/* Quick Prompts */}
        <div className="flex gap-2 py-3 border-b border-slate-800 text-xs overflow-x-auto shrink-0">
          <button
            onClick={() => handleSend('Suggest the best optical model potential parameters for this reaction energy.')}
            className="bg-slate-800 hover:bg-slate-750 text-cyan-300 border border-slate-700 px-3 py-1.5 rounded-lg whitespace-nowrap cursor-pointer transition"
          >
            💡 Recommend Optical Parameters
          </button>
          <button
            onClick={() => handleSend('Check my FRESCO input deck for any potential card errors or unphysical parameters.')}
            className="bg-slate-800 hover:bg-slate-750 text-cyan-300 border border-slate-700 px-3 py-1.5 rounded-lg whitespace-nowrap cursor-pointer transition"
          >
            🔍 Validate Deck Syntax
          </button>
          <button
            onClick={() => handleSend('Explain the difference between DWBA and Coupled Reaction Channels (CRC).')}
            className="bg-slate-800 hover:bg-slate-750 text-cyan-300 border border-slate-700 px-3 py-1.5 rounded-lg whitespace-nowrap cursor-pointer transition"
          >
            📘 DWBA vs CRC Theory
          </button>
        </div>

        {/* Message Log */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-2">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-cyan-400" />
                </div>
              )}
              <div
                className={`p-4 rounded-2xl max-w-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-cyan-600 text-white rounded-tr-none'
                    : 'bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-tl-none'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-cyan-400 p-2">
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>Analyzing reaction channels with Gemini AI...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="flex gap-2 pt-4 border-t border-slate-800 shrink-0">
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about optical models, reaction kinematics, phase shifts..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            id="gemini-assistant-input"
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !inputPrompt.trim()}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
            id="gemini-send-btn"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
