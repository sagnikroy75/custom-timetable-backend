import type { FastifyInstance } from 'fastify';
import { mongoService } from '../mongo';
import { openApiSpec } from '../openapi';

export function registerSystemRoutes(app: FastifyInstance) {
  app.get('/', async (_req, reply) => reply.redirect('/documentation'));
  app.get('/docs', async (_req, reply) => reply.redirect('/documentation'));

  const healthHandler = async () => ({
    status: 'ok',
    service: 'custom-timetable-backend',
    framework: 'Fastify v5 + MongoDB',
    database: mongoService.isConnectedToNativeMongo ? 'Native MongoDB' : 'Embedded MongoDB Engine',
    timestamp: new Date().toISOString(),
    documentation: '/documentation',
  });

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  const openApiHandler = async () => openApiSpec;
  app.get('/openapi.json', openApiHandler);
  app.get('/api/openapi.json', openApiHandler);
}
