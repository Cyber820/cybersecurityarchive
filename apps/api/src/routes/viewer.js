import { supabase } from '../supabase.js';

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

  app.get('/product/:slug', async (req, reply) => {
    const { slug } = req.params;

    const { data, error } = await supabase
      .from('cybersecurity_product')
      .select('*')
      .eq('security_product_slug', slug)
      .maybeSingle();

    if (error) return reply.code(500).send({ error: error.message });
    if (!data) return reply.code(404).send({ error: 'product not found' });
    return reply.send(data);
  });

  app.get('/domain/:slug', async (req, reply) => {
    const { slug } = req.params;

    const { data, error } = await supabase
      .from('cybersecurity_domain')
      .select('*')
      .eq('cybersecurity_domain_slug', slug)
      .maybeSingle();

    if (error) return reply.code(500).send({ error: error.message });
    if (!data) return reply.code(404).send({ error: 'domain not found' });
    return reply.send(data);
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
