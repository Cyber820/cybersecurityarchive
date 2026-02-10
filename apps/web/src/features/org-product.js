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

  const req = (id) => {
    const el = $(id)
    if (!el) console.warn(`[orgProduct] missing element #${id}`)
    return el
  }

  const btnOpen = req('btnOpenOrgProduct')
  const modal = req('orgProductModal')
  const closeBtn = req('orgProductClose')

  const orgErr = req('orgProductOrgErr')
  const prodErr = req('orgProductProdErr')

  const releaseYearEl = req('orgProductReleaseYear')
  const releaseYearErr = req('orgProductReleaseYearErr')

  const endYearEl = req('orgProductEndYear')
  const endYearErr = req('orgProductEndYearErr')

  const resetBtn = req('orgProductReset')
  const submitBtn = req('orgProductSubmit')

  const orgPickedEl = req('orgProductOrgPicked')
  const orgClearBtn = req('orgProductOrgClear')
  const orgSearchInput = req('orgProductOrgSearch')
  const orgStatusEl = req('orgProductOrgStatus')
  const orgListEl = req('orgProductOrgList')

  const prodPickedEl = req('orgProductProdPicked')
  const prodClearBtn = req('orgProductProdClear')
  const prodSearchInput = req('orgProductProdSearch')
  const prodStatusEl = req('orgProductProdStatus')
  const prodListEl = req('orgProductProdList')

  if (
    !btnOpen || !modal || !closeBtn ||
    !orgErr || !prodErr ||
    !releaseYearEl || !releaseYearErr ||
    !endYearEl || !endYearErr ||
    !resetBtn || !submitBtn ||
    !orgPickedEl || !orgClearBtn || !orgSearchInput || !orgStatusEl || !orgListEl ||
    !prodPickedEl || !prodClearBtn || !prodSearchInput || !prodStatusEl || !prodListEl
  ) {
    console.warn('[orgProduct] mountOrgProductAdmin skipped due to missing DOM nodes.')
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
    pickedEl: orgPickedEl,
    clearBtn: orgClearBtn,
    inputEl: orgSearchInput,
    statusEl: orgStatusEl,
    listEl: orgListEl,
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
    pickedEl: prodPickedEl,
    clearBtn: prodClearBtn,
    inputEl: prodSearchInput,
    statusEl: prodStatusEl,
    listEl: prodListEl,
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
    getId: (it) => it.security_product_id || it.id,
    getLabel: (it, rendered) => rendered?.title ?? (it.name || String(it.security_product_id || it.id)),
  })

  function validate() {
    clearErrors()

    const orgPicked = orgPicker.getSelected()
    const prodPicked = productPicker.getSelected()

    let ok = true
    if (!orgPicked) {
      showErr(orgErr, '请选择企业/机构。')
      ok = false
    }
    if (!prodPicked) {
      showErr(prodErr, '请选择产品。')
      ok = false
    }

    const now = new Date().getFullYear()
    const rel = validateYearRange(releaseYearEl.value, { min: 1990, max: now })
    if (!rel.ok) {
      showErr(releaseYearErr, rel.msg)
      ok = false
    }

    const end = validateYearRange(endYearEl.value, { min: 1990, max: now })
    if (!end.ok) {
      showErr(endYearErr, end.msg)
      ok = false
    }

    return { ok, rel: rel.value, end: end.value }
  }

  function resetForm() {
    clearErrors()
    orgPicker.clear()
    productPicker.clear()
    releaseYearEl.value = ''
    endYearEl.value = ''
  }

  btnOpen.addEventListener('click', () => {
    resetForm()
    openModal(modal)
  })

  resetBtn.addEventListener('click', () => resetForm())

  submitBtn.addEventListener('click', async () => {
    const v = validate()
    if (!v.ok) return

    const token = getToken()
    const orgPicked = orgPicker.getSelected()
    const prodPicked = productPicker.getSelected()

    // 归一后的主产品 id（union 的 alias 项也会带 security_product_id）
    const security_product_id = prodPicked.security_product_id || prodPicked.id
    const organization_id = orgPicked.organization_id || orgPicked.id

    submitBtn.disabled = true
    resetBtn.disabled = true

    await showConfirmFlow({
      titleLoading: '添加中',
      bodyLoading: '写入企业产品中…',
      action: async () => {
        const payload = {
          organization_id,
          security_product_id,
          release_year: v.rel,
          end_year: v.end,
        }
        const res = await apiFetch('/api/admin/organization-product', { method: 'POST', token, body: payload })
        closeModal(modal)
        resetForm()
        return `✅ 添加成功：organization_product_id = ${res?.organization_product?.organization_product_id ?? res?.organization_product_id ?? '（未返回）'}`
      }
    })

    submitBtn.disabled = false
    resetBtn.disabled = false
  })
}
