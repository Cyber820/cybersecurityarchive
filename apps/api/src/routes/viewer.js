// apps/api/src/routes/viewer.js
// Public (viewer) API: domain / product / company pages + global search

import { supabase } from '../supabase.js';

/**
 * Helper: try slug first, then name (exact match).
 */
async function findOneBySlugOrName({ table, slugCol, nameCol, q }) {
  const bySlug = await supabase.from(table).select('*').eq(slugCol, q).maybeSingle();
  if (bySlug.error) return { data: null, error: bySlug.error };
  if (bySlug.data) return { data: bySlug.data, error: null };

  if (nameCol) {
    const byName = await supabase.from(table).select('*').eq(nameCol, q).maybeSingle();
    if (byName.error) return { data: null, error: byName.error };
    if (byName.data) return { data: byName.data, error: null };
  }

  return { data: null, error: null };
}

export async function viewerRoutes(app) {
  // ===== Domain page data =====
  app.get('/domain/:q', async (req, reply) => {
    const q = String(req.params?.q ?? '').trim();
    if (!q) return reply.code(400).send({ error: 'domain query is empty' });

    const { data: domain, error } = await findOneBySlugOrName({
      table: 'cybersecurity_domain',
      slugCol: 'cybersecurity_domain_slug',
      nameCol: 'security_domain_name',
      q,
    });
    if (error) return reply.code(500).send({ error: error.message });
    if (!domain) return reply.code(404).send({ error: 'domain not found' });

    const domainId = domain.security_domain_id;

    const [aliasesRes, mapRes] = await Promise.all([
      supabase
        .from('cybersecurity_domain_alias')
        .select('security_domain_alias_name')
        .eq('security_domain_id', domainId)
        .order('security_domain_alias_id', { ascending: true }),
      supabase
        .from('cybersecurity_product_domain')
        .select('security_product_id')
        .eq('security_domain_id', domainId),
    ]);

    const err = aliasesRes.error || mapRes.error;
    if (err) return reply.code(500).send({ error: err.message });

    const aliases = (aliasesRes.data || [])
      .map((r) => r.security_domain_alias_name)
      .filter(Boolean);

    const productIds = Array.from(
      new Set((mapRes.data || []).map((r) => r.security_product_id).filter((v) => v != null)),
    );

    let products = [];
    if (productIds.length) {
      const productsRes = await supabase
        .from('cybersecurity_product')
        .select('security_product_id, security_product_name, security_product_slug')
        .in('security_product_id', productIds)
        .order('security_product_name', { ascending: true });
      if (productsRes.error) return reply.code(500).send({ error: productsRes.error.message });
      products = productsRes.data || [];
    }

    return reply.send({ domain, aliases, products });
  });

  // ===== Product page data =====
  app.get('/product/:q', async (req, reply) => {
    const q = String(req.params?.q ?? '').trim();
    if (!q) return reply.code(400).send({ error: 'product query is empty' });

    const { data: product, error } = await findOneBySlugOrName({
      table: 'cybersecurity_product',
      slugCol: 'security_product_slug',
      nameCol: 'security_product_name',
      q,
    });
    if (error) return reply.code(500).send({ error: error.message });
    if (!product) return reply.code(404).send({ error: 'product not found' });

    const productId = product.security_product_id;

    const [aliasesRes, mapRes, recRes] = await Promise.all([
      supabase
        .from('cybersecurity_product_alias')
        .select('security_product_alias_name')
        .eq('security_product_id', productId)
        .order('security_product_alias_id', { ascending: true }),
      supabase
        .from('cybersecurity_product_domain')
        .select('security_domain_id')
        .eq('security_product_id', productId),
      supabase
        .from('organization_product')
        .select('organization_id')
        .eq('security_product_id', productId)
        .gte('recommendation_score', 8)
        .order('recommendation_score', { ascending: false })
        .limit(50),
    ]);

    const err = aliasesRes.error || mapRes.error || recRes.error;
    if (err) return reply.code(500).send({ error: err.message });

    const aliases = (aliasesRes.data || [])
      .map((r) => r.security_product_alias_name)
      .filter(Boolean);

    const domainIds = Array.from(
      new Set((mapRes.data || []).map((r) => r.security_domain_id).filter((v) => v != null)),
    );
    let domains = [];
    if (domainIds.length) {
      const domainsRes = await supabase
        .from('cybersecurity_domain')
        .select('security_domain_id, security_domain_name, cybersecurity_domain_slug')
        .in('security_domain_id', domainIds)
        .order('security_domain_name', { ascending: true });
      if (domainsRes.error) return reply.code(500).send({ error: domainsRes.error.message });
      domains = domainsRes.data || [];
    }

    const orgIds = Array.from(
      new Set((recRes.data || []).map((r) => r.organization_id).filter((v) => v != null)),
    );
    let recommended_companies_cn = [];
    if (orgIds.length) {
      const orgRes = await supabase
        .from('organization')
        .select('organization_id, organization_short_name, organization_full_name, organization_slug')
        .in('organization_id', orgIds)
        .order('organization_short_name', { ascending: true });
      if (orgRes.error) return reply.code(500).send({ error: orgRes.error.message });
      recommended_companies_cn = (orgRes.data || []).map((r) => ({
        organization_id: r.organization_id,
        organization_short_name: r.organization_short_name || r.organization_full_name || '',
        organization_slug: r.organization_slug,
      }));
    }

    return reply.send({
      product,
      aliases,
      domains,
      recommended_companies_cn,
      recommended_companies_global: [],
    });
  });

  // ===== Company page data =====
  app.get('/company/:q', async (req, reply) => {
    const q = String(req.params?.q ?? '').trim();
    if (!q) return reply.code(400).send({ error: 'company query is empty' });

    // slug exact first
    const bySlug = await supabase
      .from('organization')
      .select('*')
      .eq('organization_slug', q)
      .maybeSingle();
    if (bySlug.error) return reply.code(500).send({ error: bySlug.error.message });
    let company = bySlug.data;

    // short name exact
    if (!company) {
      const byShort = await supabase
        .from('organization')
        .select('*')
        .eq('organization_short_name', q)
        .maybeSingle();
      if (byShort.error) return reply.code(500).send({ error: byShort.error.message });
      company = byShort.data;
    }

    // full name exact
    if (!company) {
      const byFull = await supabase
        .from('organization')
        .select('*')
        .eq('organization_full_name', q)
        .maybeSingle();
      if (byFull.error) return reply.code(500).send({ error: byFull.error.message });
      company = byFull.data;
    }

    if (!company) return reply.code(404).send({ error: 'company not found' });

    const orgId = company.organization_id;
    const orgProdRes = await supabase
      .from('organization_product')
      .select('security_product_id, recommendation_score')
      .eq('organization_id', orgId)
      .order('recommendation_score', { ascending: false })
      .limit(200);
    if (orgProdRes.error) return reply.code(500).send({ error: orgProdRes.error.message });

    const prodIds = Array.from(
      new Set((orgProdRes.data || []).map((r) => r.security_product_id).filter((v) => v != null)),
    );

    let prodMap = new Map();
    if (prodIds.length) {
      const prodRes = await supabase
        .from('cybersecurity_product')
        .select('security_product_id, security_product_name, security_product_slug')
        .in('security_product_id', prodIds);
      if (prodRes.error) return reply.code(500).send({ error: prodRes.error.message });
      for (const p of prodRes.data || []) prodMap.set(p.security_product_id, p);
    }

    const products = (orgProdRes.data || [])
      .map((r) => {
        const p = prodMap.get(r.security_product_id);
        if (!p) return null;
        return {
          security_product_id: p.security_product_id,
          security_product_name: p.security_product_name,
          security_product_slug: p.security_product_slug,
          recommendation_score: r.recommendation_score ?? null,
        };
      })
      .filter(Boolean);

    return reply.send({ company, products });
  });

  // ===== Global search =====
  app.get('/search', async (req, reply) => {
    const q = String(req.query?.q || '').trim();
    if (!q) return reply.send({ q, companies: [], products: [], domains: [] });

    const [companies, products, domains] = await Promise.all([
      supabase
        .from('organization')
        .select('organization_id, organization_short_name, organization_full_name, organization_slug')
        .or(
          `organization_short_name.ilike.%${q}%,organization_full_name.ilike.%${q}%,organization_slug.ilike.%${q}%`,
        )
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
