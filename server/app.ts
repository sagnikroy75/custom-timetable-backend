// This file is responsible for building the whole Fastify web application.
// It sets up the plugins (CORS, Swagger documentation), connects to the
// database, and registers all the route groups on the server.

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

// Creates and configures the Fastify app, then returns it ready to be started.
//
// What it does, step by step:
// 1. Creates the Fastify instance. It trusts proxy headers and disables the built-in logger.
// 2. Registers CORS so that browser apps from any origin can call the API.
// 3. Connects to the database (MongoDB, or the built-in in-memory store as a fallback).
// 4. Registers Swagger so the API description can be shown on a documentation page.
// 5. Registers the Swagger UI page at /documentation.
// 6. Registers all route groups (system, auth, events, and MCP tools).
export async function buildApp() {
  const app = Fastify({
    logger: false,
    trustProxy: true,
  });

  // Allow any website origin to make requests, and let them send the
  // headers we need for authentication (Content-Type, Authorization, x-user-id).
  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
  });

  // Connect to the database. Events and users are stored here.
  await mongoService.init();

  // Make the OpenAPI spec (the "shape" of the API) available to Swagger.
  await app.register(swagger, {
    mode: 'static',
    specification: {
      document: openApiSpec as any,
    },
  });

  // Host the interactive documentation at /documentation.
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

  // Register all the route groups.
  registerSystemRoutes(app); // health check, docs redirect, OpenAPI spec
  registerAuthRoutes(app);   // signup, login, current user
  registerEventRoutes(app);  // event CRUD, clash detection, free slots, ICS export
  registerMcpRoutes(app);    // AI assistant (MCP) endpoints

  return app;
}
