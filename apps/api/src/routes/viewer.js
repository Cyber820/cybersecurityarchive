// apps/api/src/routes/viewer.js
// Public (viewer) API: domain / product / company pages + global search + solution search

import { supabase } from '../supabase.js';

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

function scoreTier(score) {
  // ✅ 不向前端暴露 score；仅返回 tier（样式分桶）
  const s = (score === null || score === undefined) ? null : Number(score);
  if (!Number.isFinite(s)) return 'normal';
  if (s >= 8) return 'high';
  if (s >= 6) return 'mid';
  return 'normal'; // 0-5
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

  // ===== Global search (keep existing) =====
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

  // =========================================================
  // ✅ Solution Search: product suggestions
  // GET /api/solution/products?q=
  // - 返回主产品 + 别名（别名会映射到主产品 id）
  // =========================================================
  app.get('/solution/products', async (req, reply) => {
    const q = String(req.query?.q || '').trim();
    if (!q) return reply.send({ q, items: [] });

    const [mainRes, aliasRes] = await Promise.all([
      supabase
        .from('cybersecurity_product')
        .select('security_product_id, security_product_name, security_product_slug')
        .or(`security_product_name.ilike.%${q}%,security_product_slug.ilike.%${q}%`)
        .limit(20),
      supabase
        .from('cybersecurity_product_alias')
        .select('security_product_alias_id, security_product_alias_name, security_product_id')
        .ilike('security_product_alias_name', `%${q}%`)
        .limit(20),
    ]);

    const err = mainRes.error || aliasRes.error;
    if (err) return reply.code(500).send({ error: err.message });

    const mains = mainRes.data || [];
    const aliases = aliasRes.data || [];

    const mainIds = Array.from(new Set(aliases.map(a => a.security_product_id).filter(v => v != null)));
    let mainById = new Map();

    if (mainIds.length) {
      const mp = await supabase
        .from('cybersecurity_product')
        .select('security_product_id, security_product_name, security_product_slug')
        .in('security_product_id', mainIds);
      if (mp.error) return reply.code(500).send({ error: mp.error.message });
      for (const p of mp.data || []) mainById.set(p.security_product_id, p);
    }

    const items = [];

    for (const p of mains) {
      items.push({
        id: p.security_product_id,
        name: p.security_product_name || p.security_product_slug || '（未命名产品）',
        slug: p.security_product_slug || '',
        is_alias: false,
        main_name: null,
      });
    }

    for (const a of aliases) {
      const main = mainById.get(a.security_product_id);
      items.push({
        // ✅ 关键：别名也返回主产品 id（前端选中后只保存主 id）
        id: a.security_product_id,
        name: a.security_product_alias_name || '（未命名别称）',
        slug: main?.security_product_slug || '',
        is_alias: true,
        main_name: main?.security_product_name || main?.security_product_slug || null,
      });
    }

    // 去重：同一个主产品 id 可能重复出现（主/别名同时命中）
    // 这里不强行去重，让用户能看到“别称·又称”这一类提示；但限制总条数
    return reply.send({ q, items: items.slice(0, 30) });
  });

  // =========================================================
  // ✅ Solution Search: find organizations that have ALL selected products
  // POST /api/solution/search { product_ids: number[] }
  // - 服务端用 recommendation_score 做排序（总分降序）
  // - 绝不返回 score，只返回 tier 供前端样式
  // =========================================================
  app.post('/solution/search', async (req, reply) => {
    const idsRaw = req.body?.product_ids;
    const productIds = Array.isArray(idsRaw) ? idsRaw.map(Number).filter(Number.isFinite) : [];
    const uniq = Array.from(new Set(productIds)).filter((x) => Number.isInteger(x));

    if (!uniq.length) return reply.send({ product_ids: [], items: [] });
    if (uniq.length > 20) return reply.code(400).send({ error: 'Too many products (max 20).' });

    // 1) 取 organization_product 中匹配这些产品的所有行
    const opRes = await supabase
      .from('organization_product')
      .select('organization_id, security_product_id, recommendation_score')
      .in('security_product_id', uniq)
      .limit(5000);

    if (opRes.error) return reply.code(500).send({ error: opRes.error.message });

    // 2) 按 organization_id 聚合：必须覆盖全部 productIds
    //    totalScore 仅用于排序（不返回给前端）
    const needN = uniq.length;
    const byOrg = new Map(); // orgId -> { seen:Set, rows:Map(productId->score), totalScore:number }
    for (const r of opRes.data || []) {
      const orgId = r.organization_id;
      const pid = r.security_product_id;
      if (orgId == null || pid == null) continue;

      let g = byOrg.get(orgId);
      if (!g) {
        g = { seen: new Set(), rows: new Map(), totalScore: 0 };
        byOrg.set(orgId, g);
      }

      // 去重同产品（保险）
      if (!g.seen.has(pid)) {
        g.seen.add(pid);
        g.rows.set(pid, r.recommendation_score ?? null);

        const s = Number(r.recommendation_score);
        if (Number.isFinite(s)) g.totalScore += s;
      }
    }

    const matchedOrgIds = [];
    for (const [orgId, g] of byOrg.entries()) {
      if (g.seen.size === needN) matchedOrgIds.push(orgId);
    }

    if (!matchedOrgIds.length) return reply.send({ product_ids: uniq, items: [] });

    // 3) 获取企业信息
    const orgRes = await supabase
      .from('organization')
      .select('organization_id, organization_short_name, organization_full_name, organization_slug')
      .in('organization_id', matchedOrgIds);

    if (orgRes.error) return reply.code(500).send({ error: orgRes.error.message });

    const orgById = new Map();
    for (const o of orgRes.data || []) orgById.set(o.organization_id, o);

    // 4) 获取产品主名（按选择的 productIds）
    const prodRes = await supabase
      .from('cybersecurity_product')
      .select('security_product_id, security_product_name, security_product_slug')
      .in('security_product_id', uniq);

    if (prodRes.error) return reply.code(500).send({ error: prodRes.error.message });

    const prodById = new Map();
    for (const p of prodRes.data || []) prodById.set(p.security_product_id, p);

    // 5) 构造 items：按 totalScore 降序（仅服务器内部）
    const items = [];
    for (const orgId of matchedOrgIds) {
      const o = orgById.get(orgId);
      const g = byOrg.get(orgId);
      if (!o || !g) continue;

      const products = uniq.map((pid) => {
        const p = prodById.get(pid);
        const score = g.rows.get(pid); // 仅用于 tier
        return {
          id: pid,
          name: p?.security_product_name || p?.security_product_slug || `产品 ${pid}`,
          slug: p?.security_product_slug || '',
          tier: scoreTier(score),
        };
      });

      items.push({
        organization: o,
        products,
        _sort_total: g.totalScore, // 内部字段，稍后删除
      });
    }

    items.sort((a, b) => {
      const da = Number(a._sort_total) || 0;
      const db = Number(b._sort_total) || 0;
      if (db !== da) return db - da;

      const an = (a.organization?.organization_short_name || '').toLowerCase();
      const bn = (b.organization?.organization_short_name || '').toLowerCase();
      if (an < bn) return -1;
      if (an > bn) return 1;
      return 0;
    });

    // 删除内部字段，确保前端拿不到分数信息
    const out = items.slice(0, 60).map((x) => {
      const { _sort_total, ...rest } = x;
      return rest;
    });

    return reply.send({ product_ids: uniq, items: out });
  });
}
