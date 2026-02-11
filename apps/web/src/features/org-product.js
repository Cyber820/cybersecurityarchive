// apps/web/src/features/org-product.js
import { createSingleSelectPicker } from '../ui/single-select-picker.js'
import { makeProductUnionSearch } from '../core/dropdowns.js'

console.log('[orgProduct] version = 2026-02-11-A')

function toIntStrict(v) {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim())
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null
  return n
}

function validateYearRange(val, { min = 1990, max = new Date().getFullYear() } = {}) {
  const s = String(val || '').trim()
  if (!s) return { ok: true, value: null }
  const n = Number(s)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return { ok: false, msg: '必须为整数年份。' }
  if (n < min || n > max) return { ok: false, msg: `年份范围：${min} ~ ${max}。` }
  return { ok: true, value: n }
}

export function mountOrgProductAdmin(ctx) {
  const { $, openModal, closeModal, apiFetch, getToken, showConfirmFlow } = ctx

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

  // 必备节点（少一个就无法工作）
  if (!btnOpen || !modal || !closeBtn || !resetBtn || !submitBtn || !releaseYearEl || !endYearEl) {
    console.warn('[orgProduct] mount skipped: missing required DOM nodes.', {
      btnOpen: !!btnOpen,
      modal: !!modal,
      closeBtn: !!closeBtn,
      resetBtn: !!resetBtn,
      submitBtn: !!submitBtn,
      releaseYearEl: !!releaseYearEl,
      endYearEl: !!endYearEl,
    })
    return
  }

  // 标记 mount 成功（便于你 console 检查）
  window.__orgProductMounted = true

  function showErr(el, msg) {
    if (!el) return
    el.textContent = msg || ''
    el.style.display = msg ? '' : 'none'
  }

  function hardNotify(msg) {
    // 兜底：避免“校验失败但没提示”造成“没反应”
    try { alert(msg) } catch {}
    console.warn('[orgProduct] notify:', msg)
  }

  function clearErrors() {
    showErr(orgErr, '')
    showErr(prodErr, '')
    showErr(releaseYearErr, '')
    showErr(endYearErr, '')
  }

  closeBtn.addEventListener('click', () => closeModal(modal))

  const orgPicker = createSingleSelectPicker({
    pickedEl: $('orgProductOrgPicked'),
    clearBtn: $('orgProductOrgClear'),
    inputEl: $('orgProductOrgSearch'),
    statusEl: $('orgProductOrgStatus'),
    listEl: $('orgProductOrgList'),
    errEl: orgErr || null,
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
    errEl: prodErr || null,
    emptyText: '未选择（请在下方搜索并点击一个安全产品/别名）',
    searchFn: makeProductUnionSearch({ apiFetch, getToken }),
    renderItem: (it) => ({
      title: it.name || it.security_product_name || it.security_product_alias_name || '（未命名产品）',
      subtitle: [
        it.type ? `类型：${it.type}` : null,
        it.security_product_slug ? `slug：${it.security_product_slug}` : null,
        (it.security_product_id ?? it.id) ? `ID：${it.security_product_id ?? it.id}` : null,
      ].filter(Boolean).join(' · ')
    }),
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

    // 1) 必填校验（如果 errEl 缺失，给硬提示）
    const orgOk = orgPicker.validateRequired('请选择企业/机构。')
    if (!orgOk) {
      ok = false
      if (!orgErr) hardNotify('请选择企业/机构（orgProductOrgErr 节点缺失，无法在页面显示错误）。')
    }

    const prodOk = productPicker.validateRequired('请选择安全产品/别名。')
    if (!prodOk) {
      ok = false
      if (!prodErr) hardNotify('请选择安全产品/别名（orgProductProdErr 节点缺失，无法在页面显示错误）。')
    }

    const now = new Date().getFullYear()

    const r = validateYearRange(releaseYearEl.value, { min: 1990, max: now })
    if (!r.ok) { showErr(releaseYearErr, r.msg); ok = false }

    const e = validateYearRange(endYearEl.value, { min: 1990, max: now })
    if (!e.ok) { showErr(endYearErr, e.msg); ok = false }

    // 2) ID 必须是整数
    const orgId = toIntStrict(orgPicker.getSelected()?.id)
    if (orgId === null) { showErr(orgErr, '企业 ID 无效（必须为数字）。请重新选择。'); ok = false }

    const prodId = toIntStrict(productPicker.getSelected()?.id)
    if (prodId === null) { showErr(prodErr, '产品 ID 无效（必须为数字）。请重新选择。'); ok = false }

    if (!ok) {
      console.warn('[orgProduct] validate failed', {
        orgSelected: orgPicker.getSelected(),
        productSelected: productPicker.getSelected(),
        releaseYear: releaseYearEl.value,
        endYear: endYearEl.value,
        hasOrgErrEl: !!orgErr,
        hasProdErrEl: !!prodErr,
      })
    }

    return ok
  }

  function collectPayload() {
    const now = new Date().getFullYear()

    const orgId = toIntStrict(orgPicker.getSelected()?.id)
    const prodId = toIntStrict(productPicker.getSelected()?.id)

    if (orgId === null) throw new Error('organization_id must be a number')
    if (prodId === null) throw new Error('security_product_id must be a number')

    const r = validateYearRange(releaseYearEl.value, { min: 1990, max: now })
    const e = validateYearRange(endYearEl.value, { min: 1990, max: now })

    return {
      organization_id: orgId,
      security_product_id: prodId,
      product_release_year: r.value,
      product_end_year: e.value,
    }
  }

  async function runSubmit() {
    if (!validate()) return

    const token = getToken()
    const payload = collectPayload()

    console.log('[orgProduct] submit payload:', payload)

    const action = async () => {
      const res = await apiFetch('/api/admin/org_product', { method: 'POST', token, body: payload })
      const row = res?.organization_product ?? res

      const msg = [
        '✅ 添加成功：organization_product',
        `organization_id = ${row?.organization_id ?? payload.organization_id}`,
        `security_product_id = ${row?.security_product_id ?? payload.security_product_id}`,
        `product_release_year = ${(row?.product_release_year ?? payload.product_release_year) ?? '—'}`,
        `product_end_year = ${(row?.product_end_year ?? payload.product_end_year) ?? '—'}`,
      ].join('\n')

      closeModal(modal)
      resetForm()
      return msg
    }

    if (typeof showConfirmFlow === 'function') {
      await showConfirmFlow({
        titleLoading: '添加中',
        bodyLoading: '写入企业产品中…',
        action,
      })
    } else {
      const msg = await action()
      alert(msg)
    }
  }

  resetBtn.addEventListener('click', () => resetForm())

  submitBtn.addEventListener('click', async () => {
    submitBtn.disabled = true
    resetBtn.disabled = true
    try {
      await runSubmit()
    } catch (e) {
      console.error('[orgProduct] submit failed:', e)
      const msg = e?.message || String(e)
      showErr(prodErr, `❌ 失败：${msg}`)
      hardNotify(`企业产品添加失败：${msg}`)
    } finally {
      submitBtn.disabled = false
      resetBtn.disabled = false
    }
  })

  btnOpen.addEventListener('click', () => {
    resetForm()
    openModal(modal)
    orgPicker.focus()
  })
}
