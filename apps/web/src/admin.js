// apps/web/src/admin.js

/**
 * 说明（关键点）：
 * - 不再使用“await openConfirm()”这种会卡死的写法。
 * - showConfirm() 只是展示；updateConfirm() 更新状态；用户点按钮才关闭。
 * - 领域/产品/企业：各自独立提交。
 * - 产品选择领域：三列 checkbox + 搜索 + “确认才生效” + 清空。
 */

const TOKEN_KEY = 'ia_admin_token_v1'

// ========== API 路径（如果你后端不一样，只改这里） ==========
const API = {
  createOrganization: '/api/admin/organization',
  createDomain: '/api/admin/domain',
  createProduct: '/api/admin/product',
  // dropdowns：用于产品弹窗拉取领域列表
  listDomains: '/api/admin/dropdowns/domains',
}

// ========== 字段映射（如果你后端 req.body 期待的字段名不同，只改这里） ==========
const FIELD = {
  // domain
  domainName: 'security_domain_name',
  domainSlug: 'cybersecurity_domain_slug', // 你之前 ERD 里是 cybersecurity_domain_slug

  // product
  productName: 'security_product_name',
  productSlug: 'security_product_slug',

  // 关联：产品-领域
  // 我这里默认后端 product route 接收 { domain_ids: [1,2,3] }
  // 如果你后端接收 { security_domain_ids: [...] } 或 { domains:[...] }，改这个键名即可
  productDomainIds: 'domain_ids',
}

// ========== DOM helpers ==========
function $(sel) { return document.querySelector(sel) }
function norm(v) { return (v ?? '').toString().trim() }

function setInvalid(inputEl, errEl, msg) {
  if (inputEl) inputEl.setAttribute('aria-invalid', 'true')
  if (errEl) {
    errEl.textContent = msg
    errEl.style.display = 'block'
  }
}
function clearInvalid(inputEl, errEl) {
  if (inputEl) inputEl.removeAttribute('aria-invalid')
  if (errEl) {
    errEl.textContent = ''
    errEl.style.display = 'none'
  }
}

// slug：a-z0-9-
function isValidSlug(slug) {
  return /^[a-z0-9-]+$/.test(slug)
}

// establish_year: 1990 ~ this year
function validateEstablishYear(v) {
  const s = norm(v)
  if (!s) return { value: null }
  if (!/^\d{4}$/.test(s)) return { error: '成立时间必须是 4 位数字（YYYY）。' }
  const n = Number(s)
  const nowYear = new Date().getFullYear()
  if (n < 1990 || n > nowYear) return { error: `成立时间范围：1990 ~ ${nowYear}` }
  return { value: n }
}

// ========== modal open/close ==========
function openModal(modalEl) {
  if (!modalEl) return
  modalEl.style.display = 'flex'
  modalEl.setAttribute('aria-hidden', 'false')
}
function closeModal(modalEl) {
  if (!modalEl) return
  modalEl.style.display = 'none'
  modalEl.setAttribute('aria-hidden', 'true')
}

// ========== token ==========
const tokenInput = $('#tokenInput')
if (tokenInput) {
  tokenInput.value = localStorage.getItem(TOKEN_KEY) || ''
  tokenInput.addEventListener('input', () => {
    localStorage.setItem(TOKEN_KEY, tokenInput.value)
  })
}
function getToken() {
  return tokenInput ? norm(tokenInput.value) : ''
}

// ========== confirm ==========
const confirmOverlay = $('#confirmOverlay')
const confirmTitle = $('#confirmTitle')
const confirmBody = $('#confirmBody')
const confirmOk = $('#confirmOk')

function showConfirm({ title, body, okText = '确定', okEnabled = false } = {}) {
  if (!confirmOverlay) return
  confirmTitle.textContent = title || ''
  confirmBody.textContent = body || ''
  confirmOk.textContent = okText
  confirmOk.disabled = !okEnabled
  openModal(confirmOverlay)
}
function updateConfirm({ title, body, okText, okEnabled } = {}) {
  if (!confirmOverlay) return
  if (title != null) confirmTitle.textContent = title
  if (body != null) confirmBody.textContent = body
  if (okText != null) confirmOk.textContent = okText
  if (okEnabled != null) confirmOk.disabled = !okEnabled
}
function hideConfirm() {
  if (!confirmOverlay) return
  closeModal(confirmOverlay)
}

if (confirmOk) {
  confirmOk.addEventListener('click', () => {
    if (!confirmOk.disabled) hideConfirm()
  })
}

// ========== API helper ==========
async function apiGetJson(url, token) {
  const headers = {}
  if (token) headers['x-admin-token'] = token
  const res = await fetch(url, { method: 'GET', headers })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch (_) {}
  if (!res.ok) throw new Error(json?.error || json?.message || text || `HTTP ${res.status}`)
  return json
}

async function apiPostJson(url, payload, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['x-admin-token'] = token
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch (_) {}
  if (!res.ok) throw new Error(json?.error || json?.message || text || `HTTP ${res.status}`)
  return json
}

// ========== MultiSelect (3列checkbox + 搜索 + 确认才生效 + 清空) ==========
function createCheckboxMultiSelect3Col({
  mountEl,
  title = '选择',
  placeholder = '搜索…',
  // options: [{ id, name, slug }]
  options = [],
  // 搜索同时匹配 name 和 slug，但显示只显示 name
  onChangeCommitted,
}) {
  if (!mountEl) throw new Error('createCheckboxMultiSelect3Col: mountEl missing')

  // committed/draft 存 string id
  let all = Array.isArray(options) ? options.slice() : []
  let committed = new Set()
  let draft = new Set()
  let isOpen = false
  let query = ''

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

  const summary = document.createElement('div')
  summary.className = 'ia-ms-summary'
  summary.textContent = '未选择'

  // panel
  const panel = document.createElement('div')
  panel.className = 'ia-ms-panel'

  const panelHead = document.createElement('div')
  panelHead.className = 'ia-ms-panel-head'

  const search = document.createElement('input')
  search.className = 'input ia-ms-search'
  search.type = 'text'
  search.placeholder = placeholder
  search.autocomplete = 'off'

  const count = document.createElement('div')
  count.className = 'ia-ms-count'
  count.textContent = '共 0 项'

  panelHead.appendChild(search)
  panelHead.appendChild(count)

  const grid = document.createElement('div')
  grid.className = 'ia-ms-grid'

  const foot = document.createElement('div')
  foot.className = 'ia-ms-foot'

  const btnCancel = document.createElement('button')
  btnCancel.className = 'btn'
  btnCancel.type = 'button'
  btnCancel.textContent = '取消'

  const btnConfirm = document.createElement('button')
  btnConfirm.className = 'btn btn-primary'
  btnConfirm.type = 'button'
  btnConfirm.textContent = '确认'

  foot.appendChild(btnCancel)
  foot.appendChild(btnConfirm)

  panel.appendChild(panelHead)
  panel.appendChild(grid)
  panel.appendChild(foot)

  // mount
  mountEl.innerHTML = ''
  mountEl.appendChild(head)
  mountEl.appendChild(summary)
  mountEl.appendChild(panel)

  function setSummary() {
    if (committed.size === 0) {
      summary.textContent = '未选择'
      return
    }
    const names = all
      .filter(x => committed.has(String(x.id)))
      .map(x => x.name)
      .filter(Boolean)
    summary.textContent = names.length ? `已选：${names.join('、')}` : `已选：${committed.size} 项`
  }

  function filteredOptions() {
    const q = norm(query).toLowerCase()
    if (!q) return all
    return all.filter(o => {
      const n = (o.name ?? '').toString().toLowerCase()
      const s = (o.slug ?? '').toString().toLowerCase()
      return n.includes(q) || s.includes(q)
    })
  }

  function renderGrid() {
    grid.innerHTML = ''

    const shown = filteredOptions()
    count.textContent = `共 ${shown.length} 项`

    if (shown.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'hint'
      empty.textContent = '无匹配结果'
      empty.style.gridColumn = '1 / -1'
      grid.appendChild(empty)
      return
    }

    for (const o of shown) {
      const id = String(o.id)
      const row = document.createElement('label')
      row.className = 'ia-ms-row'

      const cb = document.createElement('input')
      cb.type = 'checkbox'
      cb.checked = draft.has(id)
      cb.addEventListener('change', () => {
        if (cb.checked) draft.add(id)
        else draft.delete(id)
      })

      const text = document.createElement('span')
      text.className = 'ia-ms-label'
      // ✅ 只显示 name，不显示 slug
      text.textContent = o.name ?? id

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
    search.value = ''
    panel.style.display = 'block'
    btnArrow.textContent = '▴'
    btnArrow.title = '收起'
    renderGrid()
    search.focus()
  }

  function close({ commit = false } = {}) {
    if (!isOpen) return
    if (commit) {
      committed = new Set(draft)
      setSummary()
      if (typeof onChangeCommitted === 'function') onChangeCommitted(getCommittedIds())
    } else {
      draft = new Set(committed)
    }
    isOpen = false
    panel.style.display = 'none'
    btnArrow.textContent = '▾'
    btnArrow.title = '展开'
  }

  function clear() {
    committed.clear()
    draft.clear()
    query = ''
    search.value = ''
    setSummary()
    if (isOpen) renderGrid()
    if (typeof onChangeCommitted === 'function') onChangeCommitted(getCommittedIds())
  }

  function setOptions(next) {
    all = Array.isArray(next) ? next.slice() : []
    // 保留 committed 中仍存在的 id
    const exist = new Set(all.map(x => String(x.id)))
    committed = new Set(Array.from(committed).filter(id => exist.has(id)))
    draft = new Set(committed)
    setSummary()
    if (isOpen) renderGrid()
  }

  function getCommittedIds() {
    return Array.from(committed.values())
  }

  // events
  btnArrow.addEventListener('click', () => {
    if (isOpen) close({ commit: false })
    else open()
  })
  btnClear.addEventListener('click', () => clear())
  btnCancel.addEventListener('click', () => close({ commit: false }))
  btnConfirm.addEventListener('click', () => close({ commit: true }))
  search.addEventListener('input', () => {
    query = search.value
    renderGrid()
  })

  // init
  setOptions(all)

  return {
    open,
    close,
    clear,
    setOptions,
    getCommittedIds,
  }
}

// ========== Buttons: open modals ==========
const btnOpenOrg = $('#btnOpenOrg')
const btnOpenDomain = $('#btnOpenDomain')
const btnOpenProduct = $('#btnOpenProduct')
const btnOpenOrgProduct = $('#btnOpenOrgProduct')

const orgModal = $('#orgModal')
const domainModal = $('#domainModal')
const productModal = $('#productModal')

if (btnOpenOrg) btnOpenOrg.addEventListener('click', () => openModal(orgModal))
if (btnOpenDomain) btnOpenDomain.addEventListener('click', () => openModal(domainModal))
if (btnOpenProduct) btnOpenProduct.addEventListener('click', async () => {
  openModal(productModal)
  // 打开产品弹窗时，确保 domains 列表已加载
  await ensureDomainsLoaded()
})
if (btnOpenOrgProduct) btnOpenOrgProduct.addEventListener('click', () => {
  // 你还没做企业产品弹窗，这里先提示，不影响其它功能
  alert('“录入企业产品”窗口尚未实现（下一步做）。')
})

// 点击遮罩关闭（避免 aria-hidden focus 报错，不在关闭前乱改 aria-hidden）
for (const m of [orgModal, domainModal, productModal]) {
  if (!m) continue
  m.addEventListener('click', (e) => { if (e.target === m) closeModal(m) })
}

// ========== Organization modal ==========
const orgClose = $('#orgClose')
const orgReset = $('#orgReset')
const orgSubmit = $('#orgSubmit')

const orgShortName = $('#orgShortName')
const orgFullName = $('#orgFullName')
const orgEstablishYear = $('#orgEstablishYear')
const orgSlug = $('#orgSlug')

const orgShortNameErr = $('#orgShortNameErr')
const orgEstablishYearErr = $('#orgEstablishYearErr')
const orgSlugErr = $('#orgSlugErr')

if (orgClose) orgClose.addEventListener('click', () => closeModal(orgModal))

function resetOrgForm() {
  if (orgShortName) orgShortName.value = ''
  if (orgFullName) orgFullName.value = ''
  if (orgEstablishYear) orgEstablishYear.value = ''
  if (orgSlug) orgSlug.value = ''
  clearInvalid(orgShortName, orgShortNameErr)
  clearInvalid(orgEstablishYear, orgEstablishYearErr)
  clearInvalid(orgSlug, orgSlugErr)
  orgShortName?.focus()
}
if (orgReset) orgReset.addEventListener('click', resetOrgForm)

function validateOrgForm() {
  let ok = true

  if (!norm(orgShortName?.value)) {
    setInvalid(orgShortName, orgShortNameErr, '企业简称为必填。')
    ok = false
  } else clearInvalid(orgShortName, orgShortNameErr)

  const slug = norm(orgSlug?.value)
  if (!slug) {
    setInvalid(orgSlug, orgSlugErr, 'slug 为必填。')
    ok = false
  } else if (!isValidSlug(slug)) {
    setInvalid(orgSlug, orgSlugErr, 'slug 仅允许 a-z / 0-9 / 连字符 -（建议小写）。')
    ok = false
  } else clearInvalid(orgSlug, orgSlugErr)

  const yr = validateEstablishYear(orgEstablishYear?.value)
  if (yr.error) {
    setInvalid(orgEstablishYear, orgEstablishYearErr, yr.error)
    ok = false
  } else clearInvalid(orgEstablishYear, orgEstablishYearErr)

  return ok
}

if (orgSubmit) {
  orgSubmit.addEventListener('click', async () => {
    if (!validateOrgForm()) return

    const yr = validateEstablishYear(orgEstablishYear?.value)
    const payload = {
      organization_short_name: norm(orgShortName?.value),
      organization_full_name: norm(orgFullName?.value) || null,
      establish_year: yr.value,
      organization_slug: norm(orgSlug?.value),
    }

    showConfirm({ title: '录入中', body: '写入中…请稍候', okEnabled: false })

    try {
      const res = await apiPostJson(API.createOrganization, payload, getToken())
      updateConfirm({
        title: '录入成功',
        body: `✅ 已写入 organization\n\n${JSON.stringify(res ?? {}, null, 2)}`,
        okText: '确认返回',
        okEnabled: true,
      })
      // 成功后：不自动关闭企业弹窗，允许你继续录入；你点确认后自己回到弹窗即可
      resetOrgForm()
    } catch (e) {
      updateConfirm({
        title: '录入失败',
        body: `❌ ${e?.message || String(e)}`,
        okText: '确认返回',
        okEnabled: true,
      })
    }
  })
}

// ========== Domain modal ==========
const domainClose = $('#domainClose')
const domainReset = $('#domainReset')
const domainSubmit = $('#domainSubmit')

const domainName = $('#domainName')
const domainSlug = $('#domainSlug')
const domainNameErr = $('#domainNameErr')
const domainSlugErr = $('#domainSlugErr')

if (domainClose) domainClose.addEventListener('click', () => closeModal(domainModal))

function resetDomainForm() {
  if (domainName) domainName.value = ''
  if (domainSlug) domainSlug.value = ''
  clearInvalid(domainName, domainNameErr)
  clearInvalid(domainSlug, domainSlugErr)
  domainName?.focus()
}
if (domainReset) domainReset.addEventListener('click', resetDomainForm)

function validateDomainForm() {
  let ok = true
  if (!norm(domainName?.value)) {
    setInvalid(domainName, domainNameErr, '安全领域名称为必填。')
    ok = false
  } else clearInvalid(domainName, domainNameErr)

  const slug = norm(domainSlug?.value)
  if (!slug) {
    setInvalid(domainSlug, domainSlugErr, '安全领域 slug 为必填。')
    ok = false
  } else if (!isValidSlug(slug)) {
    setInvalid(domainSlug, domainSlugErr, 'slug 仅允许 a-z / 0-9 / 连字符 -（建议小写）。')
    ok = false
  } else clearInvalid(domainSlug, domainSlugErr)

  return ok
}

if (domainSubmit) {
  domainSubmit.addEventListener('click', async () => {
    if (!validateDomainForm()) return

    const payload = {
      [FIELD.domainName]: norm(domainName?.value),
      [FIELD.domainSlug]: norm(domainSlug?.value),
    }

    showConfirm({ title: '录入中', body: '写入安全领域中…请稍候', okEnabled: false })

    try {
      const res = await apiPostJson(API.createDomain, payload, getToken())
      updateConfirm({
        title: '录入成功',
        body: `✅ 已写入 cybersecurity_domain\n\n${JSON.stringify(res ?? {}, null, 2)}`,
        okText: '确认返回',
        okEnabled: true,
      })
      resetDomainForm()

      // 新增领域后：刷新产品弹窗的领域候选
      await refreshDomains()
    } catch (e) {
      updateConfirm({
        title: '录入失败',
        body: `❌ ${e?.message || String(e)}`,
        okText: '确认返回',
        okEnabled: true,
      })
    }
  })
}

// ========== Product modal ==========
const productClose = $('#productClose')
const productReset = $('#productReset')
const productSubmit = $('#productSubmit')

const productName = $('#productName')
const productSlug = $('#productSlug')
const productNameErr = $('#productNameErr')
const productSlugErr = $('#productSlugErr')
const productDomainsErr = $('#productDomainsErr')

if (productClose) productClose.addEventListener('click', () => closeModal(productModal))

function resetProductForm() {
  if (productName) productName.value = ''
  if (productSlug) productSlug.value = ''
  clearInvalid(productName, productNameErr)
  clearInvalid(productSlug, productSlugErr)
  clearInvalid(null, productDomainsErr)
  if (msDomains) msDomains.clear()
  productName?.focus()
}
if (productReset) productReset.addEventListener('click', resetProductForm)

function validateProductForm() {
  let ok = true

  if (!norm(productName?.value)) {
    setInvalid(productName, productNameErr, '安全产品名称为必填。')
    ok = false
  } else clearInvalid(productName, productNameErr)

  const slug = norm(productSlug?.value)
  if (!slug) {
    setInvalid(productSlug, productSlugErr, '安全产品 slug 为必填。')
    ok = false
  } else if (!isValidSlug(slug)) {
    setInvalid(productSlug, productSlugErr, 'slug 仅允许 a-z / 0-9 / 连字符 -（建议小写）。')
    ok = false
  } else clearInvalid(productSlug, productSlugErr)

  const ids = msDomains ? msDomains.getCommittedIds() : []
  if (!ids.length) {
    setInvalid(null, productDomainsErr, '必须至少选择 1 个对应安全领域。')
    ok = false
  } else {
    clearInvalid(null, productDomainsErr)
  }

  return ok
}

// ===== domains dropdowns cache + multiselect instance =====
let __domainsLoaded = false
let __domainOptions = [] // [{id,name,slug}]
let msDomains = null

async function refreshDomains() {
  // 期望后端返回：{ domains: [{security_domain_id, security_domain_name, cybersecurity_domain_slug}] }
  // 或者直接数组；两种都兼容
  const json = await apiGetJson(API.listDomains, getToken())

  const raw = Array.isArray(json) ? json : (json?.domains || json?.data || [])
  const options = (raw || []).map(x => ({
    id: x.security_domain_id ?? x.id,
    name: x.security_domain_name ?? x.name,
    slug: x.cybersecurity_domain_slug ?? x.slug,
  })).filter(x => x.id != null && norm(x.name))

  __domainOptions = options
  __domainsLoaded = true

  if (msDomains) msDomains.setOptions(__domainOptions)
}

async function ensureDomainsLoaded() {
  if (!msDomains) {
    const mount = $('#productDomains')
    msDomains = createCheckboxMultiSelect3Col({
      mountEl: mount,
      title: '安全领域',
      placeholder: '搜索领域名称（也支持输入 slug 搜索，但不显示 slug）…',
      options: __domainOptions,
    })
  }
  if (!__domainsLoaded) {
    try {
      await refreshDomains()
    } catch (e) {
      // 不直接弹 confirm，避免打断；把错误显示在 err 区
      setInvalid(null, productDomainsErr, `领域候选加载失败：${e?.message || String(e)}`)
    }
  }
}

if (productSubmit) {
  productSubmit.addEventListener('click', async () => {
    await ensureDomainsLoaded()
    if (!validateProductForm()) return

    const domainIds = msDomains.getCommittedIds().map(x => Number(x)).filter(Number.isFinite)

    const payload = {
      [FIELD.productName]: norm(productName?.value),
      [FIELD.productSlug]: norm(productSlug?.value),
      [FIELD.productDomainIds]: domainIds,
    }

    showConfirm({ title: '录入中', body: '写入安全产品中…请稍候', okEnabled: false })

    try {
      const res = await apiPostJson(API.createProduct, payload, getToken())
      updateConfirm({
        title: '录入成功',
        body: `✅ 已写入 cybersecurity_product（并绑定领域）\n\n${JSON.stringify(res ?? {}, null, 2)}`,
        okText: '确认返回',
        okEnabled: true,
      })
      resetProductForm()
    } catch (e) {
      updateConfirm({
        title: '录入失败',
        body: `❌ ${e?.message || String(e)}`,
        okText: '确认返回',
        okEnabled: true,
      })
    }
  })
}
