// apps/web/src/features/org-product.js
import { createSingleSelectPicker } from '../ui/single-select-picker.js'
import { makeProductUnionSearch } from '../core/dropdowns.js'

console.log('[orgProduct] version = 2026-02-11-B (normalize union id)')

function toIntStrict(v) {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim())
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null
  return n
}

function parsePrefixedId(v) {
  // support: "p:7", "a:7", "7"
  const s = String(v ?? '').trim()
  if (!s) return null
  if (/^\d+$/.test(s)) return toIntStrict(s)
  const m = s.match(/^[a-zA-Z]+:(\d+)$/)
  if (!m) return null
  return toIntStrict(m[1])
}

function resolveUnionProductId(selected) {
  // selected: { id, label, raw }
  if (!selected) return null
  const raw = selected.raw || {}
  // 优先用 union 结果提供的“主产品 id”
  const cands = [
    raw.security_product_id,
    raw.product_id,
    raw.normalized_security_product_id,
    raw.normalized_id,
    raw.normalized_product_id,
    selected.id,
  ]
  for (const v of cands) {
    const n = typeof v === 'string' ? parsePrefixedId(v) : toIntStrict(v)
    if (n !== null) return n
  }
  return null
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

  window.__orgProductMounted = true

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
        it.kind ? `类型：${it.kind}` : (it.type ? `类型：${it.type}` : null),
        it.slug ? `slug：${it.slug}` : (it.security_product_slug ? `slug：${it.security_product_slug}` : null),
        (it.product_id ?? it.security_product_id ?? it.normalized_security_product_id) ? `ID：${it.product_id ?? it.security_product_id ?? it.normalized_security_product_id}` : null,
      ].filter(Boolean).join(' · ')
    }),
    // 注意：这里可以保留 union 的字符串 id（p:7 / a:7），我们会在提交时做归一化
    getId: (it) => it.id ?? it.security_product_id ?? it.product_id ?? it.normalized_security_product_id ?? it.normalized_id,
    getLabel: (it, rendered) => rendered?.title ?? String(it.name ?? it.security_product_name ?? it.security_product_alias_name ?? it.id ?? ''),
  })

  // 保留 debug
  window.__orgProductDebug = { orgPicker, productPicker }

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

    const orgOk = orgPicker.validateRequired('请选择企业/机构。')
    if (!orgOk) ok = false

    const prodOk = productPicker.validateRequired('请选择安全产品/别名。')
    if (!prodOk) ok = false

    const now = new Date().getFullYear()

    const r = validateYearRange(releaseYearEl.value, { min: 1990, max: now })
    if (!r.ok) { showErr(releaseYearErr, r.msg); ok = false }

    const e = validateYearRange(endYearEl.value, { min: 1990, max: now })
    if (!e.ok) { showErr(endYearErr, e.msg); ok = false }

    const orgId = toIntStrict(orgPicker.getSelected()?.id)
    if (orgId === null) { showErr(orgErr, '企业 ID 无效（必须为数字）。请重新选择。'); ok = false }

    const prodSel = productPicker.getSelected()
    const prodId = resolveUnionProductId(prodSel)
    if (prodId === null) { showErr(prodErr, '产品 ID 无效（请重新选择）。'); ok = false }

    if (!ok) {
      console.warn('[orgProduct] validate failed', {
        orgSelected: orgPicker.getSelected(),
        productSelected: prodSel,
        resolvedProductId: prodId,
        releaseYear: releaseYearEl.value,
        endYear: endYearEl.value,
      })
    }

    return ok
  }

  function collectPayload() {
    const now = new Date().getFullYear()

    const orgId = toIntStrict(orgPicker.getSelected()?.id)
    const prodSel = productPicker.getSelected()
    const prodId = resolveUnionProductId(prodSel)

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

    await showConfirmFlow({
      titleLoading: '添加中',
      bodyLoading: '写入企业产品中…',
      action,
    })
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
      try { alert(`企业产品添加失败：${msg}`) } catch {}
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
