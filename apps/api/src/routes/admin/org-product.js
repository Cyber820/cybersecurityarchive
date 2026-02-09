// apps/api/src/routes/admin/org-product.js
import { supabase } from '../../supabase.js'
import { requireAdmin } from './auth.js'

/**
 * POST /api/admin/org_product
 *
 * Insert into organization_product:
 * - organization_id (int8)
 * - security_product_id (int8)
 * - product_release_year (int4, nullable)
 * - product_end_year (int4, nullable)
 *
 * Body:
 * {
 *   organization_id: number,
 *   security_product_id: number,
 *   product_release_year?: number|null,
 *   product_end_year?: number|null
 * }
 */
export function registerOrgProductAdmin(app) {
  app.post('/org_product', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const body = req.body || {}

    const organization_id = Number(body.organization_id)
    const security_product_id = Number(body.security_product_id)

    if (!Number.isFinite(organization_id)) {
      return reply.code(400).send({ error: 'organization_id must be a number' })
    }
    if (!Number.isFinite(security_product_id)) {
      return reply.code(400).send({ error: 'security_product_id must be a number' })
    }

    const nowYear = new Date().getFullYear()

    const product_release_year = normalizeYear(body.product_release_year, nowYear)
    if (product_release_year === '__invalid__') {
      return reply.code(400).send({ error: `product_release_year must be an integer between 1990 and ${nowYear}` })
    }

    const product_end_year = normalizeYear(body.product_end_year, nowYear)
    if (product_end_year === '__invalid__') {
      return reply.code(400).send({ error: `product_end_year must be an integer between 1990 and ${nowYear}` })
    }

    const payload = {
      organization_id,
      security_product_id,
      product_release_year: product_release_year === undefined ? null : product_release_year,
      product_end_year: product_end_year === undefined ? null : product_end_year
    }

    const { data, error } = await supabase
      .from('organization_product')
      .insert(payload)
      .select('*')
      .single()

    if (error) return reply.code(400).send({ error: error.message })

    return reply.send({ organization_product: data })
  })
}

function normalizeYear(v, nowYear) {
  if (v === null || v === undefined || v === '') return undefined
  const n = Number(v)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return '__invalid__'
  if (n < 1990 || n > nowYear) return '__invalid__'
  return n
}
