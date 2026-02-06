// apps/api/src/routes/admin/organization.js
import { supabase } from '../../supabase.js'
import { requireAdmin } from './auth.js'

/**
 * Admin: Organization（企业/机构基础信息）
 *
 * 当前 schema（来自你贴的 ERD）：
 * - organization
 *   - organization_id (int8, PK)
 *   - organization_short_name (text, required)
 *   - organization_full_name (text, optional)
 *   - establish_year (int4, optional)
 *   - organization_slug (text, required)
 *
 * - organization_product（关联表，未来再做场景时加）
 *   - organization_id (int8)
 *   - security_product_id (int8)
 *   - product_release_year (int4)
 *   - product_end_year (int4)
 *   - organization_product_id (int8, PK)
 *
 * 设计约束（按你的规划）：
 * - 关联表的写入逻辑会收敛到对应基础表的 route 文件里（例如未来在这里处理 organization_product）
 * - 但当前阶段：只创建 organization 基础信息，不处理 organization_product
 */

export function registerOrganizationAdmin(app) {
  /**
   * POST /api/admin/organization
   *
   * Body:
   * {
   *   "organization_short_name": "Acme",
   *   "organization_full_name": "Acme Security Inc.",
   *   "establish_year": 2001,
   *   "organization_slug": "acme"
   * }
   *
   * Return:
   * { organization: {...} }
   */
  app.post('/organization', async (req, reply) => {
    if (!requireAdmin(req, reply)) return

    const body = req.body || {}

    // ✅ 白名单：只允许写入基础字段
    const payload = {
      organization_short_name: norm(body.organization_short_name),
      organization_full_name: norm(body.organization_full_name) || null,
      establish_year: body.establish_year ?? null,
      organization_slug: norm(body.organization_slug),
    }

    // ===== validate: short_name =====
    if (!payload.organization_short_name) {
      return reply.code(400).send({ error: 'organization_short_name is required' })
    }

    // ===== validate: slug =====
    if (!payload.organization_slug) {
      return reply.code(400).send({ error: 'organization_slug is required' })
    }
    // 你要求“验证英文”：这里按 slug 规范收紧（小写英文/数字/连字符）
    if (!/^[a-z0-9-]+$/.test(payload.organization_slug)) {
      return reply.code(400).send({ error: 'organization_slug must match /^[a-z0-9-]+$/' })
    }

    // ===== validate: establish_year =====
    // 允许：null / undefined / '' → null
    if (payload.establish_year === '' || payload.establish_year === undefined) {
      payload.establish_year = null
    }
    if (payload.establish_year !== null) {
      const year = Number(payload.establish_year)
      const nowYear = new Date().getFullYear()

      // int 校验
      if (!Number.isFinite(year) || !Number.isInteger(year)) {
        return reply.code(400).send({ error: 'establish_year must be an integer year' })
      }
      // 范围校验（按你要求：1990 ~ 当前年份）
      if (year < 1990 || year > nowYear) {
        return reply.code(400).send({ error: `establish_year must be between 1990 and ${nowYear}` })
      }

      payload.establish_year = year
    }

    // ===== insert organization =====
    const { data: organization, error } = await supabase
      .from('organization')
      .insert(payload)
      .select('*')
      .single()

    if (error) return reply.code(400).send({ error: error.message })

    /**
     * 未来扩展点（暂不启用）：
     * - 如果你想在“新增企业时顺手绑定产品”（organization_product）
     *   可以在这里接收 body.products 并写入 organization_product。
     * - 但按你当前 UI 规划：企业产品会由独立按钮完成，所以这里先不做。
     */

    return reply.send({ organization })
  })

  /**
   * （可选）未来你做“编辑现有企业/机构信息”时，建议在这里加：
   * - PATCH /api/admin/organization/:id
   * - GET /api/admin/organization/:id
   * 但你没要求，我先不加，避免影响当前开发节奏。
   */
}

function norm(v) {
  return (v ?? '').toString().trim()
}
