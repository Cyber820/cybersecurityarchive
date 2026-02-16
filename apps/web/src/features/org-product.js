// apps/web/src/features/org-product.js
console.log('[orgProduct] version = 2026-02-16-orgProductScore-A')

export function mountOrgProductAdmin(ctx) {
  const { $, toast, apiFetchJson } = ctx

  const btnOpen = $('orgProductOpen')
  const modal = $('orgProductModal')
  const closeBtn = $('orgProductClose')

  const orgIdEl = $('orgProductOrgId')
  const orgErr = $('orgProductOrgIdErr')

  const productIdEl = $('orgProductProductId')
  const prodErr = $('orgProductProductIdErr')

  const releaseYearEl = $('orgProductReleaseYear')
  const releaseYearErr = $('orgProductReleaseYearErr')

  const endYearEl = $('orgProductEndYear')
  const endYearErr = $('orgProductEndYearErr')

  const scoreEl = $('orgProductScore')

  const resetBtn = $('orgProductReset')
  const submitBtn = $('orgProductSubmit')

  if (!btnOpen || !modal || !closeBtn || !resetBtn || !submitBtn || !releaseYearEl || !endYearEl || !scoreEl) {
    console.warn('[orgProduct] missing DOM nodes, mount skipped.')
    return
  }

  btnOpen.addEventListener('click', () => {
    modal.style.display = 'block'
  })
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none'
  })
  resetBtn.addEventListener('click', resetForm)
  submitBtn.addEventListener('click', runSubmit)

  function resetForm() {
    orgIdEl.value = ''
    productIdEl.value = ''
    releaseYearEl.value = ''
    endYearEl.value = ''
    scoreEl.value = ''
    clearErrors()
  }

  function clearErrors() {
    orgErr.textContent = ''
    prodErr.textContent = ''
    releaseYearErr.textContent = ''
    endYearErr.textContent = ''
  }

  function validate() {
    clearErrors()

    let ok = true
    const orgId = Number(orgIdEl.value)
    const prodId = Number(productIdEl.value)
    if (!Number.isFinite(orgId) || orgId <= 0) { showErr(orgErr, '请输入 organization_id（正整数）'); ok = false }
    if (!Number.isFinite(prodId) || prodId <= 0) { showErr(prodErr, '请输入 security_product_id（正整数）'); ok = false }

    const now = new Date().getFullYear()

    const r = validateYearRange(releaseYearEl.value, { min: 1990, max: now })
    if (!r.ok) { showErr(releaseYearErr, r.msg); ok = false }

    const e = validateYearRange(endYearEl.value, { min: 1990, max: now })
    if (!e.ok) { showErr(endYearErr, e.msg); ok = false }

    const s = validateScore(scoreEl.value)
    if (s === '__invalid__') { showErr(endYearErr, '评分必须是 1-10 的整数，或留空'); ok = false }

    return ok
  }

  function collectPayload() {
    const orgId = Number(orgIdEl.value)
    const prodId = Number(productIdEl.value)
    const now = new Date().getFullYear()

    const r = validateYearRange(releaseYearEl.value, { min: 1990, max: now })
    const e = validateYearRange(endYearEl.value, { min: 1990, max: now })
    if (!r.ok || !e.ok) throw new Error('invalid year')

    const s = validateScore(scoreEl.value)
    if (s === '__invalid__') throw new Error('recommendation_score must be an integer 1-10')

    return {
      organization_id: orgId,
      security_product_id: prodId,
      product_release_year: r.value,
      product_end_year: e.value,
      recommendation_score: s,
    }
  }

  async function runSubmit() {
    if (!validate()) return

    try {
      submitBtn.disabled = true

      const payload = collectPayload()
      await apiFetchJson('/api/admin/org_product', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      toast('已添加企业产品关联')
      modal.style.display = 'none'
      resetForm()

      // 让“编辑企业产品”列表刷新（如果已挂载）
      window.dispatchEvent(new CustomEvent('orgProduct:changed'))

    } catch (err) {
      toast(String(err?.message || err), { type: 'error' })
    } finally {
      submitBtn.disabled = false
    }
  }

  function showErr(el, msg) {
    if (!el) return
    el.textContent = msg
  }
}

function validateYearRange(raw, { min, max }) {
  const s = String(raw ?? '').trim()
  if (!s) return { ok: true, value: null }

  const n = Number(s)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return { ok: false, msg: '必须是整数，或留空' }
  if (n < min || n > max) return { ok: false, msg: `范围：${min} ~ ${max}` }
  return { ok: true, value: n }
}

function validateScore(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const n = Number(s)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return '__invalid__'
  if (n < 1 || n > 10) return '__invalid__'
  return n
}
