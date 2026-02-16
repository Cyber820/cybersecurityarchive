// apps/api/src/routes/admin/org-product.js

console.log('[orgProduct] version = 2026-02-16-orgProductScore-A')

function normalizeScore(v) {
  if (v === undefined || v === null || v === '') return undefined
  const n = Number(v)
  if (!Number.isInteger(n) || n < 1 || n > 10) return '__invalid__'
  return n
}

function normalizeYear(v, nowYear) {
  if (v === undefined || v === null || v === '') return undefined
  const n = Number(v)
  if (!Number.isInteger(n) || n < 1990 || n > nowYear) return '__invalid__'
  return n
}

export function registerOrgProductAdmin(app) {
  // CREATE
  app.post('/api/admin/org_product', async (req, reply) => {
    const db = req.db
    const body = req.body || {}

    const nowYear = new Date().getFullYear()

    // required
    const organization_slug = String(body.organization_slug || '').trim()
    const security_product_slug = String(body.security_product_slug || '').trim()
    if (!organization_slug) return reply.code(400).send({ error: 'organization_slug required' })
    if (!security_product_slug) return reply.code(400).send({ error: 'security_product_slug required' })

    // years optional
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

    // lookup org/product
    const org = await db('organization')
      .select('organization_id')
      .where({ organization_slug })
      .first()

    if (!org) return reply.code(404).send({ error: 'organization not found' })

    const product = await db('cybersecurity_product')
      .select('security_product_id')
      .where({ security_product_slug })
      .first()

    if (!product) return reply.code(404).send({ error: 'product not found' })

    const payload = {
      organization_id: org.organization_id,
      security_product_id: product.security_product_id,
      product_release_year: product_release_year === undefined ? null : product_release_year,
      product_end_year: product_end_year === undefined ? null : product_end_year,
      recommendation_score: recommendation_score === undefined ? null : recommendation_score,
    }

    try {
      const [row] = await db('organization_product')
        .insert(payload)
        .returning(['organization_product_id'])

      return reply.send({ ok: true, organization_product_id: row?.organization_product_id })
    } catch (e) {
      return reply.code(500).send({ error: String(e?.message || e) })
    }
  })

  // SEARCH (for edit list)
  app.get('/api/admin/org_product/search', async (req, reply) => {
    const db = req.db
    const q = String(req.query?.q || '').trim()

    // 简单策略：允许空 q（返回最近一些）或按企业/产品 slug/name 模糊
    const base = db('organization_product as op')
      .leftJoin('organization as o', 'o.organization_id', 'op.organization_id')
      .leftJoin('cybersecurity_product as p', 'p.security_product_id', 'op.security_product_id')
      .select([
        'op.organization_product_id',
        'op.product_release_year',
        'op.product_end_year',
        'op.recommendation_score',
        'o.organization_short_name',
        'o.organization_slug',
        'p.security_product_name',
        'p.security_product_slug',
      ])
      .orderBy('op.organization_product_id', 'desc')
      .limit(50)

    if (q) {
      base.where((w) => {
        w.whereILike('o.organization_slug', `%${q}%`)
          .orWhereILike('o.organization_short_name', `%${q}%`)
          .orWhereILike('p.security_product_slug', `%${q}%`)
          .orWhereILike('p.security_product_name', `%${q}%`)
      })
    }

    const rows = await base
    return reply.send({ ok: true, data: rows })
  })

  // PATCH
  app.patch('/api/admin/org_product/:organization_product_id', async (req, reply) => {
    const db = req.db
    const id = Number(req.params.organization_product_id)
    if (!Number.isInteger(id)) return reply.code(400).send({ error: 'invalid id' })

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

    if (Object.keys(patch).length === 0) {
      return reply.code(400).send({ error: 'no fields to patch' })
    }

    try {
      const n = await db('organization_product')
        .where({ organization_product_id: id })
        .update(patch)

      if (!n) return reply.code(404).send({ error: 'not found' })
      return reply.send({ ok: true })
    } catch (e) {
      return reply.code(500).send({ error: String(e?.message || e) })
    }
  })
}
