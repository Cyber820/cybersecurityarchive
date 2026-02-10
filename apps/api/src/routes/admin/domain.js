// apps/api/src/routes/admin/domain.js
import { supabase } from '../../supabase.js'
import { requireAdmin } from './auth.js'

export function registerDomainAdmin(app) {
  /**
   * POST /api/admin/domain
   *
   * 1) 新增安全领域（非别名）：
   * {
   *   "security_domain_name": "...",
   *   "cybersecurity_domain_slug": "...",
   *   "security_domain_description": "..." | null
   * }
   *
   * 2) 新增安全领域别名：
   * {
   *   "is_alias": true,
   *   "security_domain_alias_name": "...",
   *   "security_domain_id": 123
   * }
   */
  app.post('/domain', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const body = req.body || {}
    const isAlias = body.is_alias === true

    if (isAlias) {
      const aliasName = String(body.security_domain_alias_name || '').trim()
      const domainId = Number(body.security_domain_id)

      if (!aliasName) return reply.code(400).send({ error: 'security_domain_alias_name is required' })
      if (!Number.isFinite(domainId)) return reply.code(400).send({ error: 'security_domain_id must be a number' })

      const payload = {
        security_domain_alias_name: aliasName,
        security_domain_id: domainId
      }

      const { data: alias, error } = await supabase
        .from('cybersecurity_domain_alias')
        .insert(payload)
        .select('*')
        .single()

      if (error) return reply.code(400).send({ error: error.message })
      return reply.send({ alias })
    }

    // non-alias
    const name = String(body.security_domain_name || '').trim()
    const slug = String(body.cybersecurity_domain_slug || '').trim()
    const descRaw = body.security_domain_description

    if (!name) return reply.code(400).send({ error: 'security_domain_name is required' })
    if (!slug) return reply.code(400).send({ error: 'cybersecurity_domain_slug is required' })

    const payload = {
      security_domain_name: name,
      cybersecurity_domain_slug: slug,
      security_domain_description: (descRaw === null || descRaw === undefined || String(descRaw).trim() === '')
        ? null
        : String(descRaw)
    }

    const { data: domain, error } = await supabase
      .from('cybersecurity_domain')
      .insert(payload)
      .select('*')
      .single()

    if (error) return reply.code(400).send({ error: error.message })
    return reply.send({ domain })
  })

  /**
   * POST /api/admin/domain/alias
   *
   * Back-compat route for the web UI.
   * Body:
   * {
   *   "security_domain_alias_name": "...",
   *   "security_domain_id": 123
   * }
   */
  app.post('/domain/alias', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const body = req.body || {}
    const aliasName = String(body.security_domain_alias_name || '').trim()
    const domainId = Number(body.security_domain_id)

    if (!aliasName) return reply.code(400).send({ error: 'security_domain_alias_name is required' })
    if (!Number.isFinite(domainId)) return reply.code(400).send({ error: 'security_domain_id must be a number' })

    const payload = {
      security_domain_alias_name: aliasName,
      security_domain_id: domainId
    }

    const { data: alias, error } = await supabase
      .from('cybersecurity_domain_alias')
      .insert(payload)
      .select('*')
      .single()

    if (error) return reply.code(400).send({ error: error.message })
    return reply.send({ alias })
  })

  /**
   * =========================
   * Read / Update / Delete
   * =========================
   */

  // ---- cybersecurity_domain ----

  /**
   * GET /api/admin/domain/:id
   */
  app.get('/domain/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const id = Number(req.params?.id)
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'id must be a number' })

    const { data: domain, error } = await supabase
      .from('cybersecurity_domain')
      .select('*')
      .eq('security_domain_id', id)
      .single()

    if (error) return reply.code(400).send({ error: error.message })
    return reply.send({ domain })
  })

  /**
   * PATCH /api/admin/domain/:id
   * Body:
   * {
   *   security_domain_name: string,
   *   cybersecurity_domain_slug: string,
   *   security_domain_description?: string | null
   * }
   */
  app.patch('/domain/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const id = Number(req.params?.id)
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'id must be a number' })

    const body = req.body || {}
    const name = String(body.security_domain_name || '').trim()
    const slug = String(body.cybersecurity_domain_slug || '').trim()
    const descRaw = body.security_domain_description

    if (!name) return reply.code(400).send({ error: 'security_domain_name is required' })
    if (!slug) return reply.code(400).send({ error: 'cybersecurity_domain_slug is required' })

    const payload = {
      security_domain_name: name,
      cybersecurity_domain_slug: slug,
      security_domain_description: (descRaw === null || descRaw === undefined || String(descRaw).trim() === '')
        ? null
        : String(descRaw)
    }

    const { data: domain, error } = await supabase
      .from('cybersecurity_domain')
      .update(payload)
      .eq('security_domain_id', id)
      .select('*')
      .single()

    if (error) return reply.code(400).send({ error: error.message })
    return reply.send({ domain })
  })

  /**
   * DELETE /api/admin/domain/:id
   */
  app.delete('/domain/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const id = Number(req.params?.id)
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'id must be a number' })

    // 先读出关键信息，便于前端提示
    const { data: before, error: e0 } = await supabase
      .from('cybersecurity_domain')
      .select('security_domain_id, security_domain_name, cybersecurity_domain_slug')
      .eq('security_domain_id', id)
      .single()

    if (e0) return reply.code(400).send({ error: e0.message })

    const { error } = await supabase
      .from('cybersecurity_domain')
      .delete()
      .eq('security_domain_id', id)

    if (error) return reply.code(400).send({ error: error.message })
    return reply.send({ deleted: before })
  })

  // ---- cybersecurity_domain_alias ----

  /**
   * GET /api/admin/domain/alias/:aliasId
   */
  app.get('/domain/alias/:aliasId', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const aliasId = Number(req.params?.aliasId)
    if (!Number.isFinite(aliasId)) return reply.code(400).send({ error: 'aliasId must be a number' })

    const { data: alias, error } = await supabase
      .from('cybersecurity_domain_alias')
      .select('*')
      .eq('security_domain_alias_id', aliasId)
      .single()

    if (error) return reply.code(400).send({ error: error.message })
    return reply.send({ alias })
  })

  /**
   * PATCH /api/admin/domain/alias/:aliasId
   * Body:
   * {
   *   security_domain_alias_name: string,
   *   security_domain_id: number
   * }
   */
  app.patch('/domain/alias/:aliasId', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const aliasId = Number(req.params?.aliasId)
    if (!Number.isFinite(aliasId)) return reply.code(400).send({ error: 'aliasId must be a number' })

    const body = req.body || {}
    const aliasName = String(body.security_domain_alias_name || '').trim()
    const domainId = Number(body.security_domain_id)

    if (!aliasName) return reply.code(400).send({ error: 'security_domain_alias_name is required' })
    if (!Number.isFinite(domainId)) return reply.code(400).send({ error: 'security_domain_id must be a number' })

    const payload = {
      security_domain_alias_name: aliasName,
      security_domain_id: domainId,
    }

    const { data: alias, error } = await supabase
      .from('cybersecurity_domain_alias')
      .update(payload)
      .eq('security_domain_alias_id', aliasId)
      .select('*')
      .single()

    if (error) return reply.code(400).send({ error: error.message })
    return reply.send({ alias })
  })

  /**
   * DELETE /api/admin/domain/alias/:aliasId
   */
  app.delete('/domain/alias/:aliasId', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const aliasId = Number(req.params?.aliasId)
    if (!Number.isFinite(aliasId)) return reply.code(400).send({ error: 'aliasId must be a number' })

    const { data: before, error: e0 } = await supabase
      .from('cybersecurity_domain_alias')
      .select('security_domain_alias_id, security_domain_alias_name, security_domain_id')
      .eq('security_domain_alias_id', aliasId)
      .single()

    if (e0) return reply.code(400).send({ error: e0.message })

    const { error } = await supabase
      .from('cybersecurity_domain_alias')
      .delete()
      .eq('security_domain_alias_id', aliasId)

    if (error) return reply.code(400).send({ error: error.message })
    return reply.send({ deleted: before })
  })
}
