// POST /api/run: run FRESCO on an example, setup or deck (see /openapi.json)
import { run } from './_lib/fresco-api.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).setHeader('Allow', 'POST').json({ error: 'Use POST' });
  const result = await run(req.body);
  res.status(result.status).json(result.body);
}
