// apps/web/src/features/product-edit.js
import { createSingleSelectPicker } from '../ui/single-select-picker.js'
import { makeDomainUnionSearch } from '../core/dropdowns.js'

/**
 * 编辑安全产品（含 alias）
 * - 搜索：product_union（主产品 name/slug + alias_name + 归属产品命中）
 * - 结果：右侧“编辑/删除”
 * - 编辑主产品：name/slug/description + 所属安全领域（多选，预填）
 * - 编辑别名：alias_name + 归属产品（单选）
 */

function mountDomainMultiSelect({
  rootEl,
  fetchItems,
  getId = (it) => it.security_domain_id ?? it.domain_id ?? it.id,
  getLabel = (it) => it.security_domain_name ?? it.domain_name ?? it.name ?? `ID ${getId(it)}`,
} = {}) {
  if (!rootEl) {
    console.warn('[product-edit] mountDomainMultiSelect skipped: missing rootEl')
    return {
      getConfirmedIds: () => [],
      setConfirmedItems: () => {},
      clear: () => {},
      focus: () => {},
    }
  }

  let confirmed = new Map() // id -> item
  let pending = new Map()   // id -> item
  let open = false

  rootEl.innerHTML = ''

  const head = document.createElement('div')
  head.className = 'ia-ms-head'

  const title = document.createElement('div')
  title.className = 'ia-ms-title'
  title.textContent = '已选择安全领域（多选）'

  const actions = document.createElement('div')
  actions.className = 'ia-ms-actions'

  const btnToggle = document.createElement('button')
  btnToggle.type = 'button'
  btnToggle.className = 'ia-ms-iconbtn'
  btnToggle.textContent = '▾'

  const btnClear = document.createElement('button')
  btnClear.type = 'button'
  btnClear.className = 'ia-ms-iconbtn'
  btnClear.textContent = '×'

  actions.appendChild(btnToggle)
  actions.appendChild(btnClear)
  head.appendChild(title)
  head.appendChild(actions)

  const summary = document.createElement('div')
  summary.className = 'ia-ms-summary'

  const panel = document.createElement('div')
  panel.className = 'ia-ms-panel'

  const searchBox = document.createElement('input')
  searchBox.className = 'input'
  searchBox.type = 'text'
  searchBox.placeholder = '搜索安全领域 name / alias / slug ...'

  const status = document.createElement('div')
  status.className = 'hint'
  status.style.marginTop = '6px'

  const list = document.createElement('div')
  list.style.marginTop = '10px'

  const panelActions = document.createElement('div')
  panelActions.className = 'modal-actions'
  panelActions.style.justifyContent = 'flex-start'
  panelActions.style.marginTop = '10px'

  const btnConfirm = document.createElement('button')
  btnConfirm.type = 'button'
  btnConfirm.className = 'btn btn-primary'
  btnConfirm.textContent = '确认'

  panelActions.appendChild(btnConfirm)
  panel.appendChild(searchBox)
  panel.appendChild(status)
  panel.appendChild(list)
  panel.appendChild(panelActions)

  rootEl.appendChild(head)
  rootEl.appendChild(summary)
  rootEl.appendChild(panel)

  function refreshSummary() {
    const items = Array.from(confirmed.values())
    if (!items.length) {
      summary.textContent = '未选择（点击 ▾ 展开后搜索并勾选，点“确认”生效）'
    } else {
      summary.textContent = items.map(it => `• ${getLabel(it)}`).join('\n')
    }
  }

  function setOpen(v) {
    open = !!v
    panel.style.display = open ? 'block' : 'none'
    btnToggle.textContent = open ? '▴' : '▾'
    if (open) searchBox.focus()
  }

  function renderList(items) {
    list.innerHTML = ''
    if (!items.length) {
      const empty = document.createElement('div')
      empty.className = 'hint'
      empty.textContent = '无结果。'
      list.appendChild(empty)
      return
    }

    for (const it of items) {
      const id = getId(it)
      if (id === null || id === undefined) continue

      const row = document.createElement('div')
      row.className = 'es-item'
      row.style.display = 'flex'
      row.style.alignItems = 'flex-start'
      row.style.gap = '10px'

      const cb = document.createElement('input')
      cb.type = 'checkbox'
      cb.style.marginTop = '3px'
      cb.checked = pending.has(id)

      cb.addEventListener('change', () => {
        if (cb.checked) pending.set(id, it)
        else pending.delete(id)
      })

      const info = document.createElement('div')
      info.style.flex = '1 1 auto'

      const t = document.createElement('div')
      t.className = 'es-title'
      t.textContent = getLabel(it)

      const sub = document.createElement('div')
      sub.className = 'es-subtitle'
      sub.textContent = [
        it.cybersecurity_domain_slug ? `slug：${it.cybersecurity_domain_slug}` : null,
        it.security_domain_id ? `ID：${it.security_domain_id}` : null,
      ].filter(Boolean).join(' · ')

      info.appendChild(t)
      if (sub.textContent) info.appendChild(sub)

      row.appendChild(cb)
      row.appendChild(info)
      list.appendChild(row)
    }
  }

  async function doSearch() {
    const q = String(searchBox.value || '').trim()
    if (!q) {
      status.textContent = '输入关键字开始搜索。'
      list.innerHTML = ''
      return
    }
    try {
      status.textContent = '搜索中…'
      const res = await fetchItems(q)
      const items = res?.items || res?.data || []
      status.textContent = `结果：${items.length}`
      renderList(items)
    } catch (e) {
      status.textContent = `搜索失败：${e?.message || String(e)}`
      list.innerHTML = ''
    }
  }

  let t = null
  searchBox.addEventListener('input', () => {
    if (t) clearTimeout(t)
    t = setTimeout(doSearch, 250)
  })

  btnToggle.addEventListener('click', () => {
    if (!open) {
      pending = new Map(confirmed)
      setOpen(true)
    } else {
      setOpen(false)
    }
  })

  btnClear.addEventListener('click', () => {
    confirmed = new Map()
    pending = new Map()
    refreshSummary()
  })

  btnConfirm.addEventListener('click', () => {
    confirmed = new Map(pending)
    refreshSummary()
    setOpen(false)
  })

  function setConfirmedItems(items) {
    const m = new Map()
    for (const it of (items || [])) {
      const id = getId(it)
      if (id === null || id === undefined) continue
      m.set(id, it)
    }
    confirmed = m
    pending = new Map(m)
    refreshSummary()
  }

  // init
  setOpen(false)
  refreshSummary()

  return {
    getConfirmedIds: () => Array.from(confirmed.keys()),
    setConfirmedItems,
    clear: () => { confirmed = new Map(); pending = new Map(); refreshSummary() },
    focus: () => searchBox.focus(),
  }
}

export function mountProductEditAdmin(ctx) {
  const {
    $,
    openModal,
    closeModal,
    setInvalid,
    clearInvalid,
    norm,
    isSlug,
    apiFetch,
    getToken,
    showConfirmFlow,
  } = ctx

  const btnOpen = $('btnOpenProductEdit')
  if (!btnOpen) return

  // ===== Search modal =====
  const searchModal = $('productEditSearchModal')
  const searchClose = $('productEditSearchClose')
  const searchInput = $('productEditSearchInput')
  const searchStatus = $('productEditSearchStatus')
  const searchList = $('productEditSearchList')

  // ===== Main edit modal =====
  const mainModal = $('productEditMainModal')
  const mainClose = $('productEditMainClose')
  const mainCancel = $('productEditMainCancel')
  const mainSubmit = $('productEditMainSubmit')

  const mainName = $('productEditMainName')
  const mainNameErr = $('productEditMainNameErr')
  const mainSlug = $('productEditMainSlug')
  const mainSlugErr = $('productEditMainSlugErr')
  const mainDesc = $('productEditMainDesc')

  const mainDomainsRoot = $('productEditMainDomains')
  const mainDomainsErr = $('productEditMainDomainsErr')

  // ===== Alias edit modal =====
  const aliasModal = $('productEditAliasModal')
  const aliasClose = $('productEditAliasClose')
  const aliasCancel = $('productEditAliasCancel')
  const aliasSubmit = $('productEditAliasSubmit')

  const aliasName = $('productEditAliasName')
  const aliasNameErr = $('productEditAliasNameErr')

  const pickedEl = $('productEditAliasTargetPicked')
  const clearBtn = $('productEditAliasTargetClear')
  const aliasSearchInput = $('productEditAliasTargetSearch')
  const statusEl = $('productEditAliasTargetStatus')
  const listEl = $('productEditAliasTargetList')
  const targetErr = $('productEditAliasTargetErr')

  if (searchClose) searchClose.addEventListener('click', () => closeModal(searchModal))
  if (mainClose) mainClose.addEventListener('click', () => closeModal(mainModal))
  if (mainCancel) mainCancel.addEventListener('click', () => closeModal(mainModal))
  if (aliasClose) aliasClose.addEventListener('click', () => closeModal(aliasModal))
  if (aliasCancel) aliasCancel.addEventListener('click', () => closeModal(aliasModal))

  let editingMainId = null
  let editingAliasId = null

  function clearSearchList() {
    if (searchList) searchList.innerHTML = ''
  }

  function setStatus(msg) {
    if (searchStatus) searchStatus.textContent = msg
  }

  function parseUnionId(id) {
    const s = String(id || '')
    if (s.startsWith('p:')) return { kind: 'product', id: Number(s.slice(2)) }
    if (s.startsWith('a:')) return { kind: 'alias', id: Number(s.slice(2)) }
    return { kind: null, id: NaN }
  }

  function clearMainErrors() {
    clearInvalid(mainName, mainNameErr)
    clearInvalid(mainSlug, mainSlugErr)
    if (mainDomainsErr) {
      mainDomainsErr.textContent = ''
      mainDomainsErr.style.display = 'none'
    }
  }

  function setDomainsErr(msg) {
    if (!mainDomainsErr) return
    mainDomainsErr.textContent = msg || ''
    mainDomainsErr.style.display = msg ? '' : 'none'
  }

  function validateMain() {
    clearMainErrors()
    let ok = true
    const n = norm(mainName.value)
    const s = norm(mainSlug.value)
    if (!n) {
      setInvalid(mainName, mainNameErr, '安全产品名称为必填。')
      ok = false
    }
    if (!s) {
      setInvalid(mainSlug, mainSlugErr, 'slug 为必填。')
      ok = false
    } else if (!isSlug(s)) {
      setInvalid(mainSlug, mainSlugErr, 'slug 仅允许 a-z / 0-9 / 连字符 -（建议小写）。')
      ok = false
    }

    const domainIds = domainMulti.getConfirmedIds()
    if (!domainIds.length) {
      setDomainsErr('请至少选择 1 个对应安全领域。')
      ok = false
    }

    return ok
  }

  function clearAliasErrors() {
    clearInvalid(aliasName, aliasNameErr)
    if (targetErr) {
      targetErr.textContent = ''
      targetErr.style.display = 'none'
    }
  }

  function validateAlias() {
    clearAliasErrors()
    let ok = true
    const n = norm(aliasName.value)
    if (!n) {
      setInvalid(aliasName, aliasNameErr, '安全产品别名为必填。')
      ok = false
    }
    if (!aliasPicker.validateRequired('请选择“归属安全产品”。')) ok = false
    return ok
  }

  // 主产品 domains 多选（支持预填）
  const domainMulti = mountDomainMultiSelect({
    rootEl: mainDomainsRoot,
    fetchItems: makeDomainUnionSearch({ apiFetch, getToken }),
    getId: (it) => it.security_domain_id ?? it.normalized_id ?? it.domain_id ?? it.id,
    getLabel: (it) => it.security_domain_name ?? it.domain_name ?? it.name ?? '（未命名领域）',
  })

  // alias -> 归属产品单选
  const aliasPicker = createSingleSelectPicker({
    pickedEl,
    clearBtn,
    inputEl: aliasSearchInput,
    statusEl,
    listEl,
    errEl: targetErr,
    emptyText: '未选择（请在下方搜索并点击一个安全产品）',
    searchFn: async (q) => {
      const token = getToken()
      return await apiFetch(`/api/admin/dropdowns/products?q=${encodeURIComponent(q)}`, { token })
    },
    renderItem: (it) => ({
      title: it.security_product_name || it.product_name || it.name || '（未命名产品）',
      subtitle: [
        it.security_product_slug ? `slug：${it.security_product_slug}` : null,
        it.security_product_id ? `ID：${it.security_product_id}` : null,
      ].filter(Boolean).join(' · ')
    }),
    getId: (it) => it.security_product_id ?? it.id,
    getLabel: (it, rendered) => rendered?.title ?? String(it.security_product_id ?? it.id ?? ''),
  })

  function renderResultRow(item) {
    const row = document.createElement('div')
    row.className = 'es-item'
    row.style.display = 'flex'
    row.style.alignItems = 'center'
    row.style.justifyContent = 'space-between'
    row.style.gap = '10px'

    const left = document.createElement('div')
    left.style.flex = '1 1 auto'
    left.style.minWidth = '0'

    const title = document.createElement('div')
    title.className = 'es-title'
    title.textContent = item?.name || '（未命名）'

    const sub = document.createElement('div')
    sub.className = 'es-subtitle'

    if (item.kind === 'product') {
      sub.textContent = [
        item.slug ? `slug：${item.slug}` : null,
        item.product_id ? `ID：${item.product_id}` : null
      ].filter(Boolean).join(' · ') || '—'
    } else {
      const { id: aliasId } = parseUnionId(item?.id)
      const targetName = item?.extra?.product_name ? `→ ${item.extra.product_name}` : null
      const targetSlug = item?.extra?.product_slug ? `(${item.extra.product_slug})` : null
      sub.textContent = [
        Number.isFinite(aliasId) ? `aliasId：${aliasId}` : null,
        targetName ? `alias ${targetName}${targetSlug ? ' ' + targetSlug : ''}` : 'alias',
        item.product_id ? `productId：${item.product_id}` : null,
      ].filter(Boolean).join(' · ')
    }

    left.appendChild(title)
    left.appendChild(sub)

    const actions = document.createElement('div')
    actions.style.display = 'flex'
    actions.style.gap = '8px'
    actions.style.flex = '0 0 auto'

    const btnEdit = document.createElement('button')
    btnEdit.className = 'btn'
    btnEdit.type = 'button'
    btnEdit.textContent = '编辑'

    const btnDel = document.createElement('button')
    btnDel.className = 'btn'
    btnDel.type = 'button'
    btnDel.textContent = '删除'

    actions.appendChild(btnEdit)
    actions.appendChild(btnDel)

    row.appendChild(left)
    row.appendChild(actions)

    btnEdit.addEventListener('click', async (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      await handleEdit(item)
    })

    btnDel.addEventListener('click', async (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      await handleDelete(item)
    })

    return row
  }

  async function doSearch(q) {
    const token = getToken()
    const qq = String(q || '').trim()
    if (!qq) {
      clearSearchList()
      setStatus('请输入关键字开始搜索。')
      return
    }

    setStatus('搜索中…')
    clearSearchList()

    try {
      const res = await apiFetch(`/api/admin/dropdowns/product_union?q=${encodeURIComponent(qq)}`, { token })
      const items = res?.items || []
      if (!items.length) {
        setStatus('无结果。')
        return
      }
      setStatus(`共 ${items.length} 条`)
      for (const it of items) {
        const row = renderResultRow(it)
        searchList.appendChild(row)
      }
    } catch (e) {
      setStatus(`搜索失败：${e?.message || String(e)}`)
    }
  }

  let _timer = null
  function onSearchInput() {
    const q = norm(searchInput?.value)
    if (_timer) window.clearTimeout(_timer)
    _timer = window.setTimeout(() => doSearch(q), 250)
  }
  if (searchInput) searchInput.addEventListener('input', onSearchInput)

  async function handleEdit(item) {
    const token = getToken()
    const { kind, id } = parseUnionId(item?.id)
    if (!kind || !Number.isFinite(id)) return

    try {
      if (kind === 'product') {
        const res = await apiFetch(`/api/admin/product/${id}`, { token })
        const p = res?.product || res
        const domainItems = res?.domain_items || []
        editingMainId = p.security_product_id

        mainName.value = p.security_product_name || ''
        mainSlug.value = p.security_product_slug || ''
        if (mainDesc) mainDesc.value = p.security_product_description || ''

        domainMulti.setConfirmedItems(domainItems)
        if (!domainItems.length && Array.isArray(res?.domains)) {
          // fallback：只知道 id 时，先用占位显示
          domainMulti.setConfirmedItems(res.domains.map((x) => ({ security_domain_id: x, security_domain_name: `ID：${x}` })))
        }

        clearMainErrors()
        openModal(mainModal)
        mainName.focus()
        return
      }

      const res = await apiFetch(`/api/admin/product/alias/${id}`, { token })
      const a = res?.alias || res
      editingAliasId = a.security_product_alias_id
      aliasName.value = a.security_product_alias_name || ''
      aliasPicker.clear()
      clearAliasErrors()
      aliasPicker.setSelected({ id: a.security_product_id, label: `ID：${a.security_product_id}` })
      openModal(aliasModal)
      aliasName.focus()
    } catch (e) {
      await showConfirmFlow({
        titleLoading: '失败',
        bodyLoading: '读取失败',
        action: async () => { throw e }
      })
    }
  }

  async function handleDelete(item) {
    const token = getToken()
    const { kind, id } = parseUnionId(item?.id)
    if (!kind || !Number.isFinite(id)) return

    await showConfirmFlow({
      titleLoading: '删除中',
      bodyLoading: '删除记录中…',
      action: async () => {
        const url = kind === 'product'
          ? `/api/admin/product/${id}`
          : `/api/admin/product/alias/${id}`

        const res = await apiFetch(url, { method: 'DELETE', token })
        await doSearch(norm(searchInput?.value))

        if (kind === 'product') {
          const d = res?.deleted || {}
          return `✅ 删除成功：security_product_id=${d.security_product_id} · ${d.security_product_name || ''} · ${d.security_product_slug || ''}`
        }
        const a = res?.deleted || {}
        return `✅ 删除成功：security_product_alias_id=${a.security_product_alias_id} · ${a.security_product_alias_name || ''}`
      }
    })
  }

  async function submitMain() {
    if (!validateMain()) return
    const token = getToken()
    const id = Number(editingMainId)
    if (!Number.isFinite(id)) return

    const payload = {
      security_product_name: norm(mainName.value),
      security_product_slug: norm(mainSlug.value),
      security_product_description: (mainDesc ? norm(mainDesc.value) : '') || null,
      domains: domainMulti.getConfirmedIds(),
    }

    await showConfirmFlow({
      titleLoading: '更新中',
      bodyLoading: '更新安全产品中…',
      action: async () => {
        await apiFetch(`/api/admin/product/${id}`, { method: 'PATCH', token, body: payload })
        closeModal(mainModal)
        await doSearch(norm(searchInput?.value))
        return '✅ 更新成功'
      }
    })
  }

  async function submitAlias() {
    if (!validateAlias()) return
    const token = getToken()
    const aliasId = Number(editingAliasId)
    if (!Number.isFinite(aliasId)) return

    const sel = aliasPicker.getSelected()
    const productId = Number(sel?.id)
    if (!Number.isFinite(productId)) {
      if (targetErr) {
        targetErr.textContent = '请选择“归属安全产品”。'
        targetErr.style.display = 'block'
      }
      return
    }

    const payload = {
      security_product_alias_name: norm(aliasName.value),
      security_product_id: productId,
    }

    await showConfirmFlow({
      titleLoading: '更新中',
      bodyLoading: '更新安全产品别名中…',
      action: async () => {
        await apiFetch(`/api/admin/product/alias/${aliasId}`, { method: 'PATCH', token, body: payload })
        closeModal(aliasModal)
        await doSearch(norm(searchInput?.value))
        return '✅ 更新成功'
      }
    })
  }

  if (mainSubmit) mainSubmit.addEventListener('click', (ev) => {
    ev.preventDefault()
    submitMain()
  })
  if (aliasSubmit) aliasSubmit.addEventListener('click', (ev) => {
    ev.preventDefault()
    submitAlias()
  })

  btnOpen.addEventListener('click', (ev) => {
    ev.preventDefault()
    if (searchInput) searchInput.value = ''
    clearSearchList()
    setStatus('请输入关键字开始搜索。')
    openModal(searchModal)
    searchInput && searchInput.focus()
  })
}
