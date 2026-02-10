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
}
