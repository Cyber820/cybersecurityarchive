import Fastify from 'fastify';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';

import { config } from './config.js';
import { viewerRoutes } from './routes/viewer.js';
import { adminRoutes } from './routes/admin.js';

const app = Fastify({ logger: true });

await app.register(fastifyCors, { origin: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// apps/web/dist
const webDist = path.resolve(__dirname, '../../web/dist');

await app.register(fastifyStatic, {
  root: webDist,
  prefix: '/',
});

await app.register(viewerRoutes, { prefix: '/api' });
await app.register(adminRoutes, { prefix: '/api/admin' });

// Basic health check
app.get('/api/health', async () => ({ ok: true }));

// Not found handler: keep API strict, but allow browser routes to land on viewer.html
app.setNotFoundHandler((req, reply) => {
  const url = req.raw.url || '';
  if (url.startsWith('/api/')) {
    reply.code(404).send({ error: 'Not Found' });
    return;
  }
  // default to viewer entry
  reply.sendFile('viewer.html');
});

await app.listen({ port: config.port, host: '0.0.0.0' });
