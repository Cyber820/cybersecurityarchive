// apps/api/src/routes/admin/org-product.js
/**
 * organization_product admin routes
 *
 * Table: organization_product
 * - organization_product_id (pk, int8)
 * - organization_id (fk, int8)
 * - security_product_id (fk, int8)
 * - product_release_year (int4, nullable)
 * - product_end_year (int4, nullable)
 * - recommendation_score (int2, nullable, 1-10)
 */

export async function orgProductAdminRoutes(app, { supabase }) {
  // Create
  app.post('/org_product', async (req, reply) => {
    const body = req.body || {}
    const nowYear = new Date().getFullYear()

    const organization_id = Number(body.organization_id)
    const security_product_id = Number(body.security_product_id)

    if (!Number.isFinite(organization_id) || !Number.isInteger(organization_id)) {
      return reply.code(400).send({ error: 'organization_id must be an integer' })
    }
    if (!Number.isFinite(security_product_id) || !Number.isInteger(security_product_id)) {
      return reply.code(400).send({ error: 'security_product_id must be an integer' })
    }

    const product_release_year = normalizeYear(body.product_release_year, nowYear)
    if (product_release_year === '__invalid__') {
      return reply.code(400).send({ error: `product_release_year must be an integer between 1990 and ${nowYear}` })
    }

    const product_end_year = normalizeYear(body.product_end_year, nowYear)
    if (product_end_year === '__invalid__') {
      return reply.code(400).send({ error: `product_end_year must be an integer between 1990 and ${nowYear}` })
    }

    const recommendation_score = normalizeScore(body.recommendation_score)
    if (recommendation_score === '__invalid__') {
      return reply.code(400).send({ error: 'recommendation_score must be an integer between 1 and 10' })
    }

    const payload = {
      organization_id,
      security_product_id,
      product_release_year: product_release_year === undefined ? null : product_release_year,
      product_end_year: product_end_year === undefined ? null : product_end_year,
      recommendation_score: recommendation_score === undefined ? null : recommendation_score
    }

    const { data, error } = await supabase
      .from('organization_product')
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      return reply.code(500).send({ error: error.message })
    }
    return reply.send({ data })
  })

  // List for an organization
  app.get('/org_product', async (req, reply) => {
    const q = req.query || {}
    const organization_id = Number(q.organization_id)

    if (!Number.isFinite(organization_id) || !Number.isInteger(organization_id)) {
      return reply.code(400).send({ error: 'organization_id query param must be an integer' })
    }

    const { data, error } = await supabase
      .from('organization_product')
      .select(`
        organization_product_id,
        organization_id,
        security_product_id,
        product_release_year,
        product_end_year,
        recommendation_score,
        cybersecurity_product:cybersecurity_product (
          security_product_name,
          security_product_slug
        )
      `)
      .eq('organization_id', organization_id)
      .order('organization_product_id', { ascending: false })

    if (error) return reply.code(500).send({ error: error.message })

    const rows = (data || []).map((r) => ({
      organization_product_id: r.organization_product_id,
      organization_id: r.organization_id,
      security_product_id: r.security_product_id,
      product_release_year: r.product_release_year ?? null,
      product_end_year: r.product_end_year ?? null,
      recommendation_score: r.recommendation_score ?? null,
      product: r.cybersecurity_product
        ? {
            security_product_name: r.cybersecurity_product.security_product_name,
            security_product_slug: r.cybersecurity_product.security_product_slug
          }
        : null
    }))

    return reply.send(rows)
  })

  /**
   * Patch:
   * {
   *   product_release_year?: number|null,
   *   product_end_year?: number|null,
   *   recommendation_score?: number|null
   * }
   */
  app.patch('/org_product/:id', async (req, reply) => {
    const id = Number(req.params?.id)
    if (!Number.isFinite(id) || !Number.isInteger(id)) {
      return reply.code(400).send({ error: 'id must be an integer' })
    }

    const body = req.body || {}
    const nowYear = new Date().getFullYear()
    const patch = {}

    if ('product_release_year' in body) {
      const v = normalizeYear(body.product_release_year, nowYear)
      if (v === '__invalid__') {
        return reply.code(400).send({ error: `product_release_year must be an integer between 1990 and ${nowYear}` })
      }
      patch.product_release_year = v === undefined ? null : v
    }

    if ('product_end_year' in body) {
      const v = normalizeYear(body.product_end_year, nowYear)
      if (v === '__invalid__') {
        return reply.code(400).send({ error: `product_end_year must be an integer between 1990 and ${nowYear}` })
      }
      patch.product_end_year = v === undefined ? null : v
    }

    if ('recommendation_score' in body) {
      const sc = normalizeScore(body.recommendation_score)
      if (sc === '__invalid__') {
        return reply.code(400).send({ error: 'recommendation_score must be an integer between 1 and 10' })
      }
      patch.recommendation_score = sc === undefined ? null : sc
    }

    if (Object.keys(patch).length === 0) {
      return reply.code(400).send({ error: 'No patch fields provided' })
    }

    const { data, error } = await supabase
      .from('organization_product')
      .update(patch)
      .eq('organization_product_id', id)
      .select('*')
      .single()

    if (error) return reply.code(500).send({ error: error.message })
    return reply.send({ data })
  })
}

function normalizeYear(v, nowYear) {
  if (v === null || v === undefined || v === '') return undefined
  const n = Number(v)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return '__invalid__'
  if (n < 1990 || n > nowYear) return '__invalid__'
  return n
}

function normalizeScore(v) {
  if (v === null || v === undefined || v === '') return undefined
  const n = Number(v)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return '__invalid__'
  if (n < 1 || n > 10) return '__invalid__'
  return n
}
