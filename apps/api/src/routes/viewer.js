// apps/api/src/routes/viewer.js
import { supabase } from '../supabase.js';

function normalizeQ(raw) {
  let q = String(raw ?? '').trim();
  if (!q) return q;
  if (q.toLowerCase().endsWith('.html')) q = q.slice(0, -5);
  return q;
}

export async function viewerRoutes(app) {
  app.get('/company/:q', async (req, reply) => {
    const qRaw = req.params?.q;
    const q = normalizeQ(qRaw);
    if (!q) return reply.code(400).send({ error: 'company query is empty' });

    const bySlug = await supabase
      .from('organization')
      .select('*')
      .eq('organization_slug', q)
      .maybeSingle();

    if (bySlug.error) return reply.code(500).send({ error: bySlug.error.message });
    if (bySlug.data) return reply.send(bySlug.data);

    const byShort = await supabase
      .from('organization')
      .select('*')
      .eq('company_short_name', q)
      .maybeSingle();

    if (byShort.error) return reply.code(500).send({ error: byShort.error.message });
    if (byShort.data) return reply.send(byShort.data);

    const byFull = await supabase
      .from('organization')
      .select('*')
      .eq('company_full_name', q)
      .maybeSingle();

    if (byFull.error) return reply.code(500).send({ error: byFull.error.message });
    if (byFull.data) return reply.send(byFull.data);

    return reply.code(404).send({ error: 'company not found' });
  });

  /**
   * GET /api/product/:q
   * - q: security_product_slug（优先）或 security_product_name（精确匹配兜底）
   * - 返回：
   *   - product 主记录字段
   *   - aliases: string[]
   *   - related_domains: {security_domain_id, security_domain_name, cybersecurity_domain_slug}[]
   */
  app.get('/product/:q', async (req, reply) => {
    const qRaw = req.params?.q;
    const q = normalizeQ(qRaw);

    if (!q) return reply.code(400).send({ error: 'product query is empty' });

    async function enrich(product) {
      // aliases
      const aliasRes = await supabase
        .from('cybersecurity_product_alias')
        .select('security_product_alias_name')
        .eq('security_product_id', product.security_product_id);

      if (aliasRes.error) return { error: aliasRes.error };

      const aliases = (aliasRes.data || [])
        .map((r) => r.security_product_alias_name)
        .filter(Boolean);

      // product -> domain ids via cybersecurity_product_domain
      const relRes = await supabase
        .from('cybersecurity_product_domain')
        .select('security_domain_id')
        .eq('security_product_id', product.security_product_id);

      if (relRes.error) return { error: relRes.error };

      const domainIds = (relRes.data || [])
        .map((r) => r.security_domain_id)
        .filter((v) => typeof v === 'number' || (typeof v === 'string' && v !== ''));

      let related_domains = [];
      if (domainIds.length) {
        // ✅ schema 中不存在 cybersecurity_domain_name，不能 select
        const domRes = await supabase
          .from('cybersecurity_domain')
          .select('security_domain_id, security_domain_name, cybersecurity_domain_slug')
          .in('security_domain_id', domainIds);

        if (domRes.error) return { error: domRes.error };

        related_domains = (domRes.data || [])
          .map((d) => ({
            security_domain_id: d.security_domain_id,
            security_domain_name: d.security_domain_name || '',
            cybersecurity_domain_slug: d.cybersecurity_domain_slug || '',
          }))
          .sort((a, b) =>
            String(a.security_domain_name || '').localeCompare(
              String(b.security_domain_name || ''),
              'zh-Hans-CN'
            )
          );
      }

      return { data: { ...product, aliases, related_domains } };
    }

    // 1) slug exact
    const bySlug = await supabase
      .from('cybersecurity_product')
      .select('*')
      .eq('security_product_slug', q)
      .maybeSingle();

    if (bySlug.error) return reply.code(500).send({ error: bySlug.error.message });
    if (bySlug.data) {
      const out = await enrich(bySlug.data);
      if (out.error) return reply.code(500).send({ error: out.error.message });
      return reply.send(out.data);
    }

    // 2) name exact
    const byName = await supabase
      .from('cybersecurity_product')
      .select('*')
      .eq('security_product_name', q)
      .maybeSingle();

    if (byName.error) return reply.code(500).send({ error: byName.error.message });
    if (byName.data) {
      const out = await enrich(byName.data);
      if (out.error) return reply.code(500).send({ error: out.error.message });
      return reply.send(out.data);
    }

    return reply.code(404).send({ error: 'product not found' });
  });

  /**
   * GET /api/domain/:q
   * - q: cybersecurity_domain_slug（优先）或 security_domain_name（精确匹配兜底）
   * - 返回：
   *   - domain 主记录字段
   *   - aliases: string[]
   *   - related_products: {security_product_id, security_product_name, security_product_slug}[]
   */
  app.get('/domain/:q', async (req, reply) => {
    const qRaw = req.params?.q;
    const q = normalizeQ(qRaw);

    if (!q) return reply.code(400).send({ error: 'domain query is empty' });

    async function enrich(domain) {
      const aliasRes = await supabase
        .from('cybersecurity_domain_alias')
        .select('security_domain_alias_name')
        .eq('security_domain_id', domain.security_domain_id);

      if (aliasRes.error) return { error: aliasRes.error };

      const aliases = (aliasRes.data || [])
        .map((r) => r.security_domain_alias_name)
        .filter(Boolean);

      const relRes = await supabase
        .from('cybersecurity_product_domain')
        .select('security_product_id')
        .eq('security_domain_id', domain.security_domain_id);

      if (relRes.error) return { error: relRes.error };

      const productIds = (relRes.data || [])
        .map((r) => r.security_product_id)
        .filter((v) => typeof v === 'number' || (typeof v === 'string' && v !== ''));

      let related_products = [];
      if (productIds.length) {
        const prodRes = await supabase
          .from('cybersecurity_product')
          .select('security_product_id, security_product_name, security_product_slug')
          .in('security_product_id', productIds);

        if (prodRes.error) return { error: prodRes.error };

        related_products = (prodRes.data || [])
          .slice()
          .sort((a, b) =>
            String(a.security_product_name || '').localeCompare(
              String(b.security_product_name || ''),
              'zh-Hans-CN'
            )
          );
      }

      return { data: { ...domain, aliases, related_products } };
    }

    const bySlug = await supabase
      .from('cybersecurity_domain')
      .select('*')
      .eq('cybersecurity_domain_slug', q)
      .maybeSingle();

    if (bySlug.error) return reply.code(500).send({ error: bySlug.error.message });
    if (bySlug.data) {
      const out = await enrich(bySlug.data);
      if (out.error) return reply.code(500).send({ error: out.error.message });
      return reply.send(out.data);
    }

    // ✅ schema 中没有 cybersecurity_domain_name，只用 security_domain_name
    const byName = await supabase
      .from('cybersecurity_domain')
      .select('*')
      .eq('security_domain_name', q)
      .maybeSingle();

    if (byName.error) return reply.code(500).send({ error: byName.error.message });
    if (byName.data) {
      const out = await enrich(byName.data);
      if (out.error) return reply.code(500).send({ error: out.error.message });
      return reply.send(out.data);
    }

    return reply.code(404).send({ error: 'domain not found' });
  });

  // 全局搜索：organizations/products/domains by name or slug
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
      // ✅ schema 中没有 cybersecurity_domain_name
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
