// apps/api/src/server.js
import Fastify from 'fastify';
import path from 'node:path';
import fs from 'node:fs';

import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';

import { config } from './config.js';
import { viewerRoutes } from './routes/viewer.js';
import { adminRoutes } from './routes/admin/index.js';

const app = Fastify({ logger: true });

await app.register(fastifyCors, { origin: true });

// ===== Static hosting (Vite build output) =====
const webDist = path.resolve(process.cwd(), '../../apps/web/dist');
const hasStatic = fs.existsSync(webDist);

app.log.info({ webDist, hasStatic }, 'Static dist check');

if (hasStatic) {
  await app.register(fastifyStatic, {
    root: webDist,
    prefix: '/',
  });

  // root
  app.get('/', (req, reply) => reply.sendFile('index.html'));

  // ✅ 新增：/securitydomain/* 落地到 securitydomain.html
  app.get('/securitydomain', (req, reply) => reply.sendFile('securitydomain.html'));
  app.get('/securitydomain/*', (req, reply) => reply.sendFile('securitydomain.html'));
} else {
  app.get('/', async () => ({
    ok: true,
    hint: 'Static dist missing. Ensure Railway Build Command runs `npm run build` and Vite outputs to apps/web/dist.',
    webDist,
  }));
}

// ===== API =====
await app.register(viewerRoutes, { prefix: '/api' });
await app.register(adminRoutes, { prefix: '/api/admin' });

app.get('/api/health', async () => ({ ok: true }));

app.get('/api/_debug/static', async () => ({
  cwd: process.cwd(),
  webDist,
  hasStatic,
  files: hasStatic ? fs.readdirSync(webDist).slice(0, 50) : []
}));

// ===== Not Found =====
app.setNotFoundHandler((req, reply) => {
  const url = req.raw.url || '';

  if (url.startsWith('/api/')) {
    reply.code(404).send({ error: 'Not Found' });
    return;
  }

  if (hasStatic) {
    reply.sendFile('viewer.html');
  } else {
    reply.code(404).send({
      error: 'Not Found',
      hint: 'Static dist missing, cannot serve pages. Check build output.',
    });
  }
});

// ===== Listen =====
const port = Number(process.env.PORT || config.port || 3000);
await app.listen({ port, host: '0.0.0.0' });
