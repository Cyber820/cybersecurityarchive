// apps/api/src/server.js
import Fastify from 'fastify';
import path from 'node:path';
import fs from 'node:fs';

import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';

import { config } from './config.js';
import { viewerRoutes } from './routes/viewer.js';
import { adminRoutes } from './routes/admin.js';

const app = Fastify({ logger: true });

// 同域一般不需要 CORS；保守起见开着也行
await app.register(fastifyCors, { origin: true });

// ===== Static hosting (Vite build output) =====
// Railway/monorepo 下最稳：从 cwd 指向 apps/web/dist
const webDist = path.resolve(process.cwd(), '../../apps/web/dist');

const hasStatic = fs.existsSync(webDist);

// 让你能在日志里看到到底有没有 dist
app.log.info({ webDist, hasStatic }, 'Static dist check');

if (hasStatic) {
  await app.register(fastifyStatic, {
    root: webDist,
    prefix: '/',
    // optional: set this true if you want to serve precompressed assets
    // preCompressed: true,
  });

  // 显式处理 / -> index.html（不要依赖目录 index 自动解析）
  app.get('/', (req, reply) => reply.sendFile('index.html'));
} else {
  // dist 缺失也不要让服务挂掉：至少让 API 能跑
  app.get('/', async () => ({
    ok: true,
    hint: 'Static dist missing. Ensure Railway Build Command runs `npm run build` and Vite outputs to apps/web/dist.',
    webDist,
  }));
}

// ===== API =====
await app.register(viewerRoutes, { prefix: '/api' });
await app.register(adminRoutes, { prefix: '/api/admin' });

// health check
app.get('/api/health', async () => ({ ok: true }));

// debug endpoint (safe): helps confirm dist presence on Railway
app.get('/api/_debug/static', async () => ({
  cwd: process.cwd(),
  webDist,
  hasStatic,
  files: hasStatic ? fs.readdirSync(webDist).slice(0, 50) : []
}));

// ===== Not Found =====
// API: strict 404 JSON
// Pages: if we have static, fall back to viewer.html; else JSON
app.setNotFoundHandler((req, reply) => {
  const url = req.raw.url || '';

  if (url.startsWith('/api/')) {
    reply.code(404).send({ error: 'Not Found' });
    return;
  }

  if (hasStatic) {
    // 你如果想让未知页面落到 index.html，也可以改成 index.html
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
