// MCP server (Streamable HTTP, stateless) on Vercel: POST /mcp or /api/mcp
import { handleMcpRequest } from './_lib/fresco-api.js';

export default async function handler(req, res) {
  await handleMcpRequest(req, res, req.body);
}
