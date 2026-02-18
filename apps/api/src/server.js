// apps/api/src/server.js
import Fastify from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';

import { config } from './config.js';
import { viewerRoutes } from './routes/viewer.js';
import { adminRoutes } from './routes/admin/index.js';

const app = Fastify({ logger: true });

await app.register(fastifyCors, { origin: true });

// ===== Static hosting (Vite build output) =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// => .../apps/web/dist
const webDist = path.resolve(__dirname, '../../web/dist');
const hasStatic = fs.existsSync(webDist);

app.log.info({ webDist, hasStatic, cwd: process.cwd() }, 'Static dist check');

if (hasStatic) {
  await app.register(fastifyStatic, {
    root: webDist,
    prefix: '/',
  });

  // root
  app.get('/', (req, reply) => reply.sendFile('index.html'));

  // ✅ /search 落地到 search.html
  app.get('/search', (req, reply) => reply.sendFile('search.html'));
  app.get('/search/*', (req, reply) => reply.sendFile('search.html'));

  // ✅ /securitydomain/* 落地到 securitydomain.html
  app.get('/securitydomain', (req, reply) => reply.sendFile('securitydomain.html'));
  app.get('/securitydomain/*', (req, reply) => reply.sendFile('securitydomain.html'));

  // ✅ /securityproduct/* 落地到 securityproduct.html
  app.get('/securityproduct', (req, reply) => reply.sendFile('securityproduct.html'));
  app.get('/securityproduct/*', (req, reply) => reply.sendFile('securityproduct.html'));

  // ✅ /company/* 落地到 company.html
  app.get('/company', (req, reply) => reply.sendFile('company.html'));
  app.get('/company/*', (req, reply) => reply.sendFile('company.html'));

  // ✅ admin
  app.get('/admin', (req, reply) => reply.sendFile('admin.html'));
  app.get('/admin/*', (req, reply) => reply.sendFile('admin.html'));
} else {
  app.get('/', async () => ({
    ok: true,
    hint: 'Static dist missing. Ensure build outputs to apps/web/dist.',
    webDist,
    cwd: process.cwd(),
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
  files: hasStatic ? fs.readdirSync(webDist).slice(0, 80) : [],
}));

// ===== Not Found =====
app.setNotFoundHandler((req, reply) => {
  const url = req.raw.url || '';

  if (url.startsWith('/api/')) {
    reply.code(404).send({ error: 'Not Found' });
    return;
  }

  if (hasStatic) {
    if (url.startsWith('/search')) return reply.sendFile('search.html');
    if (url.startsWith('/securitydomain')) return reply.sendFile('securitydomain.html');
    if (url.startsWith('/securityproduct')) return reply.sendFile('securityproduct.html');
    if (url.startsWith('/company')) return reply.sendFile('company.html');
    if (url.startsWith('/admin')) return reply.sendFile('admin.html');
    return reply.sendFile('viewer.html');
  } else {
    reply.code(404).send({
      error: 'Not Found',
      hint: 'Static dist missing, cannot serve pages. Check build output.',
      webDist,
      cwd: process.cwd(),
    });
  }
});

// ===== Listen =====
const port = Number(process.env.PORT || config.port || 3000);
await app.listen({ port, host: '0.0.0.0' });
