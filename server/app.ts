import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { mongoService } from './mongo';
import { openApiSpec } from './openapi';
import { registerAuthRoutes } from './routes/auth-routes';
import { registerEventRoutes } from './routes/event-routes';
import { registerMcpRoutes } from './routes/mcp-routes';
import { registerSystemRoutes } from './routes/system-routes';

export async function buildApp() {
  const app = Fastify({
    logger: false,
    trustProxy: true,
  });

  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
  });

  await mongoService.init();

  await app.register(swagger, {
    mode: 'static',
    specification: {
      document: openApiSpec as any,
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      persistAuthorization: true,
    },
    staticCSP: false,
    transformStaticCSP: (header) => header,
  });

  registerSystemRoutes(app);
  registerAuthRoutes(app);
  registerEventRoutes(app);
  registerMcpRoutes(app);

  return app;
}
