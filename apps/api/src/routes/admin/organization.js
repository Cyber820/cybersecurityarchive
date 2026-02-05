// apps/api/src/routes/admin/organization.js
import { supabase } from '../../supabase.js';
import { requireAdmin } from './auth.js';

export function registerOrganizationAdmin(app) {
  app.post('/organization', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const payload = req.body || {};
    const { data, error } = await supabase
      .from('organization')
      .insert(payload)
      .select('*')
      .single();

    if (error) return reply.code(400).send({ error: error.message });
    return reply.send(data);
  });
}
