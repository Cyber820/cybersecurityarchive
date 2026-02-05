// apps/api/src/routes/admin/dropdowns.js
import { supabase } from '../../supabase.js'
import { requireAdmin } from './auth.js'

/**
 * Dropdown endpoints (admin-only)
 *
 * GET /api/admin/dropdowns/products?q=&limit=
 * GET /api/admin/dropdowns/domains?q=&limit=
 *
 * 返回统一格式：
 * { items: [{ id, name, slug }], count, q }
 *
 * 说明：
 * - q 可选：模糊搜索 name/slug
 * - limit 可选：默认 200，最大 500
 * - 这些接口用于前端下拉（支持多选）
 */
export function registerDropdownAdmin(app) {
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
      // name/slug 模糊匹配
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
}

function clampInt(v, dflt, min, max) {
  const n = Number(v)
  if (!Number.isFinite(n)) return dflt
  return Math.max(min, Math.min(max, Math.trunc(n)))
}

// 避免 %/_ 造成意外匹配扩大（不是安全问题，只是更可控）
function escapeLike(s) {
  return String(s).replace(/[%_]/g, '\\$&')
}
