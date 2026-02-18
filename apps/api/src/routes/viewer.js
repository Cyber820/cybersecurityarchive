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
      recommended_companies_cn = orgRes.data || [];
    }

    return reply.send({ product, aliases, domains, recommended_companies_cn });
  });

  // ===== Company page data =====
  app.get('/company/:q', async (req, reply) => {
    const q = String(req.params?.q ?? '').trim();
    if (!q) return reply.code(400).send({ error: 'company query is empty' });

    const { data: company, error } = await findOneBySlugOrName({
      table: 'organization',
      slugCol: 'organization_slug',
      nameCol: 'organization_short_name',
      q,
    });

    if (error) return reply.code(500).send({ error: error.message });
    if (!company) return reply.code(404).send({ error: 'company not found' });

    const orgId = company.organization_id;

    const orgProdRes = await supabase
      .from('organization_product')
      .select('security_product_id, recommendation_score')
      .eq('organization_id', orgId)
      .order('recommendation_score', { ascending: false })
      .limit(100);

    if (orgProdRes.error) return reply.code(500).send({ error: orgProdRes.error.message });

    const productIds = Array.from(
      new Set((orgProdRes.data || []).map((r) => r.security_product_id).filter((v) => v != null)),
    );

    let prodMap = new Map();
    if (productIds.length) {
      const prodRes = await supabase
        .from('cybersecurity_product')
        .select('security_product_id, security_product_name, security_product_slug')
        .in('security_product_id', productIds)
        .order('security_product_name', { ascending: true });
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
    if (!q) return reply.send({ q, items: [], companies: [], products: [], domains: [] });

    // 1) 主表搜索（保持原逻辑，兼容旧 global-search 小组件）
    const [companiesRes, productsRes, domainsRes] = await Promise.all([
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

    const err0 = companiesRes.error || productsRes.error || domainsRes.error;
    if (err0) return reply.code(500).send({ error: err0.message });

    const companies = companiesRes.data || [];
    const products = productsRes.data || [];
    const domains = domainsRes.data || [];

    // 2) 别名搜索（新增）
    const [productAliasesRes, domainAliasesRes] = await Promise.all([
      supabase
        .from('cybersecurity_product_alias')
        .select('security_product_alias_id, security_product_alias_name, security_product_id')
        .ilike('security_product_alias_name', `%${q}%`)
        .limit(30),
      supabase
        .from('cybersecurity_domain_alias')
        .select('security_domain_alias_id, security_domain_alias_name, security_domain_id')
        .ilike('security_domain_alias_name', `%${q}%`)
        .limit(30),
    ]);

    const err1 = productAliasesRes.error || domainAliasesRes.error;
    if (err1) return reply.code(500).send({ error: err1.message });

    const productAliases = productAliasesRes.data || [];
    const domainAliases = domainAliasesRes.data || [];

    // 3) 为别名补主名 + slug（批量查）
    const mainProductIds = Array.from(new Set(productAliases.map((x) => x.security_product_id).filter((v) => v != null)));
    const mainDomainIds = Array.from(new Set(domainAliases.map((x) => x.security_domain_id).filter((v) => v != null)));

    let mainProductsById = new Map();
    let mainDomainsById = new Map();

    if (mainProductIds.length) {
      const mp = await supabase
        .from('cybersecurity_product')
        .select('security_product_id, security_product_name, security_product_slug')
        .in('security_product_id', mainProductIds);
      if (mp.error) return reply.code(500).send({ error: mp.error.message });
      for (const p of mp.data || []) mainProductsById.set(p.security_product_id, p);
    }

    if (mainDomainIds.length) {
      const md = await supabase
        .from('cybersecurity_domain')
        .select('security_domain_id, security_domain_name, cybersecurity_domain_slug')
        .in('security_domain_id', mainDomainIds);
      if (md.error) return reply.code(500).send({ error: md.error.message });
      for (const d of md.data || []) mainDomainsById.set(d.security_domain_id, d);
    }

    // 4) 统一 items（供 search.html 使用）
    const items = [];

    // 企业：title = 全称(若 null 则简称)，小字类型“企业”，href 指向 company 页面
    for (const c of companies) {
      const title = c.organization_full_name || c.organization_short_name || c.organization_slug || '（未命名）';
      const slug = c.organization_slug || c.organization_short_name || '';
      items.push({
        kind: 'organization',
        is_alias: false,
        title,
        type_label: '企业',
        aka: null,
        href: `/company/${encodeURIComponent(slug)}`,
      });
    }

    // 主产品
    for (const p of products) {
      const title = p.security_product_name || p.security_product_slug || '（未命名）';
      const slug = p.security_product_slug || '';
      items.push({
        kind: 'product',
        is_alias: false,
        title,
        type_label: '安全产品',
        aka: null,
        href: `/securityproduct/${encodeURIComponent(slug)}`,
      });
    }

    // 主领域
    for (const d of domains) {
      const title = d.security_domain_name || d.cybersecurity_domain_slug || '（未命名）';
      const slug = d.cybersecurity_domain_slug || '';
      items.push({
        kind: 'domain',
        is_alias: false,
        title,
        type_label: '安全领域',
        aka: null,
        href: `/securitydomain/${encodeURIComponent(slug)}`,
      });
    }

    // 产品别名：显示 alias 名；又称：主产品名；href 跳主产品
    for (const a of productAliases) {
      const main = mainProductsById.get(a.security_product_id) || null;
      const mainName = main?.security_product_name || main?.security_product_slug || null;
      const mainSlug = main?.security_product_slug || '';
      items.push({
        kind: 'product',
        is_alias: true,
        title: a.security_product_alias_name || '（未命名别称）',
        type_label: '安全产品',
        aka: mainName ? `又称：${mainName}` : null,
        href: `/securityproduct/${encodeURIComponent(mainSlug)}`,
      });
    }

    // 领域别名：显示 alias 名；又称：主领域名；href 跳主领域
    for (const a of domainAliases) {
      const main = mainDomainsById.get(a.security_domain_id) || null;
      const mainName = main?.security_domain_name || main?.cybersecurity_domain_slug || null;
      const mainSlug = main?.cybersecurity_domain_slug || '';
      items.push({
        kind: 'domain',
        is_alias: true,
        title: a.security_domain_alias_name || '（未命名别称）',
        type_label: '安全领域',
        aka: mainName ? `又称：${mainName}` : null,
        href: `/securitydomain/${encodeURIComponent(mainSlug)}`,
      });
    }

    // 简单去重（kind+title+href）
    const seen = new Set();
    const deduped = [];
    for (const it of items) {
      const key = `${it.kind}::${it.title}::${it.href}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(it);
    }

    return reply.send({
      q,
      // ✅ 新：统一结果列表（search.html 主要用它）
      items: deduped,
      // ✅ 旧：保持兼容（其他页面 global-search 小组件仍可用）
      companies,
      products,
      domains,
    });
  });
}
