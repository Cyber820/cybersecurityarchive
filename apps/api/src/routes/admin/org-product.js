// apps/api/src/routes/admin/org-product.js
import { config } from '../../config.js'

function normalizeYear(v, maxYear) {
  if (v === null || v === undefined || v === '') return undefined
  const n = Number(v)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return '__invalid__'
  if (n < 1990 || n > maxYear) return '__invalid__'
  return n
}

function normalizeScore(v) {
  if (v === null || v === undefined || v === '') return undefined
  const n = Number(v)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return '__invalid__'
  if (n < 1 || n > 10) return '__invalid__'
  return n
}

export async function orgProductAdminRoutes(app) {
  const supabase = app.supabase

  // list: by organization_id
  app.get('/org_product', async (req, reply) => {
    try {
      const orgId = Number(req.query.organization_id)
      if (!Number.isFinite(orgId)) {
        return reply.code(400).send({ error: 'organization_id required (number)' })
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
          cybersecurity_product:security_product_id (
            security_product_name,
            security_product_slug
          )
        `)
        .eq('organization_id', orgId)
        .order('organization_product_id', { ascending: false })

      if (error) return reply.code(500).send({ error: error.message })

      const items = (data || []).map((r) => ({
        organization_product_id: r.organization_product_id,
        organization_id: r.organization_id,
        security_product_id: r.security_product_id,
        product_release_year: r.product_release_year ?? null,
        product_end_year: r.product_end_year ?? null,
        recommendation_score: r.recommendation_score ?? null,
        security_product_name: r.cybersecurity_product?.security_product_name ?? null,
        security_product_slug: r.cybersecurity_product?.security_product_slug ?? null,
      }))

      return reply.send({ items })
    } catch (e) {
      return reply.code(500).send({ error: String(e?.message || e) })
    }
  })

  // create
  app.post('/org_product', async (req, reply) => {
    try {
      const body = req.body || {}
      const orgId = Number(body.organization_id)
      const prodId = Number(body.security_product_id)

      if (!Number.isFinite(orgId)) return reply.code(400).send({ error: 'organization_id must be a number' })
      if (!Number.isFinite(prodId)) return reply.code(400).send({ error: 'security_product_id must be a number' })

      const nowYear = new Date().getFullYear()

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
        organization_id: orgId,
        security_product_id: prodId,
        product_release_year: product_release_year === undefined ? null : product_release_year,
        product_end_year: product_end_year === undefined ? null : product_end_year,
        recommendation_score: recommendation_score === undefined ? null : recommendation_score
      }

      const { data, error } = await supabase
        .from('organization_product')
        .insert(payload)
        .select()
        .single()

      if (error) return reply.code(500).send({ error: error.message })

      return reply.send({ organization_product: data })
    } catch (e) {
      return reply.code(500).send({ error: String(e?.message || e) })
    }
  })

  // update (years / score)
  app.patch('/org_product/:id', async (req, reply) => {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'id must be a number' })

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
        const v = normalizeScore(body.recommendation_score)
        if (v === '__invalid__') {
          return reply.code(400).send({ error: 'recommendation_score must be an integer between 1 and 10' })
        }
        patch.recommendation_score = v === undefined ? null : v
      }

      if (!Object.keys(patch).length) {
        return reply.code(400).send({ error: 'no fields to update' })
      }

      const { data, error } = await supabase
        .from('organization_product')
        .update(patch)
        .eq('organization_product_id', id)
        .select()
        .single()

      if (error) return reply.code(500).send({ error: error.message })

      return reply.send({ organization_product: data })
    } catch (e) {
      return reply.code(500).send({ error: String(e?.message || e) })
    }
  })

  // delete
  app.delete('/org_product/:id', async (req, reply) => {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'id must be a number' })

      const { error } = await supabase
        .from('organization_product')
        .delete()
        .eq('organization_product_id', id)

      if (error) return reply.code(500).send({ error: error.message })

      return reply.send({ ok: true })
    } catch (e) {
      return reply.code(500).send({ error: String(e?.message || e) })
    }
  })
}
