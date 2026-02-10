// apps/web/src/features/product.js
import { createAliasSwitch } from '../ui/alias-switch.js'
import { createSingleSelectPicker } from '../ui/single-select-picker.js'
import { makeDomainUnionSearch } from '../core/dropdowns.js'

/**
 * 一个“尽量不依赖你旧实现”的简易 domains 多选面板：
 * - 使用 productDomains 容器（#productDomains）
 * - 内部自己渲染：展开/清空/确认、搜索框、结果 checkbox 列表
 * - 搜索接口用 /api/admin/dropdowns/domain_union?q=
 */
function mountDomainMultiSelect({
  rootEl,
  fetchItems,            // async (q)=>{items:[]}
  getId = (it) => it.security_domain_id ?? it.domain_id ?? it.id,
  getLabel = (it) => it.security_domain_name ?? it.domain_name ?? it.name ?? `ID ${getId(it)}`,
  onChangeSummary = null // (confirmedIds, confirmedItems)=>void
}) {
  if (!rootEl) throw new Error('mountDomainMultiSelect: missing rootEl')

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
  summary.textContent = '未选择（点击 ▾ 展开后搜索并勾选，点“确认”生效）'

  const panel = document.createElement('div')
  panel.className = 'ia-ms-panel'

  const searchBox = document.createElement('input')
  searchBox.className = 'input'
  searchBox.type = 'text'
  searchBox.placeholder = '搜索安全领域 name / alias / slug ...'

  const status = document.createElement('div')
  status.className = 'hint'
  status.style.marginTop = '6px'
  status.textContent = '输入关键字开始搜索。'

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
    if (typeof onChangeSummary === 'function') {
      onChangeSummary(Array.from(confirmed.keys()), items)
    }
  }

  function setOpen(v) {
    open = !!v
    // ✅ 关键修复：admin.html 里 .ia-ms-panel 默认 display:none
    // 若这里只写 ''，CSS 仍会把它隐藏；必须显式写成 block
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

      // pending 初始复制 confirmed
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
    // 打开时：pending = confirmed 的快照
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
    // 不强制关 panel
  })

  btnConfirm.addEventListener('click', () => {
    confirmed = new Map(pending)
    refreshSummary()
    setOpen(false)
  })

  // init
  setOpen(false)
  refreshSummary()

  return {
    getConfirmedIds: () => Array.from(confirmed.keys()),
    clear: () => { confirmed = new Map(); pending = new Map(); refreshSummary() },
    focus: () => searchBox.focus(),
  }
}

export function mountProductAdmin(ctx) {
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

  const btnOpen = $('btnOpenProduct')

  const modal = $('productModal')
  const closeBtn = $('productClose')

  const nameEl = $('productName')
  const nameErr = $('productNameErr')

  const isAliasEl = $('productIsAlias')
  const isAliasErr = $('productIsAliasErr')

  const slugRow = $('productSlugRow')
  const slugEl = $('productSlug')
  const slugErr = $('productSlugErr')

  const domainsRow = $('productDomainsRow')
  const domainsRoot = $('productDomains')
  const domainsErr = $('productDomainsErr')

  const descRow = $('productDescRow')
  const descEl = $('productDesc')

  // alias target picker elements
  const aliasTargetRow = $('productAliasTargetRow')
  const pickedEl = $('productAliasTargetPicked')
  const clearBtn = $('productAliasTargetClear')
  const searchInput = $('productAliasTargetSearch')
  const statusEl = $('productAliasTargetStatus')
  const listEl = $('productAliasTargetList')
  const targetErr = $('productAliasTargetErr')

  const resetBtn = $('productReset')
  const submitBtn = $('productSubmit')

  closeBtn.addEventListener('click', () => closeModal(modal))

  function clearAllErrors() {
    clearInvalid(nameEl, nameErr)
    clearInvalid(isAliasEl, isAliasErr)
    clearInvalid(slugEl, slugErr)
    if (domainsErr) {
      domainsErr.textContent = ''
      domainsErr.style.display = 'none'
    }
    if (targetErr) {
      targetErr.textContent = ''
      targetErr.style.display = 'none'
    }
  }

  function showDomainsErr(msg) {
    if (!domainsErr) return
    domainsErr.textContent = msg || ''
    domainsErr.style.display = msg ? '' : 'none'
  }

  // 多选 domains（仅主产品模式使用）
  const domainMulti = mountDomainMultiSelect({
    rootEl: domainsRoot,
    fetchItems: makeDomainUnionSearch({ apiFetch, getToken }),
    getId: (it) => it.security_domain_id ?? it.normalized_id ?? it.domain_id ?? it.id,
    getLabel: (it) => it.security_domain_name ?? it.domain_name ?? it.name ?? '（未命名领域）',
  })

  // 单选：归属产品（别名模式使用）
  const aliasPicker = createSingleSelectPicker({
    pickedEl,
    clearBtn,
    inputEl: searchInput,
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

  const aliasSwitch = createAliasSwitch({
    selectEl: isAliasEl,
    rowsWhenMain: [slugRow, domainsRow, descRow],
    rowsWhenAlias: [aliasTargetRow],
    onModeChange: (mode) => {
      clearAllErrors()
      if (mode === 'yes') {
        slugEl.value = ''
        if (descEl) descEl.value = ''
        domainMulti.clear()
        showDomainsErr('')
      } else {
        aliasPicker.clear()
      }
    }
  })

  function resetForm() {
    nameEl.value = ''
    isAliasEl.value = 'no'
    slugEl.value = ''
    if (descEl) descEl.value = ''
    domainMulti.clear()
    aliasPicker.clear()
    clearAllErrors()
    aliasSwitch.applyMode('no', { emit: false })
  }

  function validate() {
    clearAllErrors()
    let ok = true

    const name = norm(nameEl.value)
    if (!name) {
      setInvalid(nameEl, nameErr, '安全产品名称为必填。')
      ok = false
    }

    const mode = aliasSwitch.getMode()
    if (mode === 'no') {
      const slug = norm(slugEl.value)
      if (!slug) {
        setInvalid(slugEl, slugErr, '安全产品 slug 为必填。')
        ok = false
      } else if (!isSlug(slug)) {
        setInvalid(slugEl, slugErr, 'slug 仅允许 a-z / 0-9 / 连字符 -（建议小写）。')
        ok = false
      }

      const domainIds = domainMulti.getConfirmedIds()
      if (!domainIds.length) {
        showDomainsErr('请至少选择 1 个对应安全领域。')
        ok = false
      }
    } else {
      if (!aliasPicker.validateRequired('请选择“归属安全产品”。')) ok = false
    }

    return ok
  }

  function collectPayload() {
    const name = norm(nameEl.value)
    const mode = aliasSwitch.getMode()
    const desc = norm(descEl?.value)

    if (mode === 'no') {
      const slug = norm(slugEl.value)
      const domainIds = domainMulti.getConfirmedIds()
      return {
        mode: 'main',
        payload: {
          security_product_name: name,
          security_product_slug: slug,
          security_product_description: desc || null,
          domains: domainIds,
        }
      }
    }

    const sel = aliasPicker.getSelected()
    return {
      mode: 'alias',
      payload: {
        security_product_alias_name: name,
        security_product_id: sel?.id,
      }
    }
  }

  resetBtn.addEventListener('click', () => resetForm())

  submitBtn.addEventListener('click', async () => {
    if (!validate()) return

    const token = getToken()
    const { mode, payload } = collectPayload()

    submitBtn.disabled = true
    resetBtn.disabled = true

    await showConfirmFlow({
      titleLoading: mode === 'main' ? '添加中' : '添加别名中',
      bodyLoading: mode === 'main' ? '写入安全产品中…' : '写入安全产品别名中…',
      action: async () => {
        const url = mode === 'main' ? '/api/admin/product' : '/api/admin/product/alias'
        const res = await apiFetch(url, { method: 'POST', token, body: payload })
        closeModal(modal)
        resetForm()
        return `✅ 添加成功：${res?.id ?? res?.security_product_id ?? res?.security_product_alias_id ?? '（未返回）'}`
      }
    })

    submitBtn.disabled = false
    resetBtn.disabled = false
  })

  btnOpen.addEventListener('click', () => {
    resetForm()
    openModal(modal)
    nameEl.focus()
  })
}
