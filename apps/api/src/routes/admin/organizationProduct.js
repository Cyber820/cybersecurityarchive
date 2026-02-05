// apps/api/src/routes/admin/organizationProduct.js
import { supabase } from '../../supabase.js';
import { requireAdmin } from './auth.js';

export function registerOrganizationProductAdmin(app) {
  app.post('/organization-product', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const payload = req.body || {};
    const { data, error } = await supabase
      .from('organization_product')
      .insert(payload)
      .select('*')
      .single();

    if (error) return reply.code(400).send({ error: error.message });
    return reply.send(data);
  });
}
