// apps/web/src/features/org-product-edit.js
import { createSingleSelectPicker } from '../ui/single-select-picker.js'

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

export function mountOrgProductEditAdmin(ctx) {
  const { $, openModal, closeModal, apiFetch, getToken, showConfirmFlow } = ctx

  const btnOpen = $('btnOpenOrgProductEdit')
  const modal = $('orgProductEditModal')
  const closeBtn = $('orgProductEditClose')

  const orgErr = $('orgProductEditOrgErr')
  const listStatus = $('orgProductEditListStatus')
  const listEl = $('orgProductEditList')

  const itemModal = $('orgProductEditItemModal')
  const itemClose = $('orgProductEditItemClose')
  const itemCancel = $('orgProductEditItemCancel')
  const itemOrgName = $('orgProductEditItemOrgName')
  const itemProdName = $('orgProductEditItemProdName')

  const releaseYearEl = $('orgProductEditItemReleaseYear')
  const releaseYearErr = $('orgProductEditItemReleaseYearErr')
  const endYearEl = $('orgProductEditItemEndYear')
  const endYearErr = $('orgProductEditItemEndYearErr')

  const previewEl = $('orgProductEditItemPreview')
  const submitBtn = $('orgProductEditItemSubmit')

  if (!btnOpen || !modal || !closeBtn || !orgErr || !listStatus || !listEl || !itemModal) {
    console.warn('[orgProductEdit] mount skipped: missing required DOM nodes.')
    return
  }

  function showErr(el, msg) {
    if (!el) return
    el.textContent = msg || ''
    el.style.display = msg ? '' : 'none'
  }

  function setStatus(msg) {
    listStatus.textContent = msg || ''
  }

  function clearList() {
    listEl.innerHTML = ''
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]))
  }

  closeBtn.addEventListener('click', () => closeModal(modal))
  if (itemClose) itemClose.addEventListener('click', () => closeModal(itemModal))
  if (itemCancel) itemCancel.addEventListener('click', () => closeModal(itemModal))

  // 企业选择器（复用 organization/search）
  const orgPicker = createSingleSelectPicker({
    pickedEl: $('orgProductEditOrgPicked'),
    clearBtn: $('orgProductEditOrgClear'),
    inputEl: $('orgProductEditOrgSearch'),
    statusEl: $('orgProductEditOrgStatus'),
    listEl: $('orgProductEditOrgList'),
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
    onPick: async () => {
      await refreshList()
    },
    onClear: async () => {
      clearList()
      setStatus('请选择企业后查看该企业已录入的产品。')
    }
  })

  async function fetchOrgProducts(organizationId) {
    const token = getToken()
    return await apiFetch(`/api/admin/org_product?organization_id=${encodeURIComponent(organizationId)}`, { token })
  }

  function getSelectedOrgId() {
    const sel = orgPicker.getSelected()
    const orgId = toIntStrict(sel?.raw?.organization_id ?? sel?.id)
    return orgId
  }

  function getSelectedOrgLabel() {
    const sel = orgPicker.getSelected()
    return sel?.label || sel?.raw?.display_name || sel?.raw?.organization_short_name || ''
  }

  async function refreshList() {
    showErr(orgErr, '')
    clearList()

    const orgId = getSelectedOrgId()
    if (orgId === null) {
      setStatus('请选择企业后查看该企业已录入的产品。')
      return
    }

    setStatus('加载中…')

    let res
    try {
      res = await fetchOrgProducts(orgId)
    } catch (e) {
      console.error('[orgProductEdit] list failed:', e)
      setStatus('加载失败。')
      showErr(orgErr, `❌ 失败：${e?.message || String(e)}`)
      return
    }

    const items = res?.items || []
    if (!items.length) {
      setStatus('该企业目前没有已录入的产品。')
      return
    }

    setStatus(`共 ${items.length} 条：`)

    // 渲染列表（右侧编辑/删除）
    listEl.innerHTML = items.map((r) => {
      const name = r.product?.security_product_name || `#${r.security_product_id}`
      const slug = r.product?.security_product_slug ? `slug：${r.product.security_product_slug}` : null
      const y1 = (r.product_release_year ?? '') === '' || r.product_release_year === null ? '—' : r.product_release_year
      const y2 = (r.product_end_year ?? '') === '' || r.product_end_year === null ? '—' : r.product_end_year

      return `
        <div class="es-item" data-opid="${esc(r.organization_product_id)}" data-spid="${esc(r.security_product_id)}"
             data-name="${esc(name)}" data-slug="${esc(r.product?.security_product_slug || '')}"
             data-y1="${esc(r.product_release_year ?? '')}" data-y2="${esc(r.product_end_year ?? '')}">
          <div class="es-title">${esc(name)}</div>
          <div class="es-subtitle">
            ${[slug, `发布：${esc(y1)}`, `终止：${esc(y2)}`, `op_id：${esc(r.organization_product_id)}`].filter(Boolean).join(' · ')}
          </div>
          <div class="modal-actions" style="justify-content:flex-end; margin-top:10px;">
            <button class="btn" data-action="edit" type="button">编辑</button>
            <button class="btn" data-action="delete" type="button">删除</button>
          </div>
        </div>
      `
    }).join('')
  }

  async function doDelete(opId, productName) {
    const token = getToken()
    const action = async () => {
      await apiFetch(`/api/admin/org_product/${encodeURIComponent(opId)}`, { method: 'DELETE', token })
      return `✅ 已删除：${productName}（organization_product_id=${opId}）`
    }

    await showConfirmFlow({
      titleLoading: '删除中',
      bodyLoading: `正在删除：${productName}\norganization_product_id=${opId}\n\n请稍候…`,
      action,
    })

    await refreshList()
  }

  let editingRow = null
  let previewArmed = false

  function resetEditModalState() {
    editingRow = null
    previewArmed = false
    if (previewEl) {
      previewEl.textContent = ''
      previewEl.style.display = 'none'
    }
    showErr(releaseYearErr, '')
    showErr(endYearErr, '')
    if (submitBtn) submitBtn.textContent = '确定（预览修改）'
  }

  function openEditModalFromRow(el) {
    resetEditModalState()

    const opId = toIntStrict(el?.dataset?.opid)
    if (opId === null) {
      alert('❌ 无效的 organization_product_id')
      return
    }

    const orgLabel = getSelectedOrgLabel()
    const prodName = el.dataset?.name || ''
    const y1 = el.dataset?.y1 ?? ''
    const y2 = el.dataset?.y2 ?? ''

    editingRow = {
      organization_product_id: opId,
      organization_name: orgLabel,
      product_name: prodName,
      old_release_year: y1 === '' ? null : Number(y1),
      old_end_year: y2 === '' ? null : Number(y2),
    }

    if (itemOrgName) itemOrgName.textContent = orgLabel
    if (itemProdName) itemProdName.textContent = prodName

    releaseYearEl.value = (y1 ?? '') === '' ? '' : String(y1)
    endYearEl.value = (y2 ?? '') === '' ? '' : String(y2)

    openModal(itemModal)
  }

  function validateEditYears() {
    showErr(releaseYearErr, '')
    showErr(endYearErr, '')

    const now = new Date().getFullYear()
    const r = validateYearRange(releaseYearEl.value, { min: 1990, max: now })
    if (!r.ok) { showErr(releaseYearErr, r.msg); return null }
    const e = validateYearRange(endYearEl.value, { min: 1990, max: now })
    if (!e.ok) { showErr(endYearErr, e.msg); return null }

    return { product_release_year: r.value, product_end_year: e.value }
  }

  async function submitEdit() {
    if (!editingRow) return

    const patch = validateEditYears()
    if (!patch) return

    const token = getToken()

    // 两步确认：第一次预览，第二次提交
    const newY1 = patch.product_release_year ?? null
    const newY2 = patch.product_end_year ?? null

    const oldY1 = editingRow.old_release_year ?? null
    const oldY2 = editingRow.old_end_year ?? null

    const previewText = [
      `企业：${editingRow.organization_name}`,
      `产品：${editingRow.product_name}`,
      '',
      `发布年份：${oldY1 ?? '—'}  ->  ${newY1 ?? '—'}`,
      `终止年份：${oldY2 ?? '—'}  ->  ${newY2 ?? '—'}`,
      '',
      '请再次点击“再次确定提交”以真正写入数据库。'
    ].join('\n')

    if (!previewArmed) {
      previewArmed = true
      if (previewEl) {
        previewEl.textContent = previewText
        previewEl.style.display = ''
      } else {
        alert(previewText)
      }
      if (submitBtn) submitBtn.textContent = '再次确定提交'
      return
    }

    const action = async () => {
      const res = await apiFetch(`/api/admin/org_product/${encodeURIComponent(editingRow.organization_product_id)}`, {
        method: 'PATCH',
        token,
        body: patch
      })
      const row = res?.organization_product ?? res
      return [
        '✅ 更新成功：organization_product',
        `organization_product_id = ${row?.organization_product_id ?? editingRow.organization_product_id}`,
        `product_release_year = ${(row?.product_release_year ?? patch.product_release_year) ?? '—'}`,
        `product_end_year = ${(row?.product_end_year ?? patch.product_end_year) ?? '—'}`,
      ].join('\n')
    }

    await showConfirmFlow({
      titleLoading: '更新中',
      bodyLoading: `正在更新：${editingRow.product_name}\norganization_product_id=${editingRow.organization_product_id}\n\n请稍候…`,
      action,
    })

    closeModal(itemModal)
    await refreshList()
  }

  // 列表点击处理（事件委托）
  listEl.addEventListener('click', async (ev) => {
    const btn = ev.target?.closest?.('button[data-action]')
    if (!btn) return
    const action = btn.dataset.action
    const row = ev.target?.closest?.('.es-item')
    if (!row) return

    const opId = toIntStrict(row.dataset.opid)
    const name = row.dataset.name || `#${row.dataset.spid || ''}`

    if (action === 'delete') {
      if (opId === null) return alert('❌ 无效的 organization_product_id')
      // 二次确认（你要求“告警再次确定是否删除”）
      const ok = window.confirm(`确定要删除该企业产品记录吗？\n\n企业：${getSelectedOrgLabel()}\n产品：${name}\norganization_product_id=${opId}`)
      if (!ok) return
      try {
        await doDelete(opId, name)
      } catch (e) {
        console.error('[orgProductEdit] delete failed:', e)
      }
      return
    }

    if (action === 'edit') {
      openEditModalFromRow(row)
    }
  })

  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      submitBtn.disabled = true
      try {
        await submitEdit()
      } catch (e) {
        console.error('[orgProductEdit] submit failed:', e)
        alert(`❌ 失败：${e?.message || String(e)}`)
      } finally {
        submitBtn.disabled = false
      }
    })
  }

  // 打开入口
  btnOpen.addEventListener('click', async () => {
    showErr(orgErr, '')
    clearList()
    setStatus('请选择企业后查看该企业已录入的产品。')
    orgPicker.clear()
    openModal(modal)
    orgPicker.focus()
  })
}
