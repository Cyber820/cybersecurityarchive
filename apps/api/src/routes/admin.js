import { supabase } from '../supabase.js';
import { config } from '../config.js';

function requireAdmin(req, reply) {
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

export async function adminRoutes(app) {
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

  app.post('/product', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;

    const payload = req.body || {};
    const { data, error } = await supabase
      .from('cybersecurity_product')
      .insert(payload)
      .select('*')
      .single();

    if (error) return reply.code(400).send({ error: error.message });
    return reply.send(data);
  });

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

  // relation: organization_product
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

  // relation: cybersecurity_product_domain
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
