// apps/web/src/features/org-product-edit.js
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

export function mountOrgProductEditAdmin(ctx) {
  const $ = (id) => document.getElementById(id)

  // open/close main modal
  const btnOpen = $('btnOrgProductEditOpen')
  const modal = $('orgProductEditModal')
  const closeBtn = $('orgProductEditClose')

  // organization selector
  const orgPicked = $('orgProductEditOrgPicked')
  const orgClear = $('orgProductEditOrgClear')
  const orgSearch = $('orgProductEditOrgSearch')
  const orgStatus = $('orgProductEditOrgStatus')
  const orgList = $('orgProductEditOrgList')
  const orgErr = $('orgProductEditOrgErr')

  // list area
  const listStatus = $('orgProductEditListStatus')
  const listEl = $('orgProductEditList')

  // edit item modal
  const itemModal = $('orgProductEditItemModal')
  const editModalTitle = $('orgProductEditItemTitle')
  const editModalSubtitle = $('orgProductEditItemSubtitle')
  const previewEl = $('orgProductEditItemPreview')
  const itemCloseBtn = $('orgProductEditItemClose')
  const cancelBtn = $('orgProductEditItemCancel')
  const submitBtn = $('orgProductEditItemSubmit')

  const releaseYearEl = $('orgProductEditItemReleaseYear')
  const releaseYearErr = $('orgProductEditItemReleaseYearErr')
  const endYearEl = $('orgProductEditItemEndYear')
  const endYearErr = $('orgProductEditItemEndYearErr')

  const scoreEl = $('orgProductEditItemScore')
  const scoreErr = $('orgProductEditItemScoreErr')

  if (!btnOpen || !modal || !closeBtn || !orgErr || !listStatus || !listEl || !itemModal || !scoreEl) {
    console.warn('[orgProductEdit] mount skipped: missing required DOM nodes.')
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

  function openModal() { modal.style.display = 'flex' }
  function closeModal() { modal.style.display = 'none' }

  function openItemModal() { itemModal.style.display = 'flex' }
  function closeItemModal() { itemModal.style.display = 'none' }

  let editingRow = null
  let previewArmed = false

  function resetEditModalState() {
    editingRow = null
    previewArmed = false
    if (releaseYearEl) releaseYearEl.value = ''
    if (endYearEl) endYearEl.value = ''
    if (scoreEl) scoreEl.value = ''
    if (previewEl) {
      previewEl.textContent = ''
      previewEl.style.display = 'none'
    }
    showErr(releaseYearErr, '')
    showErr(endYearErr, '')
    showErr(scoreErr, '')
    if (submitBtn) submitBtn.textContent = '确定（预览修改）'
  }

  async function loadOrgProducts(orgId) {
    listStatus.textContent = '加载中...'
    listEl.innerHTML = ''

    const res = await fetch(`/api/admin/org_product?organization_id=${encodeURIComponent(orgId)}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = data?.error || `HTTP ${res.status}`
      throw new Error(msg)
    }

    const rows = Array.isArray(data) ? data : (data?.data || [])
    listStatus.textContent = rows.length ? `共 ${rows.length} 条` : '（空）'
    listEl.innerHTML = renderList(rows)

    // wire edit buttons
    listEl.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const el = btn.closest('.es-item')
        if (!el) return
        openEditModalFromRow(el)
      })
    })
  }

  function renderList(rows) {
    if (!rows || !rows.length) return ''

    return rows.map((r) => {
      const name = r.product?.security_product_name || r.product_name || `product_id:${r.security_product_id}`
      const slug = r.product?.security_product_slug ? `slug:${r.product.security_product_slug}` : ''
      const y1 = r.product_release_year == null ? '' : String(r.product_release_year)
      const y2 = r.product_end_year == null ? '' : String(r.product_end_year)

      return `
        <div class="es-item" data-opid="${esc(r.organization_product_id)}" data-spid="${esc(r.security_product_id)}"
             data-name="${esc(name)}" data-slug="${esc(r.product?.security_product_slug || '')}"
             data-y1="${esc(r.product_release_year ?? '')}" data-y2="${esc(r.product_end_year ?? '')}"
             data-score="${esc(r.recommendation_score ?? '')}">
          <div class="es-title">${esc(name)}</div>
          <div class="es-subtitle">
            ${[slug, `发布：${esc(y1)}`, `终止：${esc(y2)}`, `op_id：${esc(r.organization_product_id)}`].filter(Boolean).join(' · ')}
          </div>
          <div class="es-actions">
            <button class="btn" data-action="edit">编辑</button>
          </div>
        </div>
      `
    }).join('')
  }

  function openEditModalFromRow(el) {
    resetEditModalState()

    const opId = el.dataset?.opid
    const spId = el.dataset?.spid
    const prodName = el.dataset?.name || ''
    const y1 = el.dataset?.y1 ?? ''
    const y2 = el.dataset?.y2 ?? ''
    const sc0 = el.dataset?.score ?? ''

    if (!opId) {
      alert('缺少 organization_product_id')
      return
    }

    const orgSel = orgPicker.getSelected()
    const orgLabel = orgSel?.label || '(未知企业)'

    editingRow = {
      organization_product_id: opId,
      organization_name: orgLabel,
      product_name: prodName,
      old_release_year: y1 === '' ? null : Number(y1),
      old_end_year: y2 === '' ? null : Number(y2),
      old_score: sc0 === '' ? null : Number(sc0),
    }

    editModalTitle.textContent = '编辑企业产品'
    editModalSubtitle.textContent = `${orgLabel} · ${prodName} · op_id:${opId}`

    releaseYearEl.value = (y1 ?? '') === '' ? '' : String(y1)
    endYearEl.value = (y2 ?? '') === '' ? '' : String(y2)
    scoreEl.value = (sc0 ?? '') === '' ? '' : String(sc0)

    openItemModal()
  }

  function validateEditFields() {
    showErr(releaseYearErr, '')
    showErr(endYearErr, '')
    showErr(scoreErr, '')

    const now = new Date().getFullYear()
    const r = validateYearRange(releaseYearEl.value, { min: 1990, max: now })
    if (!r.ok) { showErr(releaseYearErr, r.msg); return null }

    const e = validateYearRange(endYearEl.value, { min: 1990, max: now })
    if (!e.ok) { showErr(endYearErr, e.msg); return null }

    const sc = validateScore(scoreEl.value)
    if (!sc.ok) { showErr(scoreErr, sc.msg); return null }

    return { product_release_year: r.value, product_end_year: e.value, recommendation_score: sc.value }
  }

  btnOpen.addEventListener('click', async () => {
    resetEditModalState()
    orgPicker.clear()
    listStatus.textContent = '请选择企业以加载其企业产品列表。'
    listEl.innerHTML = ''
    openModal()
  })

  closeBtn.addEventListener('click', closeModal)

  // when org changes, load list
  orgSearch.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()

    const sel = orgPicker.getSelected()
    if (!sel?.raw?.organization_id) return
    try {
      await loadOrgProducts(sel.raw.organization_id)
    } catch (err) {
      listStatus.textContent = `加载失败：${err?.message || err}`
    }
  })

  // also when user picks in list (picker sets selection), let them click search button in UI; easiest is:
  orgList.addEventListener('click', async () => {
    const sel = orgPicker.getSelected()
    if (!sel?.raw?.organization_id) return
    try {
      await loadOrgProducts(sel.raw.organization_id)
    } catch (err) {
      listStatus.textContent = `加载失败：${err?.message || err}`
    }
  })

  itemCloseBtn?.addEventListener('click', () => {
    closeItemModal()
    resetEditModalState()
  })
  cancelBtn?.addEventListener('click', () => {
    closeItemModal()
    resetEditModalState()
  })

  submitBtn?.addEventListener('click', async () => {
    if (!editingRow) return

    const patch = validateEditFields()
    if (!patch) return

    const newY1 = patch.product_release_year ?? null
    const newY2 = patch.product_end_year ?? null
    const newSc = patch.recommendation_score ?? null

    const oldY1 = editingRow.old_release_year ?? null
    const oldY2 = editingRow.old_end_year ?? null
    const oldSc = editingRow.old_score ?? null

    if (!previewArmed) {
      // first click: preview
      previewEl.style.display = 'block'
      previewEl.textContent = [
        '预览修改：',
        '',
        `企业：${editingRow.organization_name}`,
        `产品：${editingRow.product_name}`,
        '',
        `发布年份：${oldY1 ?? '—'}  ->  ${newY1 ?? '—'}`,
        `终止年份：${oldY2 ?? '—'}  ->  ${newY2 ?? '—'}`,
        `评分：${oldSc ?? '—'}  ->  ${newSc ?? '—'}`,
        '',
        '请再次点击“再次确定提交”以真正写入数据库。'
      ].join('\n')

      previewArmed = true
      submitBtn.textContent = '再次确定提交'
      return
    }

    // second click: submit
    try {
      submitBtn.disabled = true
      submitBtn.textContent = '提交中...'

      const res = await fetch(`/api/admin/org_product/${encodeURIComponent(editingRow.organization_product_id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = data?.error || `HTTP ${res.status}`
        throw new Error(msg)
      }

      alert('✅ 更新成功')
      closeItemModal()
      resetEditModalState()

      // reload list for current org
      const sel = orgPicker.getSelected()
      if (sel?.raw?.organization_id) {
        await loadOrgProducts(sel.raw.organization_id)
      }
    } catch (err) {
      alert(`❌ 更新失败：${err?.message || err}`)
    } finally {
      submitBtn.disabled = false
      submitBtn.textContent = '确定（预览修改）'
      previewArmed = false
    }
  })
}
