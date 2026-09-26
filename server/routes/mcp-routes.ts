// This file wires up the endpoints that let AI assistants use the timetable
// through the Model Context Protocol (MCP).
// - GET  /mcp/tools  -> lists the tools an assistant can call.
// - POST /mcp        -> runs a tool call (the actual JSON-RPC request).
//
// Each route is also available under the /api prefix and under /events/mcp.

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requireAuth } from '../auth';
import { handleMCPRequest, MCP_TOOLS } from '../mcp';

export function registerMcpRoutes(app: FastifyInstance) {
  // Simply returns the catalog of available MCP tools.
  const mcpToolsHandler = async () => ({ tools: MCP_TOOLS });
  app.get('/mcp/tools', mcpToolsHandler);
  app.get('/api/mcp/tools', mcpToolsHandler);

  // Passes a JSON-RPC request from an assistant to the request handler,
  // scoped to whoever is authenticated.
  const mcpHandler = async (req: FastifyRequest) => {
    const userId = req.user!.id;
    return handleMCPRequest(userId, req.body as any);
  };

  app.post('/mcp', { preHandler: requireAuth }, mcpHandler);
  app.post('/api/mcp', { preHandler: requireAuth }, mcpHandler);
  app.post('/events/mcp', { preHandler: requireAuth }, mcpHandler);
  app.post('/api/events/mcp', { preHandler: requireAuth }, mcpHandler);
}
