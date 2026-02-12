// apps/api/src/routes/admin/product.js
import { supabase } from '../../supabase.js'
import { requireAdmin } from './auth.js'

/**
 * POST /api/admin/product
 *
 * 1) 新增安全产品（非别名）：
 * {
 *   "security_product_name": "...",
 *   "security_product_slug": "...",
 *   "security_product_description": "..." | null,
 *   "domains": [1,2,3] // number[] (security_domain_id) 或 string[] (domain slug)
 * }
 *
 * 2) 新增安全产品别名：
 * {
 *   "is_alias": true,
 *   "security_product_alias_name": "...",
 *   "security_product_id": 123
 * }
 */
export function registerProductAdmin(app) {
  app.post('/product', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const body = req.body || {}
    const isAlias = body.is_alias === true

    if (isAlias) {
      const aliasName = String(body.security_product_alias_name || '').trim()
      const productId = Number(body.security_product_id)

      if (!aliasName) return reply.code(400).send({ error: 'security_product_alias_name is required' })
      if (!Number.isFinite(productId)) return reply.code(400).send({ error: 'security_product_id must be a number' })

      const payload = {
        security_product_alias_name: aliasName,
        security_product_id: productId
      }

      const { data: alias, error } = await supabase
        .from('cybersecurity_product_alias')
        .insert(payload)
        .select('*')
        .single()

      if (error) return reply.code(400).send({ error: error.message })
      return reply.send({ alias })
    }

    // non-alias
    const name = String(body.security_product_name || '').trim()
    const slug = String(body.security_product_slug || '').trim()
    const descRaw = body.security_product_description
    const domains = body.domains

    if (!name) return reply.code(400).send({ error: 'security_product_name is required' })
    if (!slug) return reply.code(400).send({ error: 'security_product_slug is required' })

    const productPayload = {
      security_product_name: name,
      security_product_slug: slug,
      security_product_description:
        (descRaw === null || descRaw === undefined || String(descRaw).trim() === '')
          ? null
          : String(descRaw)
    }

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

  /**
   * POST /api/admin/product/alias
   *
   * Back-compat route for the web UI.
   * Body:
   * {
   *   "security_product_alias_name": "...",
   *   "security_product_id": 123
   * }
   */
  app.post('/product/alias', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const body = req.body || {}
    const aliasName = String(body.security_product_alias_name || '').trim()
    const productId = Number(body.security_product_id)

    if (!aliasName) return reply.code(400).send({ error: 'security_product_alias_name is required' })
    if (!Number.isFinite(productId)) return reply.code(400).send({ error: 'security_product_id must be a number' })

    const payload = {
      security_product_alias_name: aliasName,
      security_product_id: productId
    }

    const { data: alias, error } = await supabase
      .from('cybersecurity_product_alias')
      .insert(payload)
      .select('*')
      .single()

    if (error) return reply.code(400).send({ error: error.message })
    return reply.send({ alias })
  })

  // =========================
  // Edit / Delete (main + alias)
  // =========================

  /**
   * GET /api/admin/product/:id
   * Return: { product, domains: number[], domain_items: {security_domain_id,security_domain_name,cybersecurity_domain_slug}[] }
   */
  app.get('/product/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const id = Number(req.params?.id)
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'id must be a number' })

    const { data: product, error: e1 } = await supabase
      .from('cybersecurity_product')
      .select('*')
      .eq('security_product_id', id)
      .single()

    if (e1) return reply.code(400).send({ error: e1.message })

    const { data: rels, error: e2 } = await supabase
      .from('cybersecurity_product_domain')
      .select('security_domain_id')
      .eq('security_product_id', id)

    if (e2) return reply.code(400).send({ error: e2.message })

    const domainIds = (rels || []).map((x) => x.security_domain_id)

    // 为前端预填 multi-select：补齐 name/slug
    let domain_items = []
    if (domainIds.length) {
      const { data: dRows, error: e3 } = await supabase
        .from('cybersecurity_domain')
        .select('security_domain_id, security_domain_name, cybersecurity_domain_slug')
        .in('security_domain_id', domainIds)

      if (e3) return reply.code(400).send({ error: e3.message })

      domain_items = (dRows || []).map((d) => ({
        security_domain_id: d.security_domain_id,
        security_domain_name: d.security_domain_name,
        cybersecurity_domain_slug: d.cybersecurity_domain_slug,
      }))
    }

    return reply.send({ product, domains: domainIds, domain_items })
  })

  /**
   * PATCH /api/admin/product/:id
   * Body:
   * {
   *   security_product_name: string,
   *   security_product_slug: string,
   *   security_product_description?: string | null,
   *   domains?: number[] | string[]  // optional; if provided -> replace relations
   * }
   */
  app.patch('/product/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const id = Number(req.params?.id)
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'id must be a number' })

    const body = req.body || {}
    const name = String(body.security_product_name || '').trim()
    const slug = String(body.security_product_slug || '').trim()
    const descRaw = body.security_product_description

    if (!name) return reply.code(400).send({ error: 'security_product_name is required' })
    if (!slug) return reply.code(400).send({ error: 'security_product_slug is required' })

    const payload = {
      security_product_name: name,
      security_product_slug: slug,
      security_product_description:
        (descRaw === null || descRaw === undefined || String(descRaw).trim() === '')
          ? null
          : String(descRaw)
    }

    const { data: product, error: e1 } = await supabase
      .from('cybersecurity_product')
      .update(payload)
      .eq('security_product_id', id)
      .select('*')
      .single()

    if (e1) return reply.code(400).send({ error: e1.message })

    // 如果带 domains，则进行“替换式同步”
    if (Object.prototype.hasOwnProperty.call(body, 'domains')) {
      try {
        const domainIds = await normalizeDomainIds(body.domains)

        // 1) delete old
        const { error: eDel } = await supabase
          .from('cybersecurity_product_domain')
          .delete()
          .eq('security_product_id', id)

        if (eDel) throw eDel

        // 2) insert new
        if (domainIds.length) {
          const rows = domainIds.map((security_domain_id) => ({
            security_product_id: id,
            security_domain_id
          }))

          const { error: eIns } = await supabase
            .from('cybersecurity_product_domain')
            .insert(rows)

          if (eIns) throw eIns
        }

        return reply.send({ product, domains_bound: domainIds })
      } catch (e) {
        // product 已更新；关系同步失败时返回 400 并附带 product 便于排查
        return reply.code(400).send({ error: e?.message || String(e), product })
      }
    }

    return reply.send({ product })
  })

  /**
   * DELETE /api/admin/product/:id
   */
  app.delete('/product/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const id = Number(req.params?.id)
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'id must be a number' })

    const { data: before, error: e0 } = await supabase
      .from('cybersecurity_product')
      .select('security_product_id, security_product_name, security_product_slug')
      .eq('security_product_id', id)
      .single()

    if (e0) return reply.code(400).send({ error: e0.message })

    const { error } = await supabase
      .from('cybersecurity_product')
      .delete()
      .eq('security_product_id', id)

    if (error) return reply.code(400).send({ error: error.message })
    return reply.send({ deleted: before })
  })

  // ---- cybersecurity_product_alias ----

  /**
   * GET /api/admin/product/alias/:aliasId
   */
  app.get('/product/alias/:aliasId', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const aliasId = Number(req.params?.aliasId)
    if (!Number.isFinite(aliasId)) return reply.code(400).send({ error: 'aliasId must be a number' })

    const { data: alias, error } = await supabase
      .from('cybersecurity_product_alias')
      .select('*')
      .eq('security_product_alias_id', aliasId)
      .single()

    if (error) return reply.code(400).send({ error: error.message })
    return reply.send({ alias })
  })

  /**
   * PATCH /api/admin/product/alias/:aliasId
   * Body:
   * {
   *   security_product_alias_name: string,
   *   security_product_id: number
   * }
   */
  app.patch('/product/alias/:aliasId', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const aliasId = Number(req.params?.aliasId)
    if (!Number.isFinite(aliasId)) return reply.code(400).send({ error: 'aliasId must be a number' })

    const body = req.body || {}
    const aliasName = String(body.security_product_alias_name || '').trim()
    const productId = Number(body.security_product_id)

    if (!aliasName) return reply.code(400).send({ error: 'security_product_alias_name is required' })
    if (!Number.isFinite(productId)) return reply.code(400).send({ error: 'security_product_id must be a number' })

    const payload = {
      security_product_alias_name: aliasName,
      security_product_id: productId,
    }

    const { data: alias, error } = await supabase
      .from('cybersecurity_product_alias')
      .update(payload)
      .eq('security_product_alias_id', aliasId)
      .select('*')
      .single()

    if (error) return reply.code(400).send({ error: error.message })
    return reply.send({ alias })
  })

  /**
   * DELETE /api/admin/product/alias/:aliasId
   */
  app.delete('/product/alias/:aliasId', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const aliasId = Number(req.params?.aliasId)
    if (!Number.isFinite(aliasId)) return reply.code(400).send({ error: 'aliasId must be a number' })

    const { data: before, error: e0 } = await supabase
      .from('cybersecurity_product_alias')
      .select('security_product_alias_id, security_product_alias_name, security_product_id')
      .eq('security_product_alias_id', aliasId)
      .single()

    if (e0) return reply.code(400).send({ error: e0.message })

    const { error } = await supabase
      .from('cybersecurity_product_alias')
      .delete()
      .eq('security_product_alias_id', aliasId)

    if (error) return reply.code(400).send({ error: error.message })
    return reply.send({ deleted: before })
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
