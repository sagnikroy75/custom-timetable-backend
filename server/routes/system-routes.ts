// This file registers the "housekeeping" endpoints of the server:
// - GET /            -> redirects the browser to the API documentation page.
// - GET /health      -> a simple status check (used by monitoring/docker).
// - GET /openapi.json -> the raw OpenAPI description of the API.
//
// Each route is also available under the /api prefix.

import type { FastifyInstance } from 'fastify';
import { mongoService } from '../mongo';
import { openApiSpec } from '../openapi';

export function registerSystemRoutes(app: FastifyInstance) {
  // Point a visitor hitting the root path straight to the docs.
  app.get('/', async (_req, reply) => reply.redirect('/documentation'));
  app.get('/docs', async (_req, reply) => reply.redirect('/documentation'));

  // A health check that reports whether the service is running and which
  // database engine is in use (real MongoDB or the in-memory fallback).
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

  // Serves the raw OpenAPI specification as JSON.
  const openApiHandler = async () => openApiSpec;
  app.get('/openapi.json', openApiHandler);
  app.get('/api/openapi.json', openApiHandler);
}
