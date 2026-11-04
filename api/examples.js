// GET /api/examples: the example reactions and their setups
import { examples } from './_lib/fresco-api.js';

export default function handler(_req, res) {
  const result = examples();
  res.status(result.status).json(result.body);
}
