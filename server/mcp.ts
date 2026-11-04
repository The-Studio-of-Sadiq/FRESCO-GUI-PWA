import type { IncomingMessage, ServerResponse } from 'http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import * as z from 'zod';
import { FRESCODeckConfig, OpticalPotential } from '../src/types/fresco';
import { PRESET_REACTIONS } from '../src/physics/presets';
import { generateFrescoDeck, parseFrescoDeck } from '../src/physics/frescoParser';
import { FitDataset, FitParameter, FitVariable, POTENTIAL_FIT_TERMS } from '../src/physics/sfresco';
import { FortranRunResult } from '../src/fortran/frescoResult';
import { runFrescoNode, runSfrescoNode, runSfrescoScanNode } from './frescoNode';

// Model Context Protocol server: lets any MCP client (Claude, ChatGPT, IDE agents, scripts)
// run FRESCO and SFRESCO through this site. Stateless Streamable HTTP, so it works the same
// in the Express server and as a Vercel function.

export const MCP_INSTRUCTIONS = `FRESCO coupled-reaction-channels calculations (Ian J. Thompson's official Fortran FRESCO, compiled to WebAssembly).
Start with list_examples / get_example to see a setup, then run_fresco with an example id, a modified setup, or any FRESCO namelist deck.
fit_sfresco fits optical-potential parameters, spectroscopic factors, normalisations or R-matrix poles to data with SFRESCO (MINUIT).
Energies are lab MeV, angles centre-of-mass degrees, cross sections mb/sr (mb when integrated). Radii are r0 with R = r0·A_target^(1/3).`;

const setupSchema = z
  .record(z.string(), z.unknown())
  .describe('A reaction setup object as returned by get_example (title, eLab, dr, rmatch, rmax, lmax, angleStart/End/Step, partitions, states, potentials, boundStates, couplings).');

const sourceShape = {
  example: z.string().optional().describe('Example id from list_examples'),
  setup: setupSchema.optional(),
  deck: z.string().optional().describe('A complete FRESCO namelist input deck (fresco.in); runs exactly as written'),
  overrides: z
    .object({
      eLab: z.number().optional().describe('Beam energy, lab MeV'),
      angleStart: z.number().optional(),
      angleEnd: z.number().optional(),
      angleStep: z.number().optional(),
      lmax: z.number().optional(),
    })
    .optional()
    .describe('Changes applied to an example or setup (not to a deck)'),
};

export type Source = { example?: string; setup?: Record<string, unknown>; deck?: string; overrides?: Partial<FRESCODeckConfig> };

/** The setup and the deck to run, from an example, a setup object or a deck. */
export function resolveSource(src: Source): { config: FRESCODeckConfig; deck: string } {
  if (src.deck) return { config: parseFrescoDeck(src.deck), deck: src.deck };
  let config: FRESCODeckConfig;
  if (src.setup) config = src.setup as unknown as FRESCODeckConfig;
  else {
    const preset = PRESET_REACTIONS.find((p) => p.id === (src.example ?? PRESET_REACTIONS[0].id));
    if (!preset) throw new Error(`Unknown example "${src.example}". Use list_examples.`);
    config = preset.config;
  }
  config = { ...config, ...Object.fromEntries(Object.entries(src.overrides ?? {}).filter(([, v]) => v !== undefined)) };
  return { config, deck: generateFrescoDeck(config) };
}

function thin<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  const stride = Math.ceil(points.length / max);
  return points.filter((_, i) => i % stride === 0);
}

export function summarise(result: FortranRunResult, maxPoints: number) {
  const { output } = result;
  const channels = (output.channels?.length ? output.channels : [{ label: 'Elastic', points: output.angularDistribution }]).map((c, i) => ({
    channel: i === 0 ? `elastic: ${c.label}` : c.label,
    integratedMb: i > 0 ? c.integratedMb : undefined,
    points: thin(c.points, maxPoints).map((p) => ({
      angle: p.angleCm,
      sigmaMbSr: p.sigmaMb,
      ...(p.sigmaRutherford > 0 ? { ratioToRutherford: p.ratioRutherford } : {}),
      ...(p.ay !== 0 ? { Ay: p.ay } : {}),
    })),
  }));
  return {
    success: result.success,
    error: result.error,
    engine: result.engineUsed,
    reactionCrossSectionMb: output.summary.totalReactionCrossSection || undefined,
    elasticCrossSectionMb: output.summary.totalElasticCrossSection || undefined,
    channels,
    elasticSMatrix: thin(output.sMatrix, maxPoints).map((s) => ({ L: s.l, J: s.j, modulus: s.eta, phaseShiftDeg: s.phaseShiftDeg })),
  };
}

const json = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 1) }], structuredContent: value as Record<string, unknown> });
const fail = (err: unknown) => ({ content: [{ type: 'text' as const, text: `Error: ${(err as Error)?.message ?? String(err)}` }], isError: true });

const POTENTIAL_PARAMETER_NAMES = POTENTIAL_FIT_TERMS.map((t) => t.label) as [string, ...string[]];

export const variableSchema = z.object({
  kind: z.enum(['potential', 'spectroscopic', 'normalisation', 'rmatrix-energy', 'rmatrix-width']),
  potential: z.number().int().min(1).optional().describe('potential: potential number (1-based, as in the setup)'),
  parameter: z.enum(POTENTIAL_PARAMETER_NAMES).optional().describe('potential: V, r_V, a_V, W, r_W, a_W, W_D, r_D, a_D, V_so, r_so, a_so'),
  transfer: z.number().int().min(1).optional().describe('spectroscopic: transfer coupling number (1-based, in setup order)'),
  dataset: z.number().int().min(1).optional().describe('normalisation: dataset number (1-based)'),
  term: z.number().int().min(1).optional().describe('R-matrix: pole number'),
  J: z.number().optional(),
  parity: z.union([z.literal(1), z.literal(-1)]).optional(),
  energy: z.number().optional().describe('rmatrix-energy: starting pole energy, MeV c.m.'),
  channel: z.number().int().min(1).optional(),
  width: z.number().optional().describe('rmatrix-width: starting width'),
  min: z.number().optional(),
  max: z.number().optional(),
});

export const datasetSchema = z.object({
  type: z.enum(['angular', 'excitation', 'integrated', 'phase']).describe('angular: x = angle; others: x = lab energy'),
  partition: z.number().int().min(1).default(1),
  state: z.number().int().min(1).default(1),
  quantity: z.enum(['absolute', 'ratio']).default('absolute').describe('angular: mb/sr or ratio to Rutherford'),
  energy: z.number().optional().describe('angular: lab energy (default: setup energy)'),
  angle: z.number().optional().describe('excitation: c.m. angle'),
  integrated: z.enum(['reaction', 'total', 'elastic', 'channel', 'fusion']).optional(),
  J: z.number().optional().describe('phase: total J'),
  parity: z.union([z.literal(1), z.literal(-1)]).optional(),
  channel: z.number().int().min(1).optional(),
  points: z.array(z.tuple([z.number(), z.number(), z.number()])).describe('[x, value, absolute error] rows'),
});

export function toVariables(config: FRESCODeckConfig, vars: z.infer<typeof variableSchema>[]): FitVariable[] {
  const transfers = config.couplings.filter((c) => c.couplingType === 'transfer-dwba');
  return vars.map((v) => {
    let param: FitParameter;
    if (v.kind === 'potential') {
      const key = POTENTIAL_FIT_TERMS.find((t) => t.label === v.parameter)?.key as keyof OpticalPotential | undefined;
      if (!key) throw new Error('potential variables need "parameter"');
      param = { kind: 'potential', potentialIndex: (v.potential ?? 1) - 1, key };
    } else if (v.kind === 'spectroscopic') {
      const c = transfers[(v.transfer ?? 1) - 1];
      if (!c) throw new Error(`no transfer coupling ${v.transfer ?? 1}`);
      param = { kind: 'spectroscopic', couplingId: c.id };
    } else if (v.kind === 'normalisation') {
      param = { kind: 'normalisation', dataset: (v.dataset ?? 1) - 1 };
    } else if (v.kind === 'rmatrix-energy') {
      param = { kind: 'rmatrix-energy', term: v.term ?? 1, jtot: v.J ?? 0.5, parity: v.parity ?? 1, energy: v.energy ?? 1 };
    } else {
      param = { kind: 'rmatrix-width', term: v.term ?? 1, channel: v.channel ?? 1, width: v.width ?? 0.5 };
    }
    return { param, min: v.min, max: v.max };
  });
}

export function toDatasets(config: FRESCODeckConfig, sets: z.infer<typeof datasetSchema>[]): FitDataset[] {
  return sets.map((d) => ({
    type: d.type,
    partition: d.partition,
    state: d.state,
    quantity: d.quantity,
    energy: d.energy ?? config.eLab,
    angle: d.angle,
    integrated: d.integrated,
    jtot: d.J,
    parity: d.parity,
    channel: d.channel,
    points: d.points.map(([x, value, error]) => ({ x, value, error })),
  }));
}

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'fresco', version: '1.0.0' }, { instructions: MCP_INSTRUCTIONS });

  server.registerTool(
    'list_examples',
    { title: 'List example reactions', description: 'Ready-made reaction setups (elastic, transfer, heavy-ion, neutron).', inputSchema: {} },
    async () => json({ examples: PRESET_REACTIONS.map((p) => ({ id: p.id, title: p.title, category: p.category, description: p.description })) }),
  );

  server.registerTool(
    'get_example',
    {
      title: 'Get an example setup',
      description: 'The full setup object of an example and the FRESCO deck it generates. Modify the setup and pass it to run_fresco.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const preset = PRESET_REACTIONS.find((p) => p.id === id);
      if (!preset) return fail(new Error(`Unknown example "${id}"`));
      return json({ setup: preset.config, deck: generateFrescoDeck(preset.config) });
    },
  );

  server.registerTool(
    'generate_deck',
    {
      title: 'Generate a FRESCO deck',
      description: 'The FRESCO namelist input for an example or setup, e.g. to run FRESCO elsewhere or to edit before run_fresco.',
      inputSchema: { example: sourceShape.example, setup: sourceShape.setup, overrides: sourceShape.overrides },
    },
    async (args) => {
      try {
        return json({ deck: resolveSource(args as Source).deck });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'run_fresco',
    {
      title: 'Run FRESCO',
      description:
        'Runs FRESCO on an example, a setup or a full deck. Returns reaction/elastic cross sections, the angular distribution of every outgoing channel (dσ/dΩ in mb/sr, σ/σ_Ruth, Ay) and the elastic S-matrix.',
      inputSchema: {
        ...sourceShape,
        maxPoints: z.number().int().min(10).max(2000).default(200).describe('Maximum points per curve'),
        includeListing: z.boolean().default(false).describe('Also return FRESCO’s full text output'),
      },
    },
    async (args) => {
      try {
        const { config, deck } = resolveSource(args as Source);
        const result = await runFrescoNode(deck, config);
        return json({ ...summarise(result, args.maxPoints), deck, ...(args.includeListing ? { listing: result.frescoOutRaw } : {}) });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'fit_sfresco',
    {
      title: 'Fit with SFRESCO',
      description:
        'χ² fit with SFRESCO (FRESCO + MINUIT MIGRAD) of the given variables to one or more datasets. Returns fitted values with errors, χ²/N before and after, convergence, and theory at the data points.',
      inputSchema: {
        ...sourceShape,
        variables: z.array(variableSchema).min(1),
        datasets: z.array(datasetSchema).min(1),
      },
    },
    async (args) => {
      try {
        const { config, deck } = resolveSource(args as Source);
        const fit = await runSfrescoNode(config, deck, toVariables(config, args.variables), toDatasets(config, args.datasets));
        return json({
          converged: fit.converged,
          status: fit.status,
          chi2PerPointBefore: fit.initialChi2PerPoint,
          chi2PerPointAfter: fit.finalChi2PerPoint,
          // spectroscopic variables are amplitudes A; the factor is S = A²
          values: args.variables.map((v, i) => ({ ...v, value: fit.values[i].value, error: fit.values[i].error })),
          datasets: fit.comparison.map((c) => c.rows),
          searchFile: fit.searchFile,
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'chi2_scan',
    {
      title: 'χ² scan',
      description: 'χ²/N as one variable is stepped through a range with the others fixed (SFRESCO scan).',
      inputSchema: {
        ...sourceShape,
        variables: z.array(variableSchema).min(1),
        datasets: z.array(datasetSchema).min(1),
        scanVariable: z.number().int().min(1).describe('1-based index into variables'),
        from: z.number(),
        to: z.number(),
        step: z.number().positive(),
      },
    },
    async (args) => {
      try {
        const { config, deck } = resolveSource(args as Source);
        const scan = await runSfrescoScanNode(config, deck, toVariables(config, args.variables), toDatasets(config, args.datasets), {
          index: args.scanVariable,
          from: args.from,
          to: args.to,
          step: args.step,
        });
        return json({ points: scan.points });
      } catch (err) {
        return fail(err);
      }
    },
  );

  return server;
}

/** Handles one MCP request (POST JSON-RPC); `body` is the parsed JSON body if already read. */
export async function handleMcpRequest(req: IncomingMessage, res: ServerResponse, body?: unknown) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'POST' });
    res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Use POST (stateless Streamable HTTP MCP server)' }, id: null }));
    return;
  }
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}
