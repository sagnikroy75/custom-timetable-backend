import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requireAuth } from '../auth';
import { handleMCPRequest, MCP_TOOLS } from '../mcp';

export function registerMcpRoutes(app: FastifyInstance) {
  const mcpToolsHandler = async () => ({ tools: MCP_TOOLS });
  app.get('/mcp/tools', mcpToolsHandler);
  app.get('/api/mcp/tools', mcpToolsHandler);

  const mcpHandler = async (req: FastifyRequest) => {
    const userId = req.user!.id;
    return handleMCPRequest(userId, req.body as any);
  };

  app.post('/mcp', { preHandler: requireAuth }, mcpHandler);
  app.post('/api/mcp', { preHandler: requireAuth }, mcpHandler);
  app.post('/events/mcp', { preHandler: requireAuth }, mcpHandler);
  app.post('/api/events/mcp', { preHandler: requireAuth }, mcpHandler);
}
