import React from 'react';
import { ExternalLink } from 'lucide-react';

const HSTU = 'Hajee Mohammad Danesh Science and Technology University (HSTU), Dinajpur 5200, Bangladesh';

const PEOPLE: { name: string; role: string; affiliation: string }[] = [
  {
    name: 'Golam Kuadir Khan Prince',
    role: 'Undergraduate Student',
    affiliation: 'Dept. of Electrical and Electronic Engineering (EEE), Faculty of Computer Science and Engineering',
  },
  { name: 'Md. Sujan Islam', role: 'Associate Professor', affiliation: 'Dept. of Physics, Faculty of Science' },
  {
    name: 'Pankaj Bhowmik',
    role: 'Lecturer',
    affiliation: 'Dept. of Computer Science and Engineering (CSE), Faculty of Computer Science and Engineering',
  },
  { name: 'HSTU Research Society', role: 'Academic Research Group', affiliation: '' },
];

export const Footer: React.FC = () => (
  <footer className="mt-10 border-t border-slate-800 bg-slate-900/60 text-xs text-slate-400">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div>
        <p className="text-slate-300">
          Calculations use <strong className="text-slate-100">FRESCO</strong> by Prof. Ian J. Thompson (Lawrence Livermore National
          Laboratory &amp; University of Surrey):{' '}
          <em>“Coupled reaction channels calculations in nuclear physics”</em>, Computer Physics Reports 7 (1988) 167–212.{' '}
          <a href="https://www.fresco.org.uk" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-cyan-400 hover:text-cyan-300">
            fresco.org.uk
            <ExternalLink className="w-3 h-3" />
          </a>
        </p>
      </div>

      <div>
        <p className="text-slate-300 mb-2">FRESCO PWA GUI is developed at {HSTU} by</p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2">
          {PEOPLE.map((p) => (
            <li key={p.name}>
              <span className="text-slate-200 font-medium">{p.name}</span>
              <span className="block">{p.role}</span>
              {p.affiliation && <span className="block text-slate-500">{p.affiliation}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  </footer>
);
