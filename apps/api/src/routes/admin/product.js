// apps/api/src/routes/admin/product.js
import { supabase } from '../../supabase.js'
import { requireAdmin } from './auth.js'

/**
 * POST /api/admin/product
 *
 * Body (示例):
 * {
 *   "security_product_name": "Acme WAF",
 *   "security_product_slug": "acme-waf",
 *   "domains": [1,2,3]
 * }
 *
 * domains 支持两种形式：
 * - number[]: 直接传 security_domain_id
 * - string[]: 传 cybersecurity_domain_slug（会自动 lookup id）
 *
 * 返回：
 * {
 *   product: {...},
 *   domains_bound: [{security_domain_id:..}, ...]
 * }
 */
export function registerProductAdmin(app) {
  app.post('/product', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const body = req.body || {}
    const { domains, ...productPayload } = body

    // 1) create product
    const { data: product, error: pErr } = await supabase
      .from('cybersecurity_product')
      .insert(productPayload)
      .select('*')
      .single()

    if (pErr) return reply.code(400).send({ error: pErr.message })

    // 2) optionally bind domains
    try {
      const domainIds = await normalizeDomainIds(domains)
      if (domainIds.length) {
        const rows = domainIds.map((security_domain_id) => ({
          security_product_id: product.security_product_id,
          security_domain_id
        }))

        // UNIQUE(security_product_id, security_domain_id)
        const { error: rErr } = await supabase
          .from('cybersecurity_product_domain')
          .insert(rows)

        if (rErr) throw rErr
      }

      return reply.send({
        product,
        domains_bound: (await normalizeDomainIds(domains)).map((security_domain_id) => ({ security_domain_id }))
      })
    } catch (e) {
      // best-effort rollback: delete product to avoid orphan if relation insert failed
      await supabase
        .from('cybersecurity_product')
        .delete()
        .eq('security_product_id', product.security_product_id)

      return reply.code(400).send({ error: e?.message || String(e) })
    }
  })
}

async function normalizeDomainIds(domains) {
  if (!domains) return []
  if (!Array.isArray(domains)) throw new Error('domains must be an array')

  const cleaned = domains.filter((x) => x !== null && x !== undefined && x !== '')
  if (!cleaned.length) return []

  // number[]
  if (cleaned.every((x) => typeof x === 'number' && Number.isFinite(x))) {
    return Array.from(new Set(cleaned))
  }

  // string[] -> lookup by slug
  if (cleaned.every((x) => typeof x === 'string')) {
    const slugs = Array.from(new Set(cleaned.map((s) => s.trim()).filter(Boolean)))
    if (!slugs.length) return []

    const { data, error } = await supabase
      .from('cybersecurity_domain')
      .select('security_domain_id, cybersecurity_domain_slug')
      .in('cybersecurity_domain_slug', slugs)

    if (error) throw error

    const found = new Map((data || []).map((d) => [d.cybersecurity_domain_slug, d.security_domain_id]))
    const missing = slugs.filter((s) => !found.has(s))
    if (missing.length) {
      throw new Error(`Unknown domain slugs: ${missing.join(', ')}`)
    }

    return slugs.map((s) => found.get(s))
  }

  throw new Error('domains must be number[] (domain ids) or string[] (domain slugs)')
}
