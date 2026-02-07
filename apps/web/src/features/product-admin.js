// apps/web/src/features/product-admin.js

/**
 * Product Feature（录入安全产品）
 *
 * UI 约束（按你要求）：
 * - 默认收起：仅显示摘要
 * - 点击 ▾ 展开：出现搜索框 + 3 列 checkbox 网格
 * - 在面板内勾选属于“草稿”，点“确认”后才提交为已选
 * - 点“取消”丢弃草稿
 * - 点 × 清空已选
 *
 * 注意：
 * - 领域列表通过 GET /api/admin/dropdowns/domains 拉取
 * - 显示仅显示领域名称；slug 不显示（但搜索可匹配 slug，如果后端返回）
 */

export function mountProductAdmin(ctx) {
  const {
    API,
    FIELD,
    $, norm,
    openModal, closeModal,
    showConfirm, updateConfirm,
    apiGetJson, apiPostJson,
    getToken,
    setInvalid, clearInvalid,
  } = ctx

  const btnOpen = $('#btnOpenProduct')
  const modal = $('#productModal')
  const btnClose = $('#productClose')
  const btnReset = $('#productReset')
  const btnSubmit = $('#productSubmit')

  const name = $('#productName')
  const nameErr = $('#productNameErr')
  const slug = $('#productSlug')
  const slugErr = $('#productSlugErr')
  const domainsMount = $('#productDomains')
  const domainsErr = $('#productDomainsErr')

  if (!btnOpen || !modal || !btnClose || !btnReset || !btnSubmit || !name || !slug || !domainsMount) {
    console.warn('[product-admin] missing DOM nodes, feature disabled')
    return
  }

  // ===== MultiSelect (3 列 checkbox) =====
  const ms = createCheckboxMultiSelect3Col({
    mountEl: domainsMount,
    title: '安全领域',
    placeholder: '搜索领域…',
    options: [],
    onChangeCommitted: () => {
      if ((ms.getCommittedIds?.() || []).length > 0) {
        clearInvalid(domainsMount, domainsErr)
      }
    },
  })

  async function loadDomainsIfNeeded({ force = false } = {}) {
    if (!force && ms.getAllOptions().length > 0) return
    const token = getToken()
    const res = await apiGetJson(API.listDomains, token)

    // 兼容返回格式：
    // - { domains:[{security_domain_id, security_domain_name, cybersecurity_domain_slug}] }
    // - [{...}] (直接数组)
    const raw = Array.isArray(res) ? res : (res?.domains || res?.data || [])
    const options = (raw || []).map((r) => ({
      id: r.security_domain_id ?? r.domain_id ?? r.id,
      name: r.security_domain_name ?? r.domain_name ?? r.name,
      slug: r.cybersecurity_domain_slug ?? r.domain_slug ?? r.slug ?? '',
    })).filter((x) => x.id != null && norm(x.name))

    ms.setOptions(options)
  }

  function resetForm() {
    name.value = ''
    slug.value = ''
    ms.clear()
    clearInvalid(name, nameErr)
    clearInvalid(slug, slugErr)
    clearInvalid(domainsMount, domainsErr)
  }

  function validate() {
    let ok = true

    if (!norm(name.value)) {
      ok = false
      setInvalid(name, nameErr, '安全产品名称为必填。')
    } else {
      clearInvalid(name, nameErr)
    }

    const s = norm(slug.value)
    if (!s) {
      ok = false
      setInvalid(slug, slugErr, '安全产品 slug 为必填。')
    } else if (!/^[a-z0-9-]+$/.test(s)) {
      ok = false
      setInvalid(slug, slugErr, 'slug 仅允许 a-z / 0-9 / 连字符 -（建议小写）。')
    } else {
      clearInvalid(slug, slugErr)
    }

    const picked = ms.getCommittedIds()
    if (!picked.length) {
      ok = false
      setInvalid(domainsMount, domainsErr, '至少选择 1 个安全领域。')
    } else {
      clearInvalid(domainsMount, domainsErr)
    }

    return ok
  }

  async function submit() {
    if (!validate()) return

    const payload = {
      [FIELD.productName]: norm(name.value),
      [FIELD.productSlug]: norm(slug.value),
      [FIELD.productDomainIds]: ms.getCommittedIds().map((x) => Number(x)),
    }

    showConfirm({ title: '录入中', body: '写入安全产品…', okEnabled: false })
    try {
      const token = getToken()
      const res = await apiPostJson(API.createProduct, payload, token)
      updateConfirm({
        title: '录入成功',
        body: `✅ 安全产品已写入\n${JSON.stringify(res, null, 2)}`,
        okEnabled: true,
        okText: '确定',
      })
      resetForm()
      // 保持弹窗打开，方便连续录入
    } catch (e) {
      updateConfirm({
        title: '录入失败',
        body: `❌ ${e?.message || String(e)}`,
        okEnabled: true,
        okText: '确定',
      })
    }
  }

  btnOpen.addEventListener('click', async () => {
    try {
      await loadDomainsIfNeeded()
    } catch (e) {
      console.error(e)
      showConfirm({
        title: '加载失败',
        body: `❌ 领域列表加载失败：${e?.message || String(e)}`,
        okEnabled: true,
      })
    }
    openModal(modal)
  })

  btnClose.addEventListener('click', () => closeModal(modal))
  btnReset.addEventListener('click', resetForm)
  btnSubmit.addEventListener('click', submit)
}

/**
 * 三列 checkbox MultiSelect：
 * - 用于“产品选择领域”
 * - 只依赖 admin.html 已注入的 CSS（.ia-ms / .ia-ms-*）
 */
function createCheckboxMultiSelect3Col({
  mountEl,
  title = '选择',
  placeholder = '搜索…',
  options = [],
  onChangeCommitted,
}) {
  if (!mountEl) throw new Error('createCheckboxMultiSelect3Col: mountEl missing')

  // committed/draft: Set<string>
  let all = Array.isArray(options) ? options.slice() : []
  let committed = new Set()
  let draft = new Set()
  let isOpen = false
  let query = ''

  // root
  mountEl.innerHTML = ''

  const root = document.createElement('div')
  root.className = 'ia-ms'

  // head
  const head = document.createElement('div')
  head.className = 'ia-ms-head'

  const titleEl = document.createElement('div')
  titleEl.className = 'ia-ms-title'
  titleEl.textContent = title

  const actions = document.createElement('div')
  actions.className = 'ia-ms-actions'

  const btnClear = document.createElement('button')
  btnClear.className = 'ia-ms-iconbtn'
  btnClear.type = 'button'
  btnClear.textContent = '×'
  btnClear.title = '清空'

  const btnArrow = document.createElement('button')
  btnArrow.className = 'ia-ms-iconbtn'
  btnArrow.type = 'button'
  btnArrow.textContent = '▾'
  btnArrow.title = '展开'

  actions.appendChild(btnClear)
  actions.appendChild(btnArrow)

  head.appendChild(titleEl)
  head.appendChild(actions)

  // summary
  const summary = document.createElement('div')
  summary.className = 'ia-ms-summary'
  summary.textContent = '未选择'

  // panel
  const panel = document.createElement('div')
  panel.className = 'ia-ms-panel'
  panel.style.display = 'none'

  const input = document.createElement('input')
  input.className = 'ia-ms-input'
  input.type = 'text'
  input.placeholder = placeholder
  input.autocomplete = 'off'

  const grid = document.createElement('div')
  grid.className = 'ia-ms-grid'

  const foot = document.createElement('div')
  foot.className = 'ia-ms-foot'

  const btnCancel = document.createElement('button')
  btnCancel.className = 'ia-ms-btn'
  btnCancel.type = 'button'
  btnCancel.textContent = '取消'

  const btnConfirm = document.createElement('button')
  btnConfirm.className = 'ia-ms-btn ia-ms-btn-primary'
  btnConfirm.type = 'button'
  btnConfirm.textContent = '确认'

  foot.appendChild(btnCancel)
  foot.appendChild(btnConfirm)

  panel.appendChild(input)
  panel.appendChild(grid)
  panel.appendChild(foot)

  root.appendChild(head)
  root.appendChild(summary)
  root.appendChild(panel)

  mountEl.appendChild(root)

  function setSummary() {
    if (committed.size === 0) {
      summary.textContent = '未选择'
      return
    }
    const map = new Map(all.map(x => [String(x.id), x]))
    const names = [...committed].map((id) => map.get(String(id))?.name).filter(Boolean)
    summary.textContent = names.length ? `已选：${names.join('、')}` : `已选：${committed.size} 项`
  }

  function filterOptions() {
    const q = query.trim().toLowerCase()
    if (!q) return all
    return all.filter((o) => {
      const name = String(o.name || '').toLowerCase()
      const slug = String(o.slug || '').toLowerCase()
      return name.includes(q) || slug.includes(q)
    })
  }

  function render() {
    grid.innerHTML = ''
    const shown = filterOptions()

    if (shown.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'ia-ms-empty'
      empty.textContent = '无匹配结果'
      grid.appendChild(empty)
      return
    }

    for (const opt of shown) {
      const id = String(opt.id)
      const row = document.createElement('label')
      row.className = 'ia-ms-row'
      row.style.width = '100%'
      row.style.display = 'flex'
      row.style.alignItems = 'flex-start'
      row.style.justifyContent = 'flex-start'
      row.style.gap = '8px'
      row.style.cursor = 'pointer'
      row.style.userSelect = 'none'
      row.style.padding = '2px 0'
      row.style.margin = '0'
      row.style.boxSizing = 'border-box'

      const cb = document.createElement('input')
      cb.type = 'checkbox'
      cb.checked = draft.has(id)
      cb.style.margin = '0'
      cb.style.flex = '0 0 auto'

      const text = document.createElement('span')
      text.className = 'ia-ms-label'
      text.textContent = String(opt.name || '')

      cb.addEventListener('change', () => {
        if (cb.checked) draft.add(id)
        else draft.delete(id)
      })

      row.appendChild(cb)
      row.appendChild(text)
      grid.appendChild(row)
    }
  }

  function open() {
    if (isOpen) return
    isOpen = true
    draft = new Set(committed)
    query = ''
    input.value = ''
    panel.style.display = 'block'
    btnArrow.textContent = '▴'
    btnArrow.title = '收起'
    render()
    input.focus()
  }

  function close({ commit = false } = {}) {
    if (!isOpen) return
    if (commit) {
      committed = new Set(draft)
      setSummary()
      if (typeof onChangeCommitted === 'function') {
        try { onChangeCommitted(getCommittedIds()) } catch (_) {}
      }
    } else {
      draft = new Set(committed)
    }
    isOpen = false
    query = ''
    input.value = ''
    panel.style.display = 'none'
    btnArrow.textContent = '▾'
    btnArrow.title = '展开'
  }

  function clear() {
    committed.clear()
    draft.clear()
    setSummary()
    if (typeof onChangeCommitted === 'function') {
      try { onChangeCommitted(getCommittedIds()) } catch (_) {}
    }
    if (isOpen) render()
  }

  function setOptions(next) {
    all = Array.isArray(next) ? next.slice() : []
    // 保留已选：只保留仍存在的 id
    const valid = new Set(all.map(x => String(x.id)))
    committed = new Set([...committed].filter((id) => valid.has(String(id))))
    draft = new Set([...draft].filter((id) => valid.has(String(id))))
    setSummary()
    if (isOpen) render()
  }

  function getAllOptions() {
    return all.slice()
  }

  function getCommittedIds() {
    return [...committed]
  }

  // events
  btnArrow.addEventListener('click', () => (isOpen ? close({ commit: false }) : open()))
  btnClear.addEventListener('click', clear)
  input.addEventListener('input', () => {
    query = input.value
    render()
  })
  btnCancel.addEventListener('click', () => close({ commit: false }))
  btnConfirm.addEventListener('click', () => close({ commit: true }))

  // click outside → 取消并收起
  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) {
      if (isOpen) close({ commit: false })
    }
  })

  // init
  setOptions(all)

  return {
    setOptions,
    clear,
    getAllOptions,
    getCommittedIds,
  }
}
