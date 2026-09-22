import 'dotenv/config';
import { buildApp } from './server/app';

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

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

start();
