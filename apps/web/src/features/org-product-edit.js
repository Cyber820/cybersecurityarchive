// apps/web/src/features/org-product-edit.js
import { createSingleSelectPicker } from '../ui/single-select-picker.js'

function validateYearRange(val, { min = 1990, max = new Date().getFullYear() } = {}) {
  const s = String(val || '').trim()
  if (!s) return { ok: true, value: null }
  const n = Number(s)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return { ok: false, msg: '必须为整数年份。' }
  if (n < min || n > max) return { ok: false, msg: `年份范围：${min} ~ ${max}。` }
  return { ok: true, value: n }
}

function validateScore(val) {
  const s = String(val || '').trim()
  if (!s) return { ok: true, value: null }
  const n = Number(s)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return { ok: false, msg: '必须为 1~10 的整数。' }
  if (n < 1 || n > 10) return { ok: false, msg: '范围：1 ~ 10。' }
  return { ok: true, value: n }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]))
}

export function mountOrgProductEdit(ctx) {
  const { $, openModal, closeModal, apiFetch, getToken, showConfirmFlow } = ctx

  const btnOpen = $('btnOpenOrgProductEdit')
  const modal = $('orgProductEditModal')
  const closeBtn = $('orgProductEditClose')

  const listEl = $('orgProductEditList')
  const refreshBtn = $('orgProductEditRefresh')

  const orgErr = $('orgProductEditOrgErr')

  // edit-item modal
  const itemModal = $('orgProductEditItemModal')
  const itemCloseBtn = $('orgProductEditItemClose')
  const itemResetBtn = $('orgProductEditItemReset')
  const itemSubmitBtn = $('orgProductEditItemSubmit')
  const previewEl = $('orgProductEditItemPreview')

  const releaseYearEl = $('orgProductEditItemReleaseYear')
  const releaseYearErr = $('orgProductEditItemReleaseYearErr')
  const endYearEl = $('orgProductEditItemEndYear')
  const endYearErr = $('orgProductEditItemEndYearErr')

  const scoreEl = $('orgProductEditItemScore')
  const scoreErr = $('orgProductEditItemScoreErr')

  if (!btnOpen || !modal || !closeBtn || !listEl || !refreshBtn || !itemModal) {
    console.warn('[orgProductEdit] mount skipped: missing required DOM nodes.')
    return
  }

  function showErr(el, msg) {
    if (!el) return
    el.textContent = msg || ''
    el.style.display = msg ? '' : 'none'
  }

  function clearErrors() {
    showErr(orgErr, '')
    showErr(releaseYearErr, '')
    showErr(endYearErr, '')
    showErr(scoreErr, '')
    showErr(scoreErr, '')
  }

  closeBtn.addEventListener('click', () => closeModal(modal))
  itemCloseBtn?.addEventListener('click', () => closeModal(itemModal))

  const orgPicker = createSingleSelectPicker({
    pickedEl: $('orgProductEditOrgPicked'),
    clearBtn: $('orgProductEditOrgClear'),
    inputEl: $('orgProductEditOrgSearch'),
    statusEl: $('orgProductEditOrgStatus'),
    listEl: $('orgProductEditOrgList'),
    errEl: orgErr,
    emptyText: '未选择（请先选择一个企业/机构）',
    searchFn: async (q) => {
      const token = getToken()
      return await apiFetch(`/api/admin/organization/search?q=${encodeURIComponent(q)}`, { token })
    },
    renderItem: (it) => ({
      title: it.display_name || it.organization_short_name || '（未命名）',
      subtitle: [
        it.organization_full_name ? `全称：${it.organization_full_name}` : null,
        it.organization_slug ? `slug：${it.organization_slug}` : null,
        `ID：${it.organization_id}`,
      ].filter(Boolean).join(' · ')
    }),
    getId: (it) => it.organization_id,
    getLabel: (it, rendered) => rendered?.title ?? String(it.organization_id),
  })

  let editingRow = null

  function resetEditModalState() {
    editingRow = null
    releaseYearEl.value = ''
    endYearEl.value = ''
    if (scoreEl) scoreEl.value = ''
    clearErrors()
    if (previewEl) previewEl.textContent = ''
  }

  function openEditModalFromRow(el) {
    const opId = Number(el.dataset?.opId || NaN)
    if (!Number.isFinite(opId)) return

    const y1 = el.dataset?.y1 ?? ''
    const y2 = el.dataset?.y2 ?? ''
    const sc = el.dataset?.score ?? ''

    editingRow = {
      organization_product_id: opId,
      organization_id: Number(el.dataset?.orgId || NaN),
      security_product_id: Number(el.dataset?.spId || NaN),
      old_release_year: y1 === '' ? null : Number(y1),
      old_end_year: y2 === '' ? null : Number(y2),
      old_score: sc === '' ? null : Number(sc),
    }

    resetEditModalState()

    releaseYearEl.value = (y1 ?? '') === '' ? '' : String(y1)
    endYearEl.value = (y2 ?? '') === '' ? '' : String(y2)
    if (scoreEl) scoreEl.value = (sc ?? '') === '' ? '' : String(sc)

    openModal(itemModal)
  }

  async function loadList() {
    listEl.innerHTML = ''
    clearErrors()

    const sel = orgPicker.getSelected()
    const orgId = Number(sel?.raw?.organization_id ?? sel?.id ?? NaN)
    if (!Number.isFinite(orgId)) {
      showErr(orgErr, '请先选择企业/机构。')
      return
    }

    const token = getToken()
    const res = await apiFetch(`/api/admin/org_product?organization_id=${encodeURIComponent(orgId)}`, { token })
    const rows = res?.items ?? []

    if (!rows.length) {
      listEl.innerHTML = `<div class="picker-item"><div class="t">（空）</div><div class="s">该企业暂无企业产品记录</div></div>`
      return
    }

    listEl.innerHTML = rows.map((r) => {
      const t = esc(r.security_product_name || '（未命名产品）')
      const s = [
        r.security_product_slug ? `slug：${esc(r.security_product_slug)}` : null,
        `organization_product_id：${esc(r.organization_product_id)}`,
        r.product_release_year ? `发布：${esc(r.product_release_year)}` : null,
        r.product_end_year ? `终止：${esc(r.product_end_year)}` : null,
      ].filter(Boolean).join(' · ')

      return `
        <div class="picker-item"
          data-op-id="${esc(r.organization_product_id)}"
          data-org-id="${esc(r.organization_id)}"
          data-sp-id="${esc(r.security_product_id)}"
          data-y1="${esc(r.product_release_year ?? '')}"
          data-y2="${esc(r.product_end_year ?? '')}"
          data-score="${esc(r.recommendation_score ?? '')}"
          >
          <div class="t">${t}</div>
          <div class="s">${esc(s)}</div>
        </div>
      `
    }).join('')

    listEl.querySelectorAll('.picker-item').forEach((it) => {
      it.addEventListener('click', () => openEditModalFromRow(it))
    })
  }

  function validateEditYears() {
    clearErrors()
    const now = new Date().getFullYear()

    const r = validateYearRange(releaseYearEl.value, { min: 1990, max: now })
    if (!r.ok) { showErr(releaseYearErr, r.msg); return null }

    const e = validateYearRange(endYearEl.value, { min: 1990, max: now })
    if (!e.ok) { showErr(endYearErr, e.msg); return null }

    const s = validateScore(scoreEl ? scoreEl.value : '')
    if (!s.ok) { showErr(scoreErr, s.msg); return null }

    return { product_release_year: r.value, product_end_year: e.value, recommendation_score: s.value }
  }

  async function submitEdit() {
    if (!editingRow) return

    const patch = validateEditYears()
    if (!patch) return

    const opId = editingRow.organization_product_id
    const newY1 = patch.product_release_year ?? null
    const newY2 = patch.product_end_year ?? null
    const newSc = patch.recommendation_score ?? null

    const oldY1 = editingRow.old_release_year ?? null
    const oldY2 = editingRow.old_end_year ?? null
    const oldSc = editingRow.old_score ?? null

    const previewText = [
      '将提交更新：',
      `organization_product_id：${opId}`,
      `发布年份：${oldY1 ?? '—'}  ->  ${newY1 ?? '—'}`,
      `终止年份：${oldY2 ?? '—'}  ->  ${newY2 ?? '—'}`,
      `评分：${oldSc ?? '—'}  ->  ${newSc ?? '—'}`,
    ].join('\n')
    if (previewEl) previewEl.textContent = previewText

    const token = getToken()
    const action = async () => {
      const res = await apiFetch(`/api/admin/org_product/${encodeURIComponent(opId)}`, { method: 'PATCH', token, body: patch })
      const row = res?.organization_product ?? res

      alert([
        '✅ 更新成功：organization_product',
        `organization_product_id = ${opId}`,
        `product_release_year = ${(row?.product_release_year ?? patch.product_release_year) ?? '—'}`,
        `product_end_year = ${(row?.product_end_year ?? patch.product_end_year) ?? '—'}`,
        `recommendation_score = ${(row?.recommendation_score ?? patch.recommendation_score) ?? '—'}`,
      ].join('\n'))

      closeModal(itemModal)
      await loadList()
    }

    if (typeof showConfirmFlow === 'function') {
      await showConfirmFlow({
        titleLoading: '更新中',
        bodyLoading: '写入更新…',
        action,
      })
    } else {
      await action()
    }
  }

  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true
    try { await loadList() }
    finally { refreshBtn.disabled = false }
  })

  btnOpen.addEventListener('click', () => {
    orgPicker.clear()
    listEl.innerHTML = ''
    clearErrors()
    openModal(modal)
    orgPicker.focus()
  })

  itemResetBtn?.addEventListener('click', () => {
    if (!editingRow) return
    releaseYearEl.value = (editingRow.old_release_year ?? '') === '' ? '' : String(editingRow.old_release_year ?? '')
    endYearEl.value = (editingRow.old_end_year ?? '') === '' ? '' : String(editingRow.old_end_year ?? '')
    if (scoreEl) scoreEl.value = (editingRow.old_score ?? '') === '' ? '' : String(editingRow.old_score ?? '')
    clearErrors()
  })

  itemSubmitBtn?.addEventListener('click', async () => {
    itemSubmitBtn.disabled = true
    itemResetBtn.disabled = true
    try { await submitEdit() }
    finally {
      itemSubmitBtn.disabled = false
      itemResetBtn.disabled = false
    }
  })
}
