// apps/api/src/routes/admin/dropdowns.js
import { supabase } from '../../supabase.js'
import { requireAdmin } from './auth.js'

export function registerDropdownAdmin(app) {
  /**
   * Base dropdowns (existing)
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
   * UNION dropdowns (NEW)
   * 目标：后续 organization_product 录入时，同时搜主表+别名表
   *
   * 约定返回：
   * - id: "p:<product_id>" 或 "a:<alias_id>"（保证唯一且可区分来源）
   * - kind: "product" | "alias"
   * - product_id: 归一后的主产品ID（organization_product 最终要写的就是这个）
   * - name: 显示名（alias 用 alias_name；product 用 product_name）
   * - slug: 仅对 product 有；alias 为 null（必要时可扩展为关联 product slug）
   * - extra: 方便 debug/展示（例如 alias->product_name）
   * =========================
   */

  // 产品 union：cybersecurity_product + cybersecurity_product_alias
  app.get('/dropdowns/product_union', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const q = String(req.query?.q || '').trim()
    const limit = clampInt(req.query?.limit, 200, 1, 500)

    // 1) 主产品
    let q1 = supabase
      .from('cybersecurity_product')
      .select('security_product_id, security_product_name, security_product_slug')
      .order('security_product_name', { ascending: true })
      .limit(limit)

    if (q) {
      q1 = q1.or(
        `security_product_name.ilike.%${escapeLike(q)}%,security_product_slug.ilike.%${escapeLike(q)}%`
      )
    }

    // 2) 别名（带上归属主产品信息，便于展示/校验）
    // 表：cybersecurity_product_alias
    // 字段：security_product_alias_id, security_product_alias_name, security_product_id
    // 关联：cybersecurity_product(security_product_id)
    let q2 = supabase
      .from('cybersecurity_product_alias')
      .select(
        'security_product_alias_id, security_product_alias_name, security_product_id,' +
          'cybersecurity_product:security_product_id (security_product_name, security_product_slug)'
      )
      .order('security_product_alias_name', { ascending: true })
      .limit(limit)

    if (q) {
      // alias name + 归属产品名/slug 都参与搜索
      const like = escapeLike(q)
      q2 = q2.or(
        `security_product_alias_name.ilike.%${like}%,` +
          `cybersecurity_product.security_product_name.ilike.%${like}%,` +
          `cybersecurity_product.security_product_slug.ilike.%${like}%`
      )
    }

    const [r1, r2] = await Promise.all([q1, q2])

    if (r1.error) return reply.code(400).send({ error: r1.error.message })
    if (r2.error) return reply.code(400).send({ error: r2.error.message })

    const itemsProduct = (r1.data || []).map((x) => ({
      id: `p:${x.security_product_id}`,
      kind: 'product',
      product_id: x.security_product_id,
      name: x.security_product_name,
      slug: x.security_product_slug,
      extra: null,
    }))

    const itemsAlias = (r2.data || []).map((x) => ({
      id: `a:${x.security_product_alias_id}`,
      kind: 'alias',
      product_id: x.security_product_id,
      name: x.security_product_alias_name,
      slug: null,
      extra: {
        product_name: x.cybersecurity_product?.security_product_name ?? null,
        product_slug: x.cybersecurity_product?.security_product_slug ?? null,
      }
    }))

    // 合并 + 去重（按 id 唯一）
    const merged = dedupeById([...itemsProduct, ...itemsAlias])

    // 简单排序：优先 product，再 alias；同类按 name
    merged.sort((a, b) => {
      const ka = a.kind === 'product' ? 0 : 1
      const kb = b.kind === 'product' ? 0 : 1
      if (ka !== kb) return ka - kb
      return String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN')
    })

    return reply.send({ items: merged.slice(0, limit), count: Math.min(merged.length, limit), q })
  })

  // 领域 union：cybersecurity_domain + cybersecurity_domain_alias（为将来 domain union 做铺垫）
  app.get('/dropdowns/domain_union', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const q = String(req.query?.q || '').trim()
    const limit = clampInt(req.query?.limit, 200, 1, 500)

    let q1 = supabase
      .from('cybersecurity_domain')
      .select('security_domain_id, security_domain_name, cybersecurity_domain_slug')
      .order('security_domain_name', { ascending: true })
      .limit(limit)

    if (q) {
      const like = escapeLike(q)
      q1 = q1.or(
        `security_domain_name.ilike.%${like}%,cybersecurity_domain_slug.ilike.%${like}%`
      )
    }

    let q2 = supabase
      .from('cybersecurity_domain_alias')
      .select(
        'security_domain_alias_id, security_domain_alias_name, security_domain_id,' +
          'cybersecurity_domain:security_domain_id (security_domain_name, cybersecurity_domain_slug)'
      )
      .order('security_domain_alias_name', { ascending: true })
      .limit(limit)

    if (q) {
      const like = escapeLike(q)
      q2 = q2.or(
        `security_domain_alias_name.ilike.%${like}%,` +
          `cybersecurity_domain.security_domain_name.ilike.%${like}%,` +
          `cybersecurity_domain.cybersecurity_domain_slug.ilike.%${like}%`
      )
    }

    const [r1, r2] = await Promise.all([q1, q2])

    if (r1.error) return reply.code(400).send({ error: r1.error.message })
    if (r2.error) return reply.code(400).send({ error: r2.error.message })

    const itemsDomain = (r1.data || []).map((x) => ({
      id: `d:${x.security_domain_id}`,
      kind: 'domain',
      domain_id: x.security_domain_id,
      name: x.security_domain_name,
      slug: x.cybersecurity_domain_slug,
      extra: null,
    }))

    const itemsAlias = (r2.data || []).map((x) => ({
      id: `da:${x.security_domain_alias_id}`,
      kind: 'alias',
      domain_id: x.security_domain_id,
      name: x.security_domain_alias_name,
      slug: null,
      extra: {
        domain_name: x.cybersecurity_domain?.security_domain_name ?? null,
        domain_slug: x.cybersecurity_domain?.cybersecurity_domain_slug ?? null,
      }
    }))

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
