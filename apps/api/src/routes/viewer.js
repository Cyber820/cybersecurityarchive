// apps/api/src/routes/viewer.js
import { supabase } from '../supabase.js';

function normalizeQ(raw) {
  let q = String(raw ?? '').trim();
  if (!q) return q;
  if (q.toLowerCase().endsWith('.html')) q = q.slice(0, -5);
  return q;
}

export async function viewerRoutes(app) {
  app.get('/company/:slug', async (req, reply) => {
    const { slug } = req.params;

    const { data, error } = await supabase
      .from('organization')
      .select('*')
      .eq('organization_slug', slug)
      .maybeSingle();

    if (error) return reply.code(500).send({ error: error.message });
    if (!data) return reply.code(404).send({ error: 'company not found' });
    return reply.send(data);
  });

  /**
   * GET /api/product/:q
   * - q 可以是 security_product_slug（优先）
   * - 也可以是 security_product_name（精确匹配兜底）
   */
  app.get('/product/:q', async (req, reply) => {
    const qRaw = req.params?.q;
    const q = normalizeQ(qRaw);

    if (!q) return reply.code(400).send({ error: 'product query is empty' });

    // 1) slug exact
    const bySlug = await supabase
      .from('cybersecurity_product')
      .select('*')
      .eq('security_product_slug', q)
      .maybeSingle();

    if (bySlug.error) return reply.code(500).send({ error: bySlug.error.message });
    if (bySlug.data) return reply.send(bySlug.data);

    // 2) name exact
    const byName = await supabase
      .from('cybersecurity_product')
      .select('*')
      .eq('security_product_name', q)
      .maybeSingle();

    if (byName.error) return reply.code(500).send({ error: byName.error.message });
    if (byName.data) return reply.send(byName.data);

    return reply.code(404).send({ error: 'product not found' });
  });

  /**
   * GET /api/domain/:q
   * - q 可以是 cybersecurity_domain_slug（优先）
   * - 也可以是 security_domain_name（精确匹配兜底）
   */
  app.get('/domain/:q', async (req, reply) => {
    const qRaw = req.params?.q;
    const q = normalizeQ(qRaw);

    if (!q) return reply.code(400).send({ error: 'domain query is empty' });

    // 1) try slug exact match
    const bySlug = await supabase
      .from('cybersecurity_domain')
      .select('*')
      .eq('cybersecurity_domain_slug', q)
      .maybeSingle();

    if (bySlug.error) return reply.code(500).send({ error: bySlug.error.message });
    if (bySlug.data) return reply.send(bySlug.data);

    // 2) try name exact match
    const byName = await supabase
      .from('cybersecurity_domain')
      .select('*')
      .eq('security_domain_name', q)
      .maybeSingle();

    if (byName.error) return reply.code(500).send({ error: byName.error.message });
    if (byName.data) return reply.send(byName.data);

    return reply.code(404).send({ error: 'domain not found' });
  });

  // Minimal search: query organizations/products/domains by name or slug
  app.get('/search', async (req, reply) => {
    const q = String(req.query?.q || '').trim();
    if (!q) return reply.send({ q, companies: [], products: [], domains: [] });

    const [companies, products, domains] = await Promise.all([
      supabase
        .from('organization')
        .select('organization_id, company_short_name, company_full_name, organization_slug')
        .or(`company_short_name.ilike.%${q}%,company_full_name.ilike.%${q}%,organization_slug.ilike.%${q}%`)
        .limit(30),
      supabase
        .from('cybersecurity_product')
        .select('security_product_id, security_product_name, security_product_slug')
        .or(`security_product_name.ilike.%${q}%,security_product_slug.ilike.%${q}%`)
        .limit(30),
      supabase
        .from('cybersecurity_domain')
        .select('security_domain_id, security_domain_name, cybersecurity_domain_slug')
        .or(`security_domain_name.ilike.%${q}%,cybersecurity_domain_slug.ilike.%${q}%`)
        .limit(30),
    ]);

    const err = companies.error || products.error || domains.error;
    if (err) return reply.code(500).send({ error: err.message });

    return reply.send({
      q,
      companies: companies.data || [],
      products: products.data || [],
      domains: domains.data || [],
    });
  });
}
