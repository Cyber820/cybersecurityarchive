// apps/api/src/routes/admin/organization.js
import { supabase } from '../../supabase.js'
import { requireAdmin } from './auth.js'

/**
 * Organization Admin Routes
 *
 * Base table: organization
 * Columns (per your ERD):
 * - organization_id (int8)
 * - organization_short_name (text, required)
 * - organization_full_name (text, nullable)
 * - establish_year (int4, nullable)
 * - organization_slug (text, required)
 *
 * Routes:
 * - POST   /api/admin/organization                 create
 * - GET    /api/admin/organization/search?q=xxx    search (short/full/slug)
 * - GET    /api/admin/organization/:id             get detail
 * - PATCH  /api/admin/organization/:id             update
 */
export function registerOrganizationAdmin(app) {
  // CREATE
  app.post('/organization', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const body = req.body || {}

    const payload = {
      organization_short_name: body.organization_short_name,
      organization_full_name: body.organization_full_name ?? null,
      establish_year: body.establish_year ?? null,
      organization_slug: body.organization_slug
    }

    const { data, error } = await supabase
      .from('organization')
      .insert(payload)
      .select('*')
      .single()

    if (error) return reply.code(400).send({ error: error.message })
    return reply.send({ organization: data })
  })

  // SEARCH (for large dataset; do NOT fetch all on frontend)
  // GET /api/admin/organization/search?q=xxx
  app.get('/organization/search', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const q = String(req.query?.q ?? '').trim()
    if (!q) return reply.send({ items: [] })

    const like = `%${q}%`

    // supabase .or uses comma-separated filters
    // We also return display_name: full_name first, else short_name
    const { data, error } = await supabase
      .from('organization')
      .select('organization_id, organization_short_name, organization_full_name, organization_slug, establish_year')
      .or([
        `organization_short_name.ilike.${like}`,
        `organization_full_name.ilike.${like}`,
        `organization_slug.ilike.${like}`,
      ].join(','))
      .order('organization_full_name', { ascending: true, nullsFirst: false })
      .order('organization_short_name', { ascending: true })
      .limit(30)

    if (error) return reply.code(400).send({ error: error.message })

    // de-dup by id (defensive)
    const seen = new Set()
    const items = []
    for (const r of (data || [])) {
      const id = r.organization_id
      if (seen.has(id)) continue
      seen.add(id)
      items.push({
        organization_id: id,
        display_name: (r.organization_full_name && String(r.organization_full_name).trim())
          ? r.organization_full_name
          : r.organization_short_name,
        organization_short_name: r.organization_short_name,
        organization_full_name: r.organization_full_name ?? null,
        organization_slug: r.organization_slug,
        establish_year: r.establish_year ?? null
      })
    }

    return reply.send({ items })
  })

  // GET DETAIL
  app.get('/organization/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const id = Number(req.params?.id)
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid organization id' })

    const { data, error } = await supabase
      .from('organization')
      .select('*')
      .eq('organization_id', id)
      .single()

    if (error) return reply.code(400).send({ error: error.message })
    return reply.send({ organization: data })
  })

  // UPDATE (partial update)
  app.patch('/organization/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const id = Number(req.params?.id)
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid organization id' })

    const body = req.body || {}

    // Only allow known fields
    const patch = {}
    if ('organization_short_name' in body) patch.organization_short_name = body.organization_short_name
    if ('organization_full_name' in body) patch.organization_full_name = body.organization_full_name ?? null
    if ('establish_year' in body) patch.establish_year = body.establish_year ?? null
    if ('organization_slug' in body) patch.organization_slug = body.organization_slug

    const { data, error } = await supabase
      .from('organization')
      .update(patch)
      .eq('organization_id', id)
      .select('*')
      .single()

    if (error) return reply.code(400).send({ error: error.message })
    return reply.send({ organization: data })
  })
}
