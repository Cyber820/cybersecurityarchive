// apps/api/src/routes/admin/organization.js
import { supabase } from '../../supabase.js'
import { requireAdmin } from './auth.js'

/**
 * POST /api/admin/organization
 *
 * Body (示例):
 * {
 *   "company_short_name":"Acme",
 *   "company_full_name":"Acme Security Inc.",
 *   "establish_year":2001,
 *   "organization_slug":"acme",
 *   "products": [
 *     { "security_product_id": 12, "product_release_year": 2019, "product_end_year": null },
 *     { "security_product_slug": "acme-waf", "product_release_year": 2020 }
 *   ]
 * }
 *
 * products 支持两种写法（可混用）：
 * - 传 security_product_id
 * - 或传 security_product_slug（会自动 lookup id）
 *
 * 返回：
 * {
 *   organization: {...},
 *   products_bound: [{security_product_id, product_release_year, product_end_year}, ...]
 * }
 */
export function registerOrganizationAdmin(app) {
  app.post('/organization', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const body = req.body || {}
    const { products, ...orgPayload } = body

    // 1) create organization
    const { data: organization, error: oErr } = await supabase
      .from('organization')
      .insert(orgPayload)
      .select('*')
      .single()

    if (oErr) return reply.code(400).send({ error: oErr.message })

    // 2) optionally bind products
    try {
      const rows = await normalizeOrganizationProducts(organization.organization_id, products)
      if (rows.length) {
        // UNIQUE(organization_id, security_product_id)
        const { error: rErr } = await supabase
          .from('organization_product')
          .insert(rows)

        if (rErr) throw rErr
      }

      return reply.send({
        organization,
        products_bound: rows.map(({ security_product_id, product_release_year, product_end_year }) => ({
          security_product_id,
          product_release_year: product_release_year ?? null,
          product_end_year: product_end_year ?? null
        }))
      })
    } catch (e) {
      // best-effort rollback: delete organization to avoid orphan if relation insert failed
      await supabase
        .from('organization')
        .delete()
        .eq('organization_id', organization.organization_id)

      return reply.code(400).send({ error: e?.message || String(e) })
    }
  })
}

async function normalizeOrganizationProducts(organization_id, products) {
  if (!products) return []
  if (!Array.isArray(products)) throw new Error('products must be an array')

  const cleaned = products.filter((x) => x && typeof x === 'object')
  if (!cleaned.length) return []

  // collect slugs to lookup
  const slugs = Array.from(
    new Set(
      cleaned
        .map((p) => (typeof p.security_product_slug === 'string' ? p.security_product_slug.trim() : ''))
        .filter(Boolean)
    )
  )

  let slugToId = new Map()
  if (slugs.length) {
    const { data, error } = await supabase
      .from('cybersecurity_product')
      .select('security_product_id, security_product_slug')
      .in('security_product_slug', slugs)

    if (error) throw error
    slugToId = new Map((data || []).map((x) => [x.security_product_slug, x.security_product_id]))

    const missing = slugs.filter((s) => !slugToId.has(s))
    if (missing.length) throw new Error(`Unknown product slugs: ${missing.join(', ')}`)
  }

  const rows = []
  const seen = new Set()

  for (const p of cleaned) {
    let security_product_id = null

    if (typeof p.security_product_id === 'number' && Number.isFinite(p.security_product_id)) {
      security_product_id = p.security_product_id
    } else if (typeof p.security_product_slug === 'string' && p.security_product_slug.trim()) {
      security_product_id = slugToId.get(p.security_product_slug.trim())
    }

    if (!security_product_id) {
      throw new Error('Each products[] item must include security_product_id (number) or security_product_slug (string)')
    }

    const key = `${organization_id}:${security_product_id}`
    if (seen.has(key)) continue
    seen.add(key)

    rows.push({
      organization_id,
      security_product_id,
      product_release_year: p.product_release_year ?? null,
      product_end_year: p.product_end_year ?? null
    })
  }

  return rows
}
