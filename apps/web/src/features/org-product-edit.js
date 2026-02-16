// apps/web/src/features/org-product-edit.js

import { apiFetchJSON } from '../lib/api.js'

console.log('[orgProductEdit] version = 2026-02-16-orgProductScore-A')

function $(id) {
  return document.getElementById(id)
}

function show(el) {
  el.style.display = 'flex'
}
function hide(el) {
  el.style.display = 'none'
}

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function toIntOrEmpty(v) {
  const s = String(v ?? '').trim()
  if (s === '') return ''
  const n = Number(s)
  if (!Number.isInteger(n)) return '__invalid__'
  return n
}

export function mountOrgProductEditAdmin() {
  const modal = $('orgProductEditModal')
  const btnOpen = $('btnOpenOrgProductEdit')
  const btnClose = $('orgProductEditClose')
  const btnCancel = $('orgProductEditCancel')
  const btnReset = $('orgProductEditReset')

  const searchEl = $('orgProductEditSearch')
  const searchBtn = $('orgProductEditSearchBtn')
  const hintEl = $('orgProductEditHint')
  const listEl = $('orgProductEditList')

  const itemModal = $('orgProductEditItemModal')
  const itemClose = $('orgProductEditItemClose')
  const itemCancel = $('orgProductEditItemCancel')
  const itemReset = $('orgProductEditItemReset')
  const itemSubmit = $('orgProductEditItemSubmit')

  const pickedEl = $('orgProductEditItemPicked')
  const releaseYearEl = $('orgProductEditItemReleaseYear')
  const releaseYearErr = $('orgProductEditItemReleaseYearErr')
  const endYearEl = $('orgProductEditItemEndYear')
  const endYearErr = $('orgProductEditItemEndYearErr')

  const scoreEl = $('orgProductEditItemScore')
  const scoreErr = $('orgProductEditItemScoreErr')

  const previewEl = $('orgProductEditItemPreview')
  const statusEl = $('orgProductEditItemStatus')

  const requiredNodes = [
    modal, btnOpen, btnClose, btnCancel, btnReset,
    searchEl, searchBtn, hintEl, listEl,
    itemModal, itemClose, itemCancel, itemReset, itemSubmit,
    pickedEl, releaseYearEl, releaseYearErr, endYearEl, endYearErr, previewEl, statusEl,
  ]
  if (requiredNodes.some(Boolean) === false) {
    console.warn('[orgProductEdit] missing DOM nodes, mount skipped.')
    return
  }

  let currentList = []
  let editingRow = null

  function resetMain() {
    searchEl.value = ''
    hintEl.textContent = ''
    listEl.innerHTML = ''
    currentList = []
    editingRow = null
  }

  function renderList(rows) {
    if (!rows || rows.length === 0) {
      listEl.innerHTML = '<div class="item">(无结果)</div>'
      return
    }
    listEl.innerHTML = rows.map((r) => {
      return `
        <div class="item"
             data-id="${esc(r.organization_product_id)}"
             data-name="${esc(r.organization_short_name)}"
             data-slug="${esc(r.security_product_slug)}"
             data-y1="${esc(r.product_release_year ?? '')}"
             data-y2="${esc(r.product_end_year ?? '')}"
             data-score="${esc(r.recommendation_score ?? '')}">
          <div style="font-weight:700;">${esc(r.organization_short_name)}  ·  ${esc(r.security_product_name)} (${esc(r.security_product_slug)})</div>
          <div style="color:rgba(0,0,0,0.55); font-size:12px;">
            release=${esc(r.product_release_year ?? '—')} / end=${esc(r.product_end_year ?? '—')} / score=${esc(r.recommendation_score ?? '—')}
          </div>
        </div>
      `
    }).join('')
  }

  async function doSearch() {
    hintEl.textContent = '搜索中...'
    listEl.innerHTML = ''
    const q = searchEl.value.trim()
    const res = await apiFetchJSON(`/api/admin/org_product/search?q=${encodeURIComponent(q)}`)
    if (!res.ok) {
      hintEl.textContent = `失败：${res.error || res.status || 'unknown'}`
      return
    }
    currentList = res.data || []
    hintEl.textContent = `共 ${currentList.length} 条`
    renderList(currentList)
  }

  function resetItem() {
    editingRow = null
    pickedEl.textContent = '(未选择)'
    releaseYearEl.value = ''
    endYearEl.value = ''
    if (scoreEl) scoreEl.value = ''

    releaseYearErr.textContent = ''
    endYearErr.textContent = ''
    if (scoreErr) scoreErr.textContent = ''
    previewEl.textContent = ''
    statusEl.textContent = ''
  }

  function validateEdit() {
    let ok = true
    releaseYearErr.textContent = ''
    endYearErr.textContent = ''
    if (scoreErr) scoreErr.textContent = ''
    statusEl.textContent = ''

    if (!editingRow) {
      ok = false
      statusEl.textContent = '未选择要编辑的记录'
      return ok
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

    if (scoreEl && scoreEl.value !== '') {
      const s = Number(scoreEl.value)
      if (!Number.isInteger(s) || s < 1 || s > 10) {
        ok = false
        if (scoreErr) scoreErr.textContent = '评分必须是 1-10 的整数'
      }
    }

    return ok
  }

  function buildPatch() {
    const y1 = toIntOrEmpty(releaseYearEl.value)
    const y2 = toIntOrEmpty(endYearEl.value)
    return {
      product_release_year: y1 === '' ? null : y1,
      product_end_year: y2 === '' ? null : y2,
      recommendation_score: (scoreEl && scoreEl.value !== '') ? Number(scoreEl.value) : null,
    }
  }

  async function submitEdit() {
    if (!validateEdit()) return
    statusEl.textContent = '保存中...'

    const patch = buildPatch()
    const id = editingRow.organization_product_id
    const res = await apiFetchJSON(`/api/admin/org_product/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      statusEl.textContent = `失败：${res.error || res.status || 'unknown'}`
      return
    }
    statusEl.textContent = '成功'
  }

  function openEditItemFromEl(rowEl) {
    const orgProductId = rowEl.getAttribute('data-id')
    const name = rowEl.getAttribute('data-name') || ''
    const slug = rowEl.getAttribute('data-slug') || ''
    const oldY1 = rowEl.getAttribute('data-y1') || ''
    const oldY2 = rowEl.getAttribute('data-y2') || ''
    const oldScore = rowEl.getAttribute('data-score') || ''

    editingRow = { organization_product_id: orgProductId, name, slug, oldY1, oldY2, oldScore }
    pickedEl.textContent = `${name} · ${slug} (#${orgProductId})`

    // 预填
    releaseYearEl.value = oldY1
    endYearEl.value = oldY2
    if (scoreEl) scoreEl.value = oldScore

    const patch = buildPatch()
    previewEl.textContent = [
      `发布年份：${oldY1 || '—'}  ->  ${patch.product_release_year ?? '—'}`,
      `终止年份：${oldY2 || '—'}  ->  ${patch.product_end_year ?? '—'}`,
      `评分：${oldScore || '—'}  ->  ${patch.recommendation_score ?? '—'}`,
    ].join('\n')

    show(itemModal)
  }

  // events
  btnOpen.addEventListener('click', () => {
    resetMain()
    show(modal)
  })
  btnClose.addEventListener('click', () => hide(modal))
  btnCancel.addEventListener('click', () => hide(modal))
  btnReset.addEventListener('click', () => resetMain())

  searchBtn.addEventListener('click', () => doSearch())
  searchEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch()
  })

  listEl.addEventListener('click', (e) => {
    const item = e.target.closest('.item')
    if (!item || !item.getAttribute('data-id')) return
    resetItem()
    openEditItemFromEl(item)
  })

  itemClose.addEventListener('click', () => hide(itemModal))
  itemCancel.addEventListener('click', () => hide(itemModal))
  itemReset.addEventListener('click', () => resetItem())
  itemSubmit.addEventListener('click', () => submitEdit())

  // live preview
  ;[releaseYearEl, endYearEl, scoreEl].filter(Boolean).forEach((el) => {
    el.addEventListener('input', () => {
      if (!editingRow) return
      const patch = buildPatch()
      previewEl.textContent = [
        `发布年份：${editingRow.oldY1 || '—'}  ->  ${patch.product_release_year ?? '—'}`,
        `终止年份：${editingRow.oldY2 || '—'}  ->  ${patch.product_end_year ?? '—'}`,
        `评分：${editingRow.oldScore || '—'}  ->  ${patch.recommendation_score ?? '—'}`,
      ].join('\n')
    })
  })
}
