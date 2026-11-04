import * as z from 'zod';
import { PRESET_REACTIONS } from '../src/physics/presets';
import { datasetSchema, resolveSource, Source, summarise, toDatasets, toVariables, variableSchema } from './mcp';
import { runFrescoNode, runSfrescoNode } from './frescoNode';

// JSON endpoints for scripts and bots that do not speak MCP. Shared by the Express
// server and the Vercel functions in /api. Described in public/openapi.json.

export interface JsonResult {
  status: number;
  body: unknown;
}

const runSchema = z.object({
  example: z.string().optional(),
  setup: z.record(z.string(), z.unknown()).optional(),
  deck: z.string().optional(),
  overrides: z.record(z.string(), z.number()).optional(),
  maxPoints: z.number().int().min(10).max(2000).default(200),
  includeListing: z.boolean().default(false),
}).strict();

const fitSchema = z.object({
  example: z.string().optional(),
  setup: z.record(z.string(), z.unknown()).optional(),
  deck: z.string().optional(),
  overrides: z.record(z.string(), z.number()).optional(),
  variables: z.array(variableSchema).min(1),
  datasets: z.array(datasetSchema).min(1),
}).strict();

const badRequest = (err: z.ZodError) => ({ status: 400, body: { error: 'Invalid request', issues: err.issues } });

export function examples(): JsonResult {
  return { status: 200, body: { examples: PRESET_REACTIONS.map((p) => ({ id: p.id, title: p.title, category: p.category, description: p.description, setup: p.config })) } };
}

export async function run(input: unknown): Promise<JsonResult> {
  const parsed = runSchema.safeParse(input ?? {});
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const { config, deck } = resolveSource(parsed.data as Source);
    const result = await runFrescoNode(deck, config);
    return {
      status: 200,
      body: { ...summarise(result, parsed.data.maxPoints), deck, ...(parsed.data.includeListing ? { listing: result.frescoOutRaw } : {}) },
    };
  } catch (err: any) {
    return { status: 422, body: { error: err?.message ?? String(err) } };
  }
}

export async function fit(input: unknown): Promise<JsonResult> {
  const parsed = fitSchema.safeParse(input ?? {});
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const { config, deck } = resolveSource(parsed.data as Source);
    const result = await runSfrescoNode(config, deck, toVariables(config, parsed.data.variables), toDatasets(config, parsed.data.datasets));
    return {
      status: 200,
      body: {
        converged: result.converged,
        status: result.status,
        chi2PerPointBefore: result.initialChi2PerPoint,
        chi2PerPointAfter: result.finalChi2PerPoint,
        values: parsed.data.variables.map((v, i) => ({ ...v, value: result.values[i].value, error: result.values[i].error })),
        datasets: result.comparison.map((c) => c.rows),
        searchFile: result.searchFile,
      },
    };
  } catch (err: any) {
    return { status: 422, body: { error: err?.message ?? String(err) } };
  }
}
