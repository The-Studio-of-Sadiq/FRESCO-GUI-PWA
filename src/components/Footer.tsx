import React from 'react';
import {
  GraduationCap,
  BookOpen,
  Code,
  Atom,
  Building2,
  Users,
  Award,
  ExternalLink,
  Sparkles,
  Heart
} from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-12 bg-slate-900/90 border-t border-slate-800 text-slate-300 pt-8 pb-12 px-4 sm:px-6 lg:px-8 text-xs font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Grid: Authors & Attribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Creator 1: Golam Kuadir Khan Prince */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2 hover:border-cyan-500/40 transition group">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
              <div className="p-1.5 bg-cyan-950/80 rounded-lg border border-cyan-500/30">
                <GraduationCap className="w-4 h-4 text-cyan-400" />
              </div>
              <span className="group-hover:text-cyan-300 transition">Golam Kuadir Khan Prince</span>
            </div>
            <p className="text-slate-300 font-medium text-[11px]">Undergraduate Student</p>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Department of Electrical and Electronic Engineering (EEE)<br />
              Faculty of Computer Science and Engineering<br />
              Hajee Mohammad Danesh Science and Technology University, Dinajpur 5200, Bangladesh
            </p>
          </div>

          {/* Creator 2: Md. Sujan Islam */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2 hover:border-blue-500/40 transition group">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
              <div className="p-1.5 bg-blue-950/80 rounded-lg border border-blue-500/30">
                <Atom className="w-4 h-4 text-blue-400" />
              </div>
              <span className="group-hover:text-blue-300 transition">Md. Sujan Islam</span>
            </div>
            <p className="text-slate-300 font-medium text-[11px]">Associate Professor</p>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Department of Physics<br />
              Faculty of Science<br />
              Hajee Mohammad Danesh Science and Technology University, Dinajpur 5200, Bangladesh
            </p>
          </div>

          {/* Creator 3: Pankaj Bhowmik */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2 hover:border-sky-500/40 transition group">
            <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
              <div className="p-1.5 bg-sky-950/80 rounded-lg border border-sky-500/30">
                <Code className="w-4 h-4 text-sky-400" />
              </div>
              <span className="group-hover:text-sky-300 transition">Pankaj Bhowmik</span>
            </div>
            <p className="text-slate-300 font-medium text-[11px]">Lecturer</p>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Department of Computer Science and Engineering (CSE)<br />
              Faculty of Computer Science and Engineering<br />
              Hajee Mohammad Danesh Science and Technology University, Dinajpur 5200, Bangladesh
            </p>
          </div>

          {/* Organization: HSTU Research Society */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2 hover:border-emerald-500/40 transition group">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <div className="p-1.5 bg-emerald-950/80 rounded-lg border border-emerald-500/30">
                <Users className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="group-hover:text-emerald-300 transition">HSTU Research Society</span>
            </div>
            <p className="text-slate-300 font-medium text-[11px]">Academic Research Group</p>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Hajee Mohammad Danesh Science and Technology University (HSTU)<br />
              Dinajpur 5200, Bangladesh
            </p>
          </div>
        </div>

        {/* Middle Section: Original FRESCO Fortran Source Code Credit & Reference */}
        <div className="bg-slate-950/80 border border-cyan-500/30 rounded-2xl p-5 md:p-6 space-y-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-cyan-950 rounded-xl border border-cyan-500/40">
                <Award className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  Original Computational Source Code Credit
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                    FRESCO v4.2 Engine
                  </span>
                </h4>
                <p className="text-slate-400 text-xs">
                  Full academic acknowledgement to the creator of the underlying nuclear reaction code
                </p>
              </div>
            </div>

            <a
              href="https://www.fresco.org.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-mono bg-cyan-950/50 hover:bg-cyan-950 border border-cyan-500/30 px-3 py-1.5 rounded-lg transition self-start sm:self-auto"
            >
              <span>fresco.org.uk</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] text-slate-300">
            <div>
              <span className="text-slate-400 font-mono block text-[10px] uppercase tracking-wider mb-1">
                Original Author & Scientist
              </span>
              <p className="font-semibold text-slate-100">Prof. Ian J. Thompson</p>
              <p className="text-slate-400">Lawrence Livermore National Laboratory & University of Surrey</p>
            </div>

            <div>
              <span className="text-slate-400 font-mono block text-[10px] uppercase tracking-wider mb-1">
                Primary Reference Publication
              </span>
              <p className="font-semibold text-slate-200 italic">
                "Coupled channels calculations in nuclear physics"
              </p>
              <p className="text-slate-400 font-mono">Computer Physics Reports 7 (1988) 167–212</p>
            </div>

            <div>
              <span className="text-slate-400 font-mono block text-[10px] uppercase tracking-wider mb-1">
                GUI Application Scope
              </span>
              <p className="text-slate-300 leading-normal">
                This web application (FRESCO PWA GUI) provides a modern web interface, input deck editor, interactive plotter, and WASM/Native Fortran execution environment for the FRESCO code suite.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom copyright line */}
        <div className="pt-4 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-500" />
            <span>
              Hajee Mohammad Danesh Science and Technology University (HSTU), Dinajpur 5200, Bangladesh
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400">
            <span>FRESCO PWA GUI</span>
            <span>•</span>
            <span className="text-cyan-400 flex items-center gap-1">
              Developed with <Heart className="w-3 h-3 text-red-400 fill-red-400" /> at HSTU
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
