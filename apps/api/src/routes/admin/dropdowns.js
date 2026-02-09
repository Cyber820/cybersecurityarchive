// apps/api/src/routes/admin/dropdowns.js
import { supabase } from '../../supabase.js'
import { requireAdmin } from './auth.js'

export function registerDropdownAdmin(app) {
  /**
   * Base dropdowns (existing / compatible)
   */
  app.get('/dropdowns/products', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const q = String(req.query?.q || '').trim()
    const limit = clampInt(req.query?.limit, 200, 1, 500)

    let query = supabase
      .from('cybersecurity_product')
      .select('security_product_id, security_product_name, security_product_slug')
      .order('security_product_name', { ascending: true })
      .limit(limit)

    if (q) {
      query = query.or(
        `security_product_name.ilike.%${escapeLike(q)}%,security_product_slug.ilike.%${escapeLike(q)}%`
      )
    }

    const { data, error } = await query
    if (error) return reply.code(400).send({ error: error.message })

    const items = (data || []).map((x) => ({
      id: x.security_product_id,
      name: x.security_product_name,
      slug: x.security_product_slug
    }))

    return reply.send({ items, count: items.length, q })
  })

  app.get('/dropdowns/domains', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const q = String(req.query?.q || '').trim()
    const limit = clampInt(req.query?.limit, 200, 1, 500)

    let query = supabase
      .from('cybersecurity_domain')
      .select('security_domain_id, security_domain_name, cybersecurity_domain_slug')
      .order('security_domain_name', { ascending: true })
      .limit(limit)

    if (q) {
      query = query.or(
        `security_domain_name.ilike.%${escapeLike(q)}%,cybersecurity_domain_slug.ilike.%${escapeLike(q)}%`
      )
    }

    const { data, error } = await query
    if (error) return reply.code(400).send({ error: error.message })

    const items = (data || []).map((x) => ({
      id: x.security_domain_id,
      name: x.security_domain_name,
      slug: x.cybersecurity_domain_slug
    }))

    return reply.send({ items, count: items.length, q })
  })

  /**
   * =========================
   * UNION dropdowns (FIXED)
   * 关键修复：不在 .or() 里引用嵌套关系字段
   * 改用两段式：
   * - 先从主表拿匹配到的主表 IDs
   * - alias 表：alias_name ilike + security_*_id in (主表 IDs)
   * =========================
   */

  // 产品 union：cybersecurity_product + cybersecurity_product_alias
  app.get('/dropdowns/product_union', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const q = String(req.query?.q || '').trim()
    const limit = clampInt(req.query?.limit, 200, 1, 500)
    const like = escapeLike(q)

    // 1) 主产品（可搜索 name/slug）
    let qProd = supabase
      .from('cybersecurity_product')
      .select('security_product_id, security_product_name, security_product_slug')
      .order('security_product_name', { ascending: true })
      .limit(limit)

    if (q) {
      qProd = qProd.or(
        `security_product_name.ilike.%${like}%,security_product_slug.ilike.%${like}%`
      )
    }

    const rProd = await qProd
    if (rProd.error) return reply.code(400).send({ error: rProd.error.message })

    const products = rProd.data || []
    const matchedProductIds = products.map(x => x.security_product_id)

    // 2) alias：两路合并
    // 2.1 alias_name 命中
    let aliasRows = []
    if (q) {
      const rA1 = await supabase
        .from('cybersecurity_product_alias')
        .select('security_product_alias_id, security_product_alias_name, security_product_id')
        .ilike('security_product_alias_name', `%${like}%`)
        .order('security_product_alias_name', { ascending: true })
        .limit(limit)

      if (rA1.error) return reply.code(400).send({ error: rA1.error.message })
      aliasRows = aliasRows.concat(rA1.data || [])
    }

    // 2.2 归属产品命中（name/slug 命中导致 productIds 命中）
    if (q && matchedProductIds.length) {
      const rA2 = await supabase
        .from('cybersecurity_product_alias')
        .select('security_product_alias_id, security_product_alias_name, security_product_id')
        .in('security_product_id', matchedProductIds)
        .order('security_product_alias_name', { ascending: true })
        .limit(limit)

      if (rA2.error) return reply.code(400).send({ error: rA2.error.message })
      aliasRows = aliasRows.concat(rA2.data || [])
    }

    // q 为空：给一个默认 alias 列表（否则 union 下 alias 永远为空不利于选）
    if (!q) {
      const rA0 = await supabase
        .from('cybersecurity_product_alias')
        .select('security_product_alias_id, security_product_alias_name, security_product_id')
        .order('security_product_alias_name', { ascending: true })
        .limit(limit)

      if (rA0.error) return reply.code(400).send({ error: rA0.error.message })
      aliasRows = rA0.data || []
    }

    // 去重 alias（可能同时命中两路）
    aliasRows = dedupeByKey(aliasRows, (x) => x.security_product_alias_id)

    // 3) 为 alias 补充 extra（产品名/slug）——不做 join/or，改成批量查主表映射
    const aliasProductIds = Array.from(new Set(aliasRows.map(x => x.security_product_id).filter(Boolean)))
    const prodMap = await fetchProductMap(aliasProductIds)

    const itemsProduct = products.map((x) => ({
      id: `p:${x.security_product_id}`,
      kind: 'product',
      product_id: x.security_product_id,
      name: x.security_product_name,
      slug: x.security_product_slug,
      extra: null,
    }))

    const itemsAlias = aliasRows.map((x) => {
      const p = prodMap.get(x.security_product_id) || null
      return {
        id: `a:${x.security_product_alias_id}`,
        kind: 'alias',
        product_id: x.security_product_id,
        name: x.security_product_alias_name,
        slug: null,
        extra: p ? { product_name: p.name, product_slug: p.slug } : null
      }
    })

    const merged = dedupeById([...itemsProduct, ...itemsAlias])

    merged.sort((a, b) => {
      const ka = a.kind === 'product' ? 0 : 1
      const kb = b.kind === 'product' ? 0 : 1
      if (ka !== kb) return ka - kb
      return String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN')
    })

    return reply.send({ items: merged.slice(0, limit), count: Math.min(merged.length, limit), q })
  })

  // 领域 union：cybersecurity_domain + cybersecurity_domain_alias
  app.get('/dropdowns/domain_union', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const q = String(req.query?.q || '').trim()
    const limit = clampInt(req.query?.limit, 200, 1, 500)
    const like = escapeLike(q)

    // 1) 主领域（可搜索 name/slug）
    let qDom = supabase
      .from('cybersecurity_domain')
      .select('security_domain_id, security_domain_name, cybersecurity_domain_slug')
      .order('security_domain_name', { ascending: true })
      .limit(limit)

    if (q) {
      qDom = qDom.or(
        `security_domain_name.ilike.%${like}%,cybersecurity_domain_slug.ilike.%${like}%`
      )
    }

    const rDom = await qDom
    if (rDom.error) return reply.code(400).send({ error: rDom.error.message })

    const domains = rDom.data || []
    const matchedDomainIds = domains.map(x => x.security_domain_id)

    // 2) alias：两路合并
    let aliasRows = []
    if (q) {
      const rA1 = await supabase
        .from('cybersecurity_domain_alias')
        .select('security_domain_alias_id, security_domain_alias_name, security_domain_id')
        .ilike('security_domain_alias_name', `%${like}%`)
        .order('security_domain_alias_name', { ascending: true })
        .limit(limit)

      if (rA1.error) return reply.code(400).send({ error: rA1.error.message })
      aliasRows = aliasRows.concat(rA1.data || [])
    }

    if (q && matchedDomainIds.length) {
      const rA2 = await supabase
        .from('cybersecurity_domain_alias')
        .select('security_domain_alias_id, security_domain_alias_name, security_domain_id')
        .in('security_domain_id', matchedDomainIds)
        .order('security_domain_alias_name', { ascending: true })
        .limit(limit)

      if (rA2.error) return reply.code(400).send({ error: rA2.error.message })
      aliasRows = aliasRows.concat(rA2.data || [])
    }

    if (!q) {
      const rA0 = await supabase
        .from('cybersecurity_domain_alias')
        .select('security_domain_alias_id, security_domain_alias_name, security_domain_id')
        .order('security_domain_alias_name', { ascending: true })
        .limit(limit)

      if (rA0.error) return reply.code(400).send({ error: rA0.error.message })
      aliasRows = rA0.data || []
    }

    aliasRows = dedupeByKey(aliasRows, (x) => x.security_domain_alias_id)

    // 3) 给 alias 补充 extra（domain_name/slug）
    const aliasDomainIds = Array.from(new Set(aliasRows.map(x => x.security_domain_id).filter(Boolean)))
    const domMap = await fetchDomainMap(aliasDomainIds)

    const itemsDomain = domains.map((x) => ({
      id: `d:${x.security_domain_id}`,
      kind: 'domain',
      domain_id: x.security_domain_id,
      name: x.security_domain_name,
      slug: x.cybersecurity_domain_slug,
      extra: null,
    }))

    const itemsAlias = aliasRows.map((x) => {
      const d = domMap.get(x.security_domain_id) || null
      return {
        id: `da:${x.security_domain_alias_id}`,
        kind: 'alias',
        domain_id: x.security_domain_id,
        name: x.security_domain_alias_name,
        slug: null,
        extra: d ? { domain_name: d.name, domain_slug: d.slug } : null
      }
    })

    const merged = dedupeById([...itemsDomain, ...itemsAlias])

    merged.sort((a, b) => {
      const ka = a.kind === 'domain' ? 0 : 1
      const kb = b.kind === 'domain' ? 0 : 1
      if (ka !== kb) return ka - kb
      return String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN')
    })

    return reply.send({ items: merged.slice(0, limit), count: Math.min(merged.length, limit), q })
  })
}

/* ---------------- helpers ---------------- */

function clampInt(v, dflt, min, max) {
  const n = Number(v)
  if (!Number.isFinite(n)) return dflt
  return Math.max(min, Math.min(max, Math.trunc(n)))
}

function escapeLike(s) {
  return String(s).replace(/[%_]/g, '\\$&')
}

function dedupeById(items) {
  const m = new Map()
  for (const it of items) {
    if (!it || !it.id) continue
    if (!m.has(it.id)) m.set(it.id, it)
  }
  return Array.from(m.values())
}

function dedupeByKey(items, keyFn) {
  const m = new Map()
  for (const it of items || []) {
    const k = keyFn(it)
    if (k === null || k === undefined) continue
    if (!m.has(k)) m.set(k, it)
  }
  return Array.from(m.values())
}

async function fetchProductMap(productIds) {
  const ids = (productIds || []).filter((x) => Number.isFinite(Number(x))).map(Number)
  const uniq = Array.from(new Set(ids))
  if (!uniq.length) return new Map()

  const { data, error } = await supabase
    .from('cybersecurity_product')
    .select('security_product_id, security_product_name, security_product_slug')
    .in('security_product_id', uniq)

  if (error) return new Map()

  return new Map((data || []).map((x) => [
    x.security_product_id,
    { name: x.security_product_name, slug: x.security_product_slug }
  ]))
}

async function fetchDomainMap(domainIds) {
  const ids = (domainIds || []).filter((x) => Number.isFinite(Number(x))).map(Number)
  const uniq = Array.from(new Set(ids))
  if (!uniq.length) return new Map()

  const { data, error } = await supabase
    .from('cybersecurity_domain')
    .select('security_domain_id, security_domain_name, cybersecurity_domain_slug')
    .in('security_domain_id', uniq)

  if (error) return new Map()

  return new Map((data || []).map((x) => [
    x.security_domain_id,
    { name: x.security_domain_name, slug: x.cybersecurity_domain_slug }
  ]))
}
