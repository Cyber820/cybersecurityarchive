// apps/web/src/features/org-product-edit.js
console.log('[orgProductEdit] version = 2026-02-16-orgProductScore-A')

export function mountOrgProductEditAdmin(ctx) {
  const { $, toast, apiFetchJson } = ctx

  const btnOpen = $('orgProductEditOpen')
  const modal = $('orgProductEditModal')
  const closeBtn = $('orgProductEditClose')

  const orgIdEl = $('orgProductEditOrgId')
  const orgErr = $('orgProductEditOrgIdErr')

  const listStatus = $('orgProductEditStatus')
  const listEl = $('orgProductEditList')

  const itemModal = $('orgProductEditItemModal')
  const itemClose = $('orgProductEditItemClose')
  const itemPreview = $('orgProductEditItemPreview')
  const itemSave = $('orgProductEditItemSave')
  const itemDelete = $('orgProductEditItemDelete')

  const releaseYearEl = $('orgProductEditItemReleaseYear')
  const releaseYearErr = $('orgProductEditItemReleaseYearErr')
  const endYearEl = $('orgProductEditItemEndYear')
  const endYearErr = $('orgProductEditItemEndYearErr')
  const scoreEl = $('orgProductEditItemScore')

  if (!btnOpen || !modal || !closeBtn || !orgErr || !listStatus || !listEl || !itemModal || !scoreEl) {
    console.warn('[orgProductEdit] missing DOM nodes, mount skipped.')
    return
  }

  let editingRow = null

  btnOpen.addEventListener('click', () => {
    modal.style.display = 'block'
    listEl.innerHTML = ''
    listStatus.textContent = '请输入 organization_id 后点击“加载”'
  })
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none'
  })

  const btnLoad = $('orgProductEditLoad')
  btnLoad.addEventListener('click', loadOrgProducts)

  itemClose.addEventListener('click', () => {
    itemModal.style.display = 'none'
    editingRow = null
  })

  itemSave.addEventListener('click', submitEdit)
  itemDelete.addEventListener('click', submitDelete)

  // 外部创建后刷新
  window.addEventListener('orgProduct:changed', () => {
    if (modal.style.display === 'block') loadOrgProducts()
  })

  async function loadOrgProducts() {
    const orgId = Number(orgIdEl.value)
    if (!Number.isFinite(orgId) || orgId <= 0) {
      orgErr.textContent = '请输入 organization_id（正整数）'
      return
    }
    orgErr.textContent = ''

    listStatus.textContent = '加载中...'
    listEl.innerHTML = ''

    try {
      const res = await apiFetchJson(`/api/admin/org_product?organization_id=${orgId}`)
      const items = res?.items || []
      if (!items.length) {
        listStatus.textContent = '暂无关联记录'
        return
      }
      listStatus.textContent = `共 ${items.length} 条`
      renderList(items)
    } catch (err) {
      listStatus.textContent = '加载失败'
      toast(String(err?.message || err), { type: 'error' })
    }
  }

  function renderList(items) {
    listEl.innerHTML = items.map((r) => {
      const orgName = String(r.organization_id ?? '')
      const prodName = String(r.product?.security_product_name ?? r.security_product_id ?? '')
      const y1 = r.product_release_year ?? ''
      const y2 = r.product_end_year ?? ''
      const score = r.recommendation_score ?? ''
      return `
        <div class="op-row"
          data-id="${esc(r.organization_product_id)}"
          data-org="${esc(orgName)}"
          data-prod="${esc(prodName)}"
          data-y1="${esc(y1)}" data-y2="${esc(y2)}" data-score="${esc(score)}">
          <div class="op-title">${esc(prodName)}</div>
          <div class="op-sub">release=${esc(y1)} end=${esc(y2)}</div>
          <button class="btn op-edit" data-action="edit">编辑</button>
        </div>
      `
    }).join('')

    listEl.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const rowEl = e.target.closest('.op-row')
        openEditItemModalFromRowEl(rowEl)
      })
    })
  }

  function openEditItemModalFromRowEl(el) {
    if (!el) return

    const id = Number(el.dataset?.id)
    const orgName = el.dataset?.org ?? ''
    const prodName = el.dataset?.prod ?? ''

    const y1 = el.dataset?.y1 ?? ''
    const y2 = el.dataset?.y2 ?? ''
    const s0 = el.dataset?.score ?? ''

    editingRow = {
      organization_product_id: id,
      organization_id: Number(orgIdEl.value),
      product_name: prodName,
      old_release_year: y1 === '' ? null : Number(y1),
      old_end_year: y2 === '' ? null : Number(y2),
      old_score: s0 === '' ? null : Number(s0),
    }

    releaseYearEl.value = (y1 ?? '') === '' ? '' : String(y1)
    endYearEl.value = (y2 ?? '') === '' ? '' : String(y2)
    scoreEl.value = (s0 ?? '') === '' ? '' : String(s0)

    releaseYearErr.textContent = ''
    endYearErr.textContent = ''

    itemPreview.textContent = `企业=${orgName}\n产品=${prodName}\nrelease=${y1 || '(空)'}\nend=${y2 || '(空)'}`
    itemModal.style.display = 'block'
  }

  async function submitEdit() {
    if (!editingRow) return

    const patch = validateEditYears(releaseYearEl.value, endYearEl.value)
    if (!patch) return

    // 如果用户只改了评分，也要允许提交；如果完全没变化，就提示
    const oldY1 = editingRow.old_release_year ?? null
    const oldY2 = editingRow.old_end_year ?? null
    const oldS = editingRow.old_score ?? null

    const newY1 = patch.product_release_year ?? null
    const newY2 = patch.product_end_year ?? null
    const newS = patch.recommendation_score ?? null

    if (oldY1 === newY1 && oldY2 === newY2 && oldS === newS) {
      toast('没有任何修改', { type: 'info' })
      return
    }

    itemSave.disabled = true
    itemDelete.disabled = true

    try {
      await apiFetchJson(`/api/admin/org_product/${editingRow.organization_product_id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })

      toast('已更新')
      itemModal.style.display = 'none'
      editingRow = null
      await loadOrgProducts()
    } catch (err) {
      toast(String(err?.message || err), { type: 'error' })
    } finally {
      itemSave.disabled = false
      itemDelete.disabled = false
    }
  }

  async function submitDelete() {
    if (!editingRow) return
    const ok = window.confirm('确定删除这条企业产品关联吗？')
    if (!ok) return

    itemSave.disabled = true
    itemDelete.disabled = true

    try {
      await apiFetchJson(`/api/admin/org_product/${editingRow.organization_product_id}`, {
        method: 'DELETE',
      })

      toast('已删除')
      itemModal.style.display = 'none'
      editingRow = null
      await loadOrgProducts()
    } catch (err) {
      toast(String(err?.message || err), { type: 'error' })
    } finally {
      itemSave.disabled = false
      itemDelete.disabled = false
    }
  }

  function validateEditYears(releaseYearRaw, endYearRaw) {
    releaseYearErr.textContent = ''
    endYearErr.textContent = ''

    const now = new Date().getFullYear()

    const r = validateYearRange(releaseYearRaw, { min: 1990, max: now })
    if (!r.ok) {
      releaseYearErr.textContent = r.msg
      return null
    }

    const e = validateYearRange(endYearRaw, { min: 1990, max: now })
    if (!e.ok) {
      endYearErr.textContent = e.msg
      return null
    }

    const s = validateScore(scoreEl.value)
    if (s === '__invalid__') {
      toast('评分必须是 1-10 的整数（或留空）', { type: 'error' })
      return null
    }

    return { product_release_year: r.value, product_end_year: e.value, recommendation_score: s }
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

function esc(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
