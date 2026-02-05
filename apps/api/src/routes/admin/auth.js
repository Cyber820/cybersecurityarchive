// apps/api/src/routes/admin/auth.js
import { config } from '../../config.js';

export function requireAdmin(req, reply) {
  const header = req.headers['x-admin-token'];
  const token = Array.isArray(header) ? header[0] : header;

  if (!config.adminToken) {
    reply.code(500).send({ error: 'ADMIN_TOKEN not set on server' });
    return false;
  }
  if (!token || token !== config.adminToken) {
    reply.code(401).send({ error: 'unauthorized' });
    return false;
  }
  return true;
}
