// POST /api/fit: SFRESCO chi-square fit (see /openapi.json)
import { fit } from './_lib/fresco-api.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).setHeader('Allow', 'POST').json({ error: 'Use POST' });
  const result = await fit(req.body);
  res.status(result.status).json(result.body);
}
