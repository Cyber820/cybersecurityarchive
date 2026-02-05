// apps/api/src/routes/admin/dropdowns.js
import { supabase } from '../../supabase.js'
import { requireAdmin } from './auth.js'

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

function escapeLike(s) {
  return String(s).replace(/[%_]/g, '\\$&')
}
