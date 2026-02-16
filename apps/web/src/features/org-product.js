// apps/web/src/features/org-product.js
import { createSingleSelectPicker } from '../ui/single-select-picker.js'

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function showErr(el, msg) {
  if (!el) return
  el.textContent = msg || ''
}

function validateYearRange(val, { min = 1990, max = new Date().getFullYear() } = {}) {
  const s = String(val ?? '').trim()
  if (!s) return { ok: true, value: null }
  const n = Number(s)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return { ok: false, msg: `年份必须为整数。` }
  if (n < min || n > max) return { ok: false, msg: `年份范围为 ${min} ~ ${max}。` }
  return { ok: true, value: n }
}

function validateScore(val) {
  const s = String(val ?? '').trim()
  if (!s) return { ok: true, value: null }
  const n = Number(s)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return { ok: false, msg: '评分必须为 1-10 的整数。' }
  if (n < 1 || n > 10) return { ok: false, msg: '评分范围为 1-10。' }
  return { ok: true, value: n }
}

export function mountOrgProductAdmin(ctx) {
  const $ = (id) => document.getElementById(id)

  const btnOpen = $('btnOrgProductOpen')
  const modal = $('orgProductModal')
  const closeBtn = $('orgProductClose')
  const resetBtn = $('orgProductReset')
  const submitBtn = $('orgProductSubmit')

  const orgPicked = $('orgProductOrgPicked')
  const orgClear = $('orgProductOrgClear')
  const orgSearch = $('orgProductOrgSearch')
  const orgStatus = $('orgProductOrgStatus')
  const orgList = $('orgProductOrgList')
  const orgErr = $('orgProductOrgErr')

  const prodPicked = $('orgProductProductPicked')
  const prodClear = $('orgProductProductClear')
  const prodSearch = $('orgProductProductSearch')
  const prodStatus = $('orgProductProductStatus')
  const prodList = $('orgProductProductList')
  const prodErr = $('orgProductProductErr')

  const releaseYearEl = $('orgProductReleaseYear')
  const releaseYearErr = $('orgProductReleaseYearErr')
  const endYearEl = $('orgProductEndYear')
  const endYearErr = $('orgProductEndYearErr')

  const scoreEl = $('orgProductScore')
  const scoreErr = $('orgProductScoreErr')

  if (!btnOpen || !modal || !closeBtn || !resetBtn || !submitBtn || !releaseYearEl || !endYearEl || !scoreEl) {
    console.warn('[orgProduct] mount skipped: missing required DOM nodes.')
    return
  }

  const orgPicker = createSingleSelectPicker({
    pickedEl: orgPicked,
    clearEl: orgClear,
    searchEl: orgSearch,
    statusEl: orgStatus,
    listEl: orgList,
    loader: async (q) => {
      const res = await fetch(`/api/admin/organization/search?q=${encodeURIComponent(q || '')}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    },
    mapItem: (row) => ({
      id: `o:${row.organization_id}`,
      label: row.organization_short_name || row.organization_full_name || `(id:${row.organization_id})`,
      raw: row,
    }),
  })

  const productPicker = createSingleSelectPicker({
    pickedEl: prodPicked,
    clearEl: prodClear,
    searchEl: prodSearch,
    statusEl: prodStatus,
    listEl: prodList,
    loader: async (q) => {
      const res = await fetch(`/api/admin/product/search?q=${encodeURIComponent(q || '')}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    },
    mapItem: (row) => ({
      id: `p:${row.security_product_id}`,
      label: row.security_product_name || row.security_product_slug || `(id:${row.security_product_id})`,
      raw: row,
    }),
  })

  function openModal() {
    modal.style.display = 'flex'
  }
  function closeModal() {
    modal.style.display = 'none'
  }

  function clearErrors() {
    showErr(orgErr, '')
    showErr(prodErr, '')
    showErr(releaseYearErr, '')
    showErr(endYearErr, '')
    showErr(scoreErr, '')
  }

  function resetForm() {
    orgPicker.clear()
    productPicker.clear()
    releaseYearEl.value = ''
    endYearEl.value = ''
    scoreEl.value = ''
    clearErrors()
  }

  function validateForm() {
    clearErrors()
    let ok = true

    const orgSel = orgPicker.getSelected()
    const prodSel = productPicker.getSelected()

    if (!orgSel) { showErr(orgErr, '请选择企业。'); ok = false }
    if (!prodSel) { showErr(prodErr, '请选择安全产品。'); ok = false }

    const now = new Date().getFullYear()
    const r = validateYearRange(releaseYearEl.value, { min: 1990, max: now })
    if (!r.ok) { showErr(releaseYearErr, r.msg); ok = false }

    const e = validateYearRange(endYearEl.value, { min: 1990, max: now })
    if (!e.ok) { showErr(endYearErr, e.msg); ok = false }

    const sc = validateScore(scoreEl.value)
    if (!sc.ok) { showErr(scoreErr, sc.msg); ok = false }

    return ok
  }

  function collectPayload() {
    const orgSel = orgPicker.getSelected()
    const prodSel = productPicker.getSelected()

    const orgId = orgSel?.raw?.organization_id
    const prodId = prodSel?.raw?.security_product_id

    if (!orgId) throw new Error('organization_id missing')
    if (!prodId) throw new Error('security_product_id missing')

    const now = new Date().getFullYear()
    const r = validateYearRange(releaseYearEl.value, { min: 1990, max: now })
    const e = validateYearRange(endYearEl.value, { min: 1990, max: now })
    const sc = validateScore(scoreEl.value)
    if (!r.ok) throw new Error(r.msg)
    if (!e.ok) throw new Error(e.msg)
    if (!sc.ok) throw new Error(sc.msg)

    return {
      organization_id: orgId,
      security_product_id: prodId,
      product_release_year: r.value,
      product_end_year: e.value,
      recommendation_score: sc.value,
    }
  }

  btnOpen.addEventListener('click', () => {
    resetForm()
    openModal()
  })

  closeBtn.addEventListener('click', closeModal)

  resetBtn.addEventListener('click', () => {
    resetForm()
  })

  submitBtn.addEventListener('click', async () => {
    if (!validateForm()) return

    try {
      const payload = collectPayload()
      submitBtn.disabled = true
      submitBtn.textContent = '提交中...'

      const res = await fetch('/api/admin/org_product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = data?.error || `HTTP ${res.status}`
        throw new Error(msg)
      }

      const row = data?.data || data
      const msg = [
        '✅ 添加成功：organization_product',
        `organization_id = ${row?.organization_id ?? payload.organization_id}`,
        `security_product_id = ${row?.security_product_id ?? payload.security_product_id}`,
        `product_release_year = ${(row?.product_release_year ?? payload.product_release_year) ?? '—'}`,
        `product_end_year = ${(row?.product_end_year ?? payload.product_end_year) ?? '—'}`,
        `recommendation_score = ${(row?.recommendation_score ?? payload.recommendation_score) ?? '—'}`,
      ].join('\n')

      alert(msg)
      closeModal()
    } catch (err) {
      alert(`❌ 添加失败：${err?.message || err}`)
    } finally {
      submitBtn.disabled = false
      submitBtn.textContent = '确定提交'
    }
  })
}
