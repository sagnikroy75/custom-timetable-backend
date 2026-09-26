// This is the entry point of the whole server.
// It reads the configuration, builds the Fastify application,
// and then starts listening for incoming requests.

import 'dotenv/config';
import { buildApp } from './server/app';

// The port and host the server will listen on.
// If none are set in the environment, it defaults to port 3000 on all interfaces.
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

// Starts the server.
// It creates the Fastify app (which registers all plugins and routes),
// then tells it to start listening. If anything goes wrong, it prints
// the error and stops the process with an exit code of 1.
async function start() {
  const app = await buildApp();
  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`=======================================================`);
    console.log(`Custom Timetable Backend (Fastify + MongoDB) Running!`);
    console.log(`Port: ${PORT} (http://${HOST}:${PORT})`);
    console.log(`Swagger UI Documentation: http://localhost:${PORT}/documentation`);
    console.log(`OpenAPI Spec: http://localhost:${PORT}/openapi.json`);
    console.log(`=======================================================`);
  } catch (err) {
    console.error('Failed to start Fastify server:', err);
    process.exit(1);
  }
}

// Actually run the start function when the script is executed.
start();
