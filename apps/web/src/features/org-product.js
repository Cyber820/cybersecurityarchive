// apps/web/src/features/org-product.js

import { apiFetchJSON } from '../lib/api.js'

/**
 * 企业产品（organization_product）添加
 * - organization_id: 通过 organization_slug 查 organization
 * - security_product_id: 通过 security_product_slug 查 product
 * - product_release_year / product_end_year: 选填
 * - recommendation_score: 选填 1-10
 */

console.log('[orgProduct] version = 2026-02-16-orgProductScore-A')

function $(id) {
  return document.getElementById(id)
}

function show(el) {
  el.style.display = 'flex'
}
function hide(el) {
  el.style.display = 'none'
}

function toIntOrEmpty(v) {
  const s = String(v ?? '').trim()
  if (s === '') return ''
  const n = Number(s)
  if (!Number.isInteger(n)) return '__invalid__'
  return n
}

export function mountOrgProductAdmin() {
  const modal = $('orgProductModal')
  const btnOpen = $('btnOpenOrgProduct')
  const btnClose = $('orgProductClose')
  const btnReset = $('orgProductReset')
  const btnSubmit = $('orgProductSubmit')

  const orgSlugEl = $('orgProductOrgSlug')
  const orgSlugErr = $('orgProductOrgSlugErr')

  const productSlugEl = $('orgProductProductSlug')
  const productSlugErr = $('orgProductProductSlugErr')

  const releaseYearEl = $('orgProductReleaseYear')
  const releaseYearErr = $('orgProductReleaseYearErr')

  const endYearEl = $('orgProductEndYear')
  const endYearErr = $('orgProductEndYearErr')

  const scoreEl = $('orgProductScore')
  const scoreErr = $('orgProductScoreErr')

  const statusEl = $('orgProductStatus')

  const requiredNodes = [
    modal, btnOpen, btnClose, btnReset, btnSubmit,
    orgSlugEl, orgSlugErr,
    productSlugEl, productSlugErr,
    releaseYearEl, releaseYearErr,
    endYearEl, endYearErr,
    statusEl,
  ]
  if (requiredNodes.some(Boolean) === false) {
    console.warn('[orgProduct] missing DOM nodes, mount skipped.')
    return
  }

  function resetForm() {
    orgSlugEl.value = ''
    productSlugEl.value = ''
    releaseYearEl.value = ''
    endYearEl.value = ''
    if (scoreEl) scoreEl.value = ''

    orgSlugErr.textContent = ''
    productSlugErr.textContent = ''
    releaseYearErr.textContent = ''
    endYearErr.textContent = ''
    if (scoreErr) scoreErr.textContent = ''
    statusEl.textContent = ''
  }

  function validate() {
    let ok = true
    orgSlugErr.textContent = ''
    productSlugErr.textContent = ''
    releaseYearErr.textContent = ''
    endYearErr.textContent = ''
    if (scoreErr) scoreErr.textContent = ''
    statusEl.textContent = ''

    const orgSlug = orgSlugEl.value.trim()
    const productSlug = productSlugEl.value.trim()

    if (!orgSlug) {
      ok = false
      orgSlugErr.textContent = '企业 slug 必填'
    }
    if (!productSlug) {
      ok = false
      productSlugErr.textContent = '产品 slug 必填'
    }

    const y1 = toIntOrEmpty(releaseYearEl.value)
    const y2 = toIntOrEmpty(endYearEl.value)
    if (y1 === '__invalid__') {
      ok = false
      releaseYearErr.textContent = '年份必须是整数'
    }
    if (y2 === '__invalid__') {
      ok = false
      endYearErr.textContent = '年份必须是整数'
    }
    if (y1 !== '' && y2 !== '' && ok) {
      if (Number(y1) > Number(y2)) {
        ok = false
        endYearErr.textContent = '终止年份不能早于发布年份'
      }
    }

    // score (optional)
    if (scoreEl && scoreEl.value !== '') {
      const s = Number(scoreEl.value)
      if (!Number.isInteger(s) || s < 1 || s > 10) {
        ok = false
        if (scoreErr) scoreErr.textContent = '评分必须是 1-10 的整数'
      }
    }

    return ok
  }

  function buildPayload() {
    const y1 = toIntOrEmpty(releaseYearEl.value)
    const y2 = toIntOrEmpty(endYearEl.value)

    return {
      organization_slug: orgSlugEl.value.trim(),
      security_product_slug: productSlugEl.value.trim(),
      product_release_year: y1 === '' ? null : y1,
      product_end_year: y2 === '' ? null : y2,
      recommendation_score: (scoreEl && scoreEl.value !== '') ? Number(scoreEl.value) : null,
    }
  }

  async function submit() {
    if (!validate()) return
    statusEl.textContent = '提交中...'

    const payload = buildPayload()
    const res = await apiFetchJSON('/api/admin/org_product', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      statusEl.textContent = `失败：${res.error || res.status || 'unknown error'}`
      return
    }

    statusEl.textContent = '成功'
  }

  btnOpen.addEventListener('click', () => {
    resetForm()
    show(modal)
  })
  btnClose.addEventListener('click', () => hide(modal))
  btnReset.addEventListener('click', () => resetForm())
  btnSubmit.addEventListener('click', () => submit())
}
