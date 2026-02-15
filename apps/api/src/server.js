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
// Docker/railway 常见 cwd 是仓库根目录 /app
const webDistPrimary = path.resolve(process.cwd(), 'apps/web/dist');
// 兼容：如果未来以 apps/api 为 cwd 启动
const webDistFallback = path.resolve(process.cwd(), '../../apps/web/dist');

const hasPrimary = fs.existsSync(webDistPrimary);
const hasFallback = fs.existsSync(webDistFallback);

const webDist = hasPrimary ? webDistPrimary : webDistFallback;
const hasStatic = hasPrimary || hasFallback;

app.log.info(
  { cwd: process.cwd(), webDistPrimary, hasPrimary, webDistFallback, hasFallback, webDist, hasStatic },
  'Static dist check'
);

if (hasStatic) {
  await app.register(fastifyStatic, {
    root: webDist,
    prefix: '/',
  });

  // root
  app.get('/', (req, reply) => reply.sendFile('index.html'));

  // /securitydomain/*
  app.get('/securitydomain', (req, reply) => reply.sendFile('securitydomain.html'));
  app.get('/securitydomain/*', (req, reply) => reply.sendFile('securitydomain.html'));

  // /securityproduct/*
  app.get('/securityproduct', (req, reply) => reply.sendFile('securityproduct.html'));
  app.get('/securityproduct/*', (req, reply) => reply.sendFile('securityproduct.html'));

  // ✅ 新增：/company/*
  app.get('/company', (req, reply) => reply.sendFile('company.html'));
  app.get('/company/*', (req, reply) => reply.sendFile('company.html'));
} else {
  app.get('/', async () => ({
    ok: true,
    hint:
      'Static dist missing. Ensure build generates apps/web/dist (e.g. Dockerfile runs `npm run build` and Vite outputs to apps/web/dist).',
    cwd: process.cwd(),
    webDistPrimary,
    webDistFallback,
  }));
}

// ===== API =====
await app.register(viewerRoutes, { prefix: '/api' });
await app.register(adminRoutes, { prefix: '/api/admin' });

app.get('/api/health', async () => ({ ok: true }));

app.get('/api/_debug/static', async () => ({
  cwd: process.cwd(),
  webDistPrimary,
  hasPrimary,
  webDistFallback,
  hasFallback,
  webDistSelected: webDist,
  hasStatic,
  files: hasStatic ? fs.readdirSync(webDist).slice(0, 50) : [],
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
      cwd: process.cwd(),
      webDistPrimary,
      webDistFallback,
    });
  }
});

// ===== Listen =====
const port = Number(process.env.PORT || config.port || 3000);
await app.listen({ port, host: '0.0.0.0' });
