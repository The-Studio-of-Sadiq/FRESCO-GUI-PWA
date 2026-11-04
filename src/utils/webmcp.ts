import { PRESET_REACTIONS } from '../physics/presets';
import { generateFrescoDeck } from '../physics/frescoParser';
import { runFrescoWasm } from '../fortran/frescoWasm';
import { FRESCODeckConfig } from '../types/fresco';

// WebMCP: where the browser offers navigator.modelContext, register tools so an agent
// using this page can run FRESCO directly, in this browser and offline. Server-side
// agents use the MCP endpoint at /mcp instead (same tool names).

interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: any) => Promise<{ content: { type: 'text'; text: string }[] }>;
}

const text = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value) }] });

function source(input: { example?: string; setup?: FRESCODeckConfig; deck?: string; eLab?: number }): string {
  if (input.deck) return input.deck;
  const base = input.setup ?? PRESET_REACTIONS.find((p) => p.id === (input.example ?? PRESET_REACTIONS[0].id))?.config;
  if (!base) throw new Error(`Unknown example "${input.example}"`);
  return generateFrescoDeck(input.eLab !== undefined ? { ...base, eLab: input.eLab } : base);
}

const TOOLS: WebMcpTool[] = [
  {
    name: 'list_examples',
    description: 'Example FRESCO reactions (ids, titles, descriptions) and their setup objects.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => text(PRESET_REACTIONS.map((p) => ({ id: p.id, title: p.title, description: p.description, setup: p.config }))),
  },
  {
    name: 'generate_deck',
    description: 'The FRESCO namelist input deck for an example or setup object.',
    inputSchema: {
      type: 'object',
      properties: { example: { type: 'string' }, setup: { type: 'object' }, eLab: { type: 'number', description: 'lab MeV' } },
    },
    execute: async (input) => text({ deck: source(input ?? {}) }),
  },
  {
    name: 'run_fresco',
    description:
      'Run the official FRESCO Fortran (WebAssembly, in this browser) on an example, a setup or a deck. Returns σ_reaction (mb) and, per outgoing channel, angle (deg c.m.), dσ/dΩ (mb/sr), σ/σ_Ruth and Ay.',
    inputSchema: {
      type: 'object',
      properties: {
        example: { type: 'string' },
        setup: { type: 'object' },
        deck: { type: 'string', description: 'FRESCO namelist deck, run exactly as written' },
        eLab: { type: 'number', description: 'lab MeV (example/setup only)' },
      },
    },
    execute: async (input) => {
      const result = await runFrescoWasm(source(input ?? {}));
      const out = result.output;
      return text({
        success: result.success,
        error: result.error,
        reactionCrossSectionMb: out.summary.totalReactionCrossSection,
        channels: (out.channels ?? [{ label: 'Elastic', points: out.angularDistribution }]).map((c) => ({
          channel: c.label,
          integratedMb: c.integratedMb,
          points: c.points.map((p) => [p.angleCm, p.sigmaMb, p.ratioRutherford, p.ay]),
        })),
        columns: ['angle', 'sigmaMbSr', 'ratioToRutherford', 'Ay'],
      });
    },
  },
];

export function registerWebMcpTools() {
  const mc = (navigator as any).modelContext;
  if (!mc) return;
  try {
    if (typeof mc.provideContext === 'function') mc.provideContext({ tools: TOOLS });
    else if (typeof mc.registerTool === 'function') TOOLS.forEach((t) => mc.registerTool(t));
  } catch (err) {
    console.warn('[WebMCP] tool registration failed:', err);
  }
}
