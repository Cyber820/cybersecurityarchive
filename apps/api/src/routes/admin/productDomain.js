// apps/api/src/routes/admin/productDomain.js
import { supabase } from '../../supabase.js';
import { requireAdmin } from './auth.js';

export function registerProductDomainAdmin(app) {
  app.post('/product-domain', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const payload = req.body || {};
    const { data, error } = await supabase
      .from('cybersecurity_product_domain')
      .insert(payload)
      .select('*')
      .single();

    if (error) return reply.code(400).send({ error: error.message });
    return reply.send(data);
  });
}
