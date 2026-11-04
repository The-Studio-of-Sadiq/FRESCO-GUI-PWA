import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Card } from './ui';

const REPO = 'https://github.com/The-Studio-of-Sadiq/FRESCO-GUI-PWA';

const DOCS: { title: string; href: string; note: string }[] = [
  { title: 'FRESCO input manual', href: `${REPO}/blob/main/src/man/fresco-inputs.pdf`, note: 'Every card and namelist variable' },
  { title: 'Namelist input guide', href: `${REPO}/blob/main/src/man/fresco-namelist-manual.pdf`, note: '&FRESCO, &PARTITION, &POT, &OVERLAP, &COUPLING' },
  { title: 'FRESCO user guide', href: `${REPO}/blob/main/src/man/fres31.pdf`, note: 'Physics and examples' },
  { title: 'Validation against native gfortran', href: `${REPO}/blob/main/validations/README.md`, note: 'How the in-browser engine was checked' },
  { title: 'fresco.org.uk', href: 'https://www.fresco.org.uk', note: 'Official FRESCO site by Ian J. Thompson' },
];

const Link: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 underline-offset-2 hover:underline">
    {children}
    <ExternalLink className="w-3 h-3" />
  </a>
);

export const HelpPanel: React.FC = () => (
  <div className="max-w-3xl mx-auto space-y-4 text-sm text-slate-300 leading-relaxed">
    <Card title="Getting started">
      <ol className="list-decimal ml-5 space-y-1.5">
        <li>
          On <strong className="text-slate-100">Simulate</strong>, pick an example or enter your projectile, target and beam energy.
        </li>
        <li>Adjust the optical potential, or fill it from a global model such as Koning-Delaroche or CH89.</li>
        <li>
          Press <strong className="text-slate-100">Run</strong>. The angular distribution, Rutherford ratio and analysing power appear next
          to the inputs.
        </li>
        <li>
          Use <strong className="text-slate-100">Overlay data</strong> to compare with measurements: a text file with columns angle (deg),
          cross section (mb/sr) and optionally the error.
        </li>
      </ol>
    </Card>

    <Card title="Fitting to data">
      <p>
        <strong className="text-slate-100">Fit</strong> runs SFRESCO: FRESCO with the MINUIT minimiser, also compiled to WebAssembly. Add
        one or more datasets: angular distributions at any energy and channel (mb/sr, or σ/σ_Ruth for elastic), excitation functions at a
        fixed angle, integrated or total reaction cross sections against energy, or phase shifts. Tick what to vary: optical-potential
        terms, spectroscopic factors, dataset normalisations, R-matrix poles. Optional bounds are available too. MIGRAD minimises χ², or a
        χ² scan steps one parameter through a range. You get fitted values with MINUIT errors, χ²/N before and after, and the theory over
        your data. <strong className="text-slate-100">Use fitted values</strong> puts them into the setup, or into your own deck.
      </p>
      <p className="mt-2">Terms that are zero in the setup have no card in the FRESCO input and cannot be varied; give them a starting value first.</p>
    </Card>

    <Card title="What runs your calculation">
      <p>
        The official FRESCO Fortran by Ian J. Thompson does the calculation. It is compiled to WebAssembly and runs inside your browser,
        so it needs no server and keeps working offline once the app is installed. When the app is served with its Node backend and
        gfortran, the native executable is used instead. Both give the same cross sections to the printed precision.
      </p>
      <p className="mt-2">
        If FRESCO stops on an input it cannot handle, the result panel says why and shows an approximate TypeScript model instead. Treat
        those numbers as indicative only.
      </p>
    </Card>

    <Card title="Input deck">
      <p>
        The <strong className="text-slate-100">Input deck</strong> tab shows the exact <code className="text-cyan-300">fresco.in</code>{' '}
        namelist that FRESCO receives. You can edit it, upload a deck, or download it to run FRESCO yourself. Options that the Simulate form
        has no field for are not kept when the deck is read back.
      </p>
    </Card>

    <Card title="For agents and scripts">
      <p>
        Bots can run FRESCO and SFRESCO through this site without the user interface. Nothing to install and no key needed.
      </p>
      <ul className="mt-2 space-y-1.5">
        <li>
          <strong className="text-slate-100">MCP server</strong> (Streamable HTTP):{' '}
          <code className="text-cyan-300 break-all">{`${window.location.origin}/mcp`}</code>. Tools: list_examples, get_example,
          generate_deck, run_fresco, fit_sfresco, chi2_scan. Add it as a remote MCP server in Claude, ChatGPT, Cursor or any MCP client.
        </li>
        <li>
          <strong className="text-slate-100">JSON API</strong>: <code className="text-cyan-300">POST /api/run</code>,{' '}
          <code className="text-cyan-300">POST /api/fit</code>, <code className="text-cyan-300">GET /api/examples</code>, described in{' '}
          <a href="/openapi.json" className="text-cyan-400 hover:text-cyan-300 underline-offset-2 hover:underline">
            /openapi.json
          </a>
          .
        </li>
        <li>
          <strong className="text-slate-100">Guide for language models</strong>:{' '}
          <a href="/llms.txt" className="text-cyan-400 hover:text-cyan-300 underline-offset-2 hover:underline">
            /llms.txt
          </a>
          . Browsers with WebMCP also get the same tools from this page, running locally.
        </li>
      </ul>
    </Card>

    <Card title="Manuals and references">
      <ul className="space-y-2">
        {DOCS.map((d) => (
          <li key={d.href}>
            <Link href={d.href}>{d.title}</Link>
            <span className="text-slate-500"> · {d.note}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-slate-400">
        Reference: I. J. Thompson, “Coupled reaction channels calculations in nuclear physics”, Computer Physics Reports 7 (1988) 167–212.
      </p>
    </Card>
  </div>
);
