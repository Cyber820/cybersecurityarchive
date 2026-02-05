// apps/api/src/routes/admin/domain.js
import { supabase } from '../../supabase.js';
import { requireAdmin } from './auth.js';

export function registerDomainAdmin(app) {
  app.post('/domain', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const payload = req.body || {};
    const { data, error } = await supabase
      .from('cybersecurity_domain')
      .insert(payload)
      .select('*')
      .single();

    if (error) return reply.code(400).send({ error: error.message });
    return reply.send(data);
  });
}
