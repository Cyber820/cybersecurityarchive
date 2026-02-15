// apps/api/src/routes/viewer.js
import { supabase } from '../supabase.js';

function pickFirst(rows) {
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export async function viewerRoutes(app) {
  // ===== 全站搜索 =====
  app.get('/search', async (req, reply) => {
    const q = String(req.query?.q ?? '').trim();
    if (!q) return { companies: [], products: [], domains: [] };

    // 企业/机构：按 slug / 简称 / 全称搜索
    const companiesQ = supabase
      .from('organization')
      .select('organization_id, organization_slug, organization_short_name, organization_full_name')
      .or(
        [
          `organization_slug.eq.${q}`,
          `organization_short_name.ilike.%${q}%`,
          `organization_full_name.ilike.%${q}%`,
        ].join(',')
      )
      .limit(20);

    // 安全产品：按 slug / name
    const productsQ = supabase
      .from('cybersecurity_product')
      .select('security_product_id, security_product_name, security_product_slug')
      .or(
        [
          `security_product_slug.eq.${q}`,
          `security_product_name.ilike.%${q}%`,
        ].join(',')
      )
      .limit(20);

    // 网安领域：按 slug / name
    const domainsQ = supabase
      .from('cybersecurity_domain')
      .select('security_domain_id, security_domain_name, cybersecurity_domain_slug')
      .or(
        [
          `cybersecurity_domain_slug.eq.${q}`,
          `security_domain_name.ilike.%${q}%`,
        ].join(',')
      )
      .limit(20);

    const [companiesR, productsR, domainsR] = await Promise.all([companiesQ, productsQ, domainsQ]);

    if (companiesR.error) reply.code(500);
    if (productsR.error) reply.code(500);
    if (domainsR.error) reply.code(500);

    return {
      companies: companiesR.data ?? [],
      products: productsR.data ?? [],
      domains: domainsR.data ?? [],
      errors: {
        companies: companiesR.error?.message || null,
        products: productsR.error?.message || null,
        domains: domainsR.error?.message || null,
      },
    };
  });

  // ===== 网安领域详情（已存在逻辑，保留）=====
  app.get('/domain/:q', async (req, reply) => {
    const q = String(req.params?.q ?? '').trim();

    const { data: rows, error } = await supabase
      .from('cybersecurity_domain')
      .select('*')
      .or(`cybersecurity_domain_slug.eq.${q},security_domain_name.eq.${q}`)
      .limit(10);

    if (error) return reply.code(500).send({ error: error.message });

    const exactSlug = rows?.find((r) => r.cybersecurity_domain_slug === q);
    const exactName = rows?.find((r) => r.security_domain_name === q);
    const domain = exactSlug || exactName || pickFirst(rows);

    if (!domain) return reply.code(404).send({ error: 'domain not found' });

    return domain;
  });

  // ===== 安全产品详情（已存在逻辑，保留）=====
  app.get('/product/:q', async (req, reply) => {
    const q = String(req.params?.q ?? '').trim();

    const { data: rows, error } = await supabase
      .from('cybersecurity_product')
      .select('*')
      .or(`security_product_slug.eq.${q},security_product_name.eq.${q}`)
      .limit(10);

    if (error) return reply.code(500).send({ error: error.message });

    const exactSlug = rows?.find((r) => r.security_product_slug === q);
    const exactName = rows?.find((r) => r.security_product_name === q);
    const product = exactSlug || exactName || pickFirst(rows);

    if (!product) return reply.code(404).send({ error: 'product not found' });

    return product;
  });

  // ===== 企业/机构详情 + 企业产品清单 =====
  app.get('/company/:q', async (req, reply) => {
    const q = String(req.params?.q ?? '').trim();

    // 1) 找 organization（优先 slug 精确，其次简称/全称匹配）
    const { data: rows, error } = await supabase
      .from('organization')
      .select('*')
      .or(
        [
          `organization_slug.eq.${q}`,
          `organization_short_name.eq.${q}`,
          `organization_full_name.eq.${q}`,
          `organization_short_name.ilike.%${q}%`,
          `organization_full_name.ilike.%${q}%`,
        ].join(',')
      )
      .limit(20);

    if (error) return reply.code(500).send({ error: error.message });

    const exactSlug = rows?.find((r) => r.organization_slug === q);
    const exactShort = rows?.find((r) => r.organization_short_name === q);
    const exactFull = rows?.find((r) => r.organization_full_name === q);
    const org = exactSlug || exactShort || exactFull || pickFirst(rows);

    if (!org) return reply.code(404).send({ error: 'company not found' });

    // 2) 拉企业产品（organization_product）并补齐产品名/slug
    const { data: orgProducts, error: opErr } = await supabase
      .from('organization_product')
      .select('organization_product_id, organization_id, security_product_id, product_release_year, product_end_year, recommendation_score')
      .eq('organization_id', org.organization_id)
      .order('recommendation_score', { ascending: false, nullsFirst: false });

    if (opErr) return reply.code(500).send({ error: opErr.message });

    const productIds = Array.from(new Set((orgProducts ?? []).map((r) => r.security_product_id).filter(Boolean)));
    let productsMap = new Map();

    if (productIds.length) {
      const { data: products, error: pErr } = await supabase
        .from('cybersecurity_product')
        .select('security_product_id, security_product_name, security_product_slug')
        .in('security_product_id', productIds);

      if (pErr) return reply.code(500).send({ error: pErr.message });

      productsMap = new Map((products ?? []).map((p) => [p.security_product_id, p]));
    }

    const merged = (orgProducts ?? []).map((r) => {
      const p = productsMap.get(r.security_product_id) || null;
      return {
        ...r,
        product: p,
      };
    });

    return {
      organization: org,
      products: merged,
    };
  });
}
