// apps/web/src/features/org-product.js
import { createSingleSelectPicker } from '../ui/single-select-picker.js'
import { makeProductUnionSearch } from '../core/dropdowns.js'

function validateYearRange(val, { min = 1990, max = new Date().getFullYear() } = {}) {
  const s = String(val || '').trim()
  if (!s) return { ok: true, value: null }
  const n = Number(s)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return { ok: false, msg: '必须为整数年份。' }
  if (n < min || n > max) return { ok: false, msg: `年份范围：${min} ~ ${max}。` }
  return { ok: true, value: n }
}

export function mountOrgProductAdmin(ctx) {
  const {
    $,
    openModal,
    closeModal,
    norm,
    apiFetch,
    getToken,
    showConfirmFlow,
  } = ctx

  const btnOpen = $('btnOpenOrgProduct')
  const modal = $('orgProductModal')
  const closeBtn = $('orgProductClose')

  const orgErr = $('orgProductOrgErr')
  const prodErr = $('orgProductProdErr')

  const releaseYearEl = $('orgProductReleaseYear')
  const releaseYearErr = $('orgProductReleaseYearErr')

  const endYearEl = $('orgProductEndYear')
  const endYearErr = $('orgProductEndYearErr')

  const resetBtn = $('orgProductReset')
  const submitBtn = $('orgProductSubmit')

  // ===== guard =====
  if (!btnOpen || !modal || !closeBtn || !releaseYearEl || !endYearEl || !resetBtn || !submitBtn) {
    console.warn('[orgProduct] mountOrgProductAdmin skipped: missing required DOM nodes.')
    return
  }

  closeBtn.addEventListener('click', () => closeModal(modal))

  function showErr(el, msg) {
    if (!el) return
    el.textContent = msg || ''
    el.style.display = msg ? '' : 'none'
  }

  function clearErrors() {
    showErr(orgErr, '')
    showErr(prodErr, '')
    showErr(releaseYearErr, '')
    showErr(endYearErr, '')
  }

  const orgPicker = createSingleSelectPicker({
    pickedEl: $('orgProductOrgPicked'),
    clearBtn: $('orgProductOrgClear'),
    inputEl: $('orgProductOrgSearch'),
    statusEl: $('orgProductOrgStatus'),
    listEl: $('orgProductOrgList'),
    errEl: orgErr,
    emptyText: '未选择（请在下方搜索并点击一个企业/机构）',
    searchFn: async (q) => {
      const token = getToken()
      return await apiFetch(`/api/admin/organization/search?q=${encodeURIComponent(q)}`, { token })
    },
    renderItem: (it) => ({
      title: it.display_name || it.organization_short_name || '（未命名）',
      subtitle: [
        it.organization_full_name ? `全称：${it.organization_full_name}` : null,
        it.organization_short_name ? `简称：${it.organization_short_name}` : null,
        it.organization_slug ? `slug：${it.organization_slug}` : null,
      ].filter(Boolean).join(' · ')
    }),
    getId: (it) => it.organization_id,
    getLabel: (it, rendered) => rendered?.title ?? String(it.organization_id),
  })

  const productPicker = createSingleSelectPicker({
    pickedEl: $('orgProductProdPicked'),
    clearBtn: $('orgProductProdClear'),
    inputEl: $('orgProductProdSearch'),
    statusEl: $('orgProductProdStatus'),
    listEl: $('orgProductProdList'),
    errEl: prodErr,
    emptyText: '未选择（请在下方搜索并点击一个安全产品/别名）',
    searchFn: makeProductUnionSearch({ apiFetch, getToken }),
    renderItem: (it) => ({
      title: it.name || it.security_product_name || it.security_product_alias_name || '（未命名产品）',
      subtitle: [
        it.type ? `类型：${it.type}` : null,
        it.security_product_slug ? `slug：${it.security_product_slug}` : null,
        it.security_product_id ? `ID：${it.security_product_id}` : (it.id ? `ID：${it.id}` : null),
      ].filter(Boolean).join(' · ')
    }),
    // union 返回时，尽量取“归一后的主产品 id”
    getId: (it) =>
      it.security_product_id ??
      it.normalized_id ??
      it.normalized_security_product_id ??
      it.id,
    getLabel: (it, rendered) => rendered?.title ?? String(it.security_product_id ?? it.id ?? ''),
  })

  function resetForm() {
    orgPicker.clear()
    productPicker.clear()
    releaseYearEl.value = ''
    endYearEl.value = ''
    clearErrors()
  }

  function validate() {
    clearErrors()
    let ok = true

    if (!orgPicker.validateRequired('请选择企业/机构。')) ok = false
    if (!productPicker.validateRequired('请选择安全产品/别名。')) ok = false

    const now = new Date().getFullYear()

    const r = validateYearRange(releaseYearEl.value, { min: 1990, max: now })
    if (!r.ok) { showErr(releaseYearErr, r.msg); ok = false }

    const e = validateYearRange(endYearEl.value, { min: 1990, max: now })
    if (!e.ok) { showErr(endYearErr, e.msg); ok = false }

    return ok
  }

  function collectPayload() {
    const orgSel = orgPicker.getSelected()
    const prodSel = productPicker.getSelected()
    const now = new Date().getFullYear()

    const r = validateYearRange(releaseYearEl.value, { min: 1990, max: now })
    const e = validateYearRange(endYearEl.value, { min: 1990, max: now })

    return {
      organization_id: orgSel?.id,
      security_product_id: prodSel?.id,
      product_release_year: r.value,
      product_end_year: e.value,
    }
  }

  resetBtn.addEventListener('click', () => resetForm())

  submitBtn.addEventListener('click', async () => {
    if (!validate()) return

    const token = getToken()
    const payload = collectPayload()

    submitBtn.disabled = true
    resetBtn.disabled = true

    await showConfirmFlow({
      titleLoading: '添加中',
      bodyLoading: '写入企业产品中…',
      action: async () => {
        // ✅ 后端实际存在的路由：POST /api/admin/org_product
        const res = await apiFetch('/api/admin/org_product', { method: 'POST', token, body: payload })

        closeModal(modal)
        resetForm()

        const row = res?.organization_product ?? res
        const orgId = row?.organization_id ?? payload.organization_id
        const prodId = row?.security_product_id ?? payload.security_product_id
        const ry = row?.product_release_year ?? payload.product_release_year
        const ey = row?.product_end_year ?? payload.product_end_year

        return [
          '✅ 添加成功：organization_product',
          `organization_id = ${orgId}`,
          `security_product_id = ${prodId}`,
          `product_release_year = ${ry ?? '—'}`,
          `product_end_year = ${ey ?? '—'}`,
        ].join('\n')
      }
    })

    submitBtn.disabled = false
    resetBtn.disabled = false
  })

  btnOpen.addEventListener('click', () => {
    resetForm()
    openModal(modal)
    orgPicker.focus()
  })
}
