// apps/api/src/routes/admin/org-product.js
import { supabase } from '../../supabase.js'
import { requireAdmin } from './auth.js'

// 便于你在日志里确认版本
console.log('[orgProduct] version = 2026-02-18-score-enabled')

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

    const recommendation_score = normalizeScore(body.recommendation_score)
    if (recommendation_score === '__invalid__') {
      return reply.code(400).send({ error: 'recommendation_score must be an integer between 0 and 10' })
    }

    const payload = {
      organization_id,
      security_product_id,
      product_release_year: product_release_year === undefined ? null : product_release_year,
      product_end_year: product_end_year === undefined ? null : product_end_year,
      recommendation_score: recommendation_score === undefined ? null : recommendation_score,
    }

    const { data, error } = await supabase
      .from('organization_product')
      .insert(payload)
      .select('*')
      .single()

    if (error) return reply.code(400).send({ error: error.message })
    return reply.send({ organization_product: data })
  })

  app.get('/org_product', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const organization_id = Number(req.query?.organization_id)
    if (!Number.isFinite(organization_id)) {
      return reply.code(400).send({ error: 'organization_id must be a number' })
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
      .order('organization_product_id', { ascending: true })
      .limit(500)

    if (error) return reply.code(400).send({ error: error.message })

    const items = (data || []).map((r) => ({
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

    return reply.send({ items })
  })

  app.patch('/org_product/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const id = Number(req.params?.id)
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid organization_product id' })

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
        return reply.code(400).send({ error: 'recommendation_score must be an integer between 0 and 10' })
      }
      patch.recommendation_score = v === undefined ? null : v
    }

    if (!Object.keys(patch).length) {
      return reply.code(400).send({ error: 'No updatable fields in body' })
    }

    const { data, error } = await supabase
      .from('organization_product')
      .update(patch)
      .eq('organization_product_id', id)
      .select('*')
      .single()

    if (error) return reply.code(400).send({ error: error.message })
    return reply.send({ organization_product: data })
  })

  app.delete('/org_product/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const id = Number(req.params?.id)
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid organization_product id' })

    const { error } = await supabase
      .from('organization_product')
      .delete()
      .eq('organization_product_id', id)

    if (error) return reply.code(400).send({ error: error.message })
    return reply.send({ ok: true })
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
  if (n < 0 || n > 10) return '__invalid__'
  return n
}
