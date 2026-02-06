// apps/web/src/admin.js
// Admin page controller (modals + write actions + multi-select)
//
// 依赖：apps/web/admin.html 中的 DOM 结构（id 全匹配）
// 后端：
// - POST /api/admin/domain
// - POST /api/admin/product   body: {security_product_name, security_product_slug, domains:[domainId...]}
// - POST /api/admin/organization
// - GET  /api/admin/dropdowns/domains -> { items:[{id,name,slug}], ... }

const LS_TOKEN_KEY = 'ia_admin_token'

// =========================
// Helpers: DOM / text
// =========================
function $(sel) {
  return document.querySelector(sel)
}
function norm(v) {
  return (v ?? '').toString().trim()
}
function isValidSlug(s) {
  return /^[a-z0-9-]+$/.test(norm(s))
}
function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

// =========================
// API endpoints
// =========================
const API = {
  createDomain: '/api/admin/domain',
  createProduct: '/api/admin/product',
  createOrganization: '/api/admin/organization',
  dropdownDomains: '/api/admin/dropdowns/domains',
}

// 注意：你当前后端用的是 token header（requireAdmin）
// 这里统一用 x-admin-token（如果你后端用别的 header，把这里改成一致即可）
async function apiPostJson(url, body, token) {
  const headers = { 'content-type': 'application/json' }
  if (token) headers['x-admin-token'] = token

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
  })

  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch (_) {
    data = { raw: text }
  }

  if (!res.ok) {
    const msg = data?.error || data?.message || `${res.status} ${res.statusText}`
    throw new Error(msg)
  }
  return data
}

async function apiGetJson(url, token) {
  const headers = {}
  if (token) headers['x-admin-token'] = token

  const res = await fetch(url, { method: 'GET', headers })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch (_) {
    data = { raw: text }
  }

  if (!res.ok) {
    const msg = data?.error || data?.message || `${res.status} ${res.statusText}`
    throw new Error(msg)
  }
  return data
}

// =========================
// Token cache
// =========================
function getToken() {
  const input = $('#tokenInput')
  const v = norm(input?.value)
  return v || norm(localStorage.getItem(LS_TOKEN_KEY))
}
function setToken(v) {
  const x = norm(v)
  if (!x) {
    localStorage.removeItem(LS_TOKEN_KEY)
    return
  }
  localStorage.setItem(LS_TOKEN_KEY, x)
}

// init token input
{
  const tokenInput = $('#tokenInput')
  if (tokenInput) {
    tokenInput.value = norm(localStorage.getItem(LS_TOKEN_KEY))
    tokenInput.addEventListener('input', () => setToken(tokenInput.value))
  }
}

// =========================
// Validate UI helpers
// =========================
function setInvalid(inputEl, errEl, message) {
  if (inputEl) inputEl.setAttribute('aria-invalid', 'true')
  if (errEl) {
    errEl.textContent = message || ''
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
function validateEstablishYear(v) {
  const s = norm(v)
  if (!s) return { value: null, error: null }
  const n = Number(s)
  const nowYear = new Date().getFullYear()
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return { value: null, error: '成立时间必须是整数年份（或留空）。' }
  }
  if (n < 1990 || n > nowYear) {
    return { value: null, error: `成立时间范围：1990 ~ ${nowYear}（或留空）。` }
  }
  return { value: n, error: null }
}

// =========================
// Modal open/close (avoid aria-hidden focus warning)
// - open: display:flex + remove aria-hidden + focus first input
// - close: display:none + set aria-hidden
// =========================
function openModal(modalEl) {
  if (!modalEl) return
  modalEl.style.display = 'flex'
  modalEl.setAttribute('aria-hidden', 'false')

  // focus first input if exists
  const first = modalEl.querySelector('input, textarea, button')
  if (first) setTimeout(() => first.focus(), 0)
}

function closeModal(modalEl) {
  if (!modalEl) return

  // 关闭前：先把焦点挪出 modal，避免 aria-hidden 的 console warning
  const active = document.activeElement
  if (modalEl.contains(active)) {
    active.blur?.()
  }

  modalEl.style.display = 'none'
  modalEl.setAttribute('aria-hidden', 'true')
}

// =========================
// Confirm overlay (loading/success/fail)
// =========================
const confirmOverlay = $('#confirmOverlay')
const confirmTitle = $('#confirmTitle')
const confirmBody = $('#confirmBody')
const confirmOk = $('#confirmOk')

let confirmState = { okEnabled: true, onOk: null }

function showConfirm({ title, body, okText = '确定', okEnabled = true, onOk = null }) {
  if (!confirmOverlay) return
  confirmTitle.textContent = title || ''
  confirmBody.textContent = body || ''
  confirmOk.textContent = okText
  confirmOk.disabled = !okEnabled
  confirmState = { okEnabled, onOk }
  confirmOverlay.style.display = 'flex'
  confirmOverlay.setAttribute('aria-hidden', 'false')
}
function updateConfirm({ title, body, okText = '确认返回', okEnabled = true, onOk = null }) {
  if (!confirmOverlay) return
  if (title != null) confirmTitle.textContent = title
  if (body != null) confirmBody.textContent = body
  confirmOk.textContent = okText
  confirmOk.disabled = !okEnabled
  confirmState = { okEnabled, onOk }
}
function hideConfirm() {
  if (!confirmOverlay) return
  confirmOverlay.style.display = 'none'
  confirmOverlay.setAttribute('aria-hidden', 'true')
  confirmState = { okEnabled: true, onOk: null }
}

if (confirmOk) {
  confirmOk.addEventListener('click', () => {
    if (confirmOk.disabled) return
    const cb = confirmState.onOk
    hideConfirm()
    try { cb?.() } catch (_) {}
  })
}
if (confirmOverlay) {
  confirmOverlay.addEventListener('click', (e) => {
    if (e.target === confirmOverlay && confirmState.okEnabled) {
      hideConfirm()
      try { confirmState.onOk?.() } catch (_) {}
    }
  })
}

// =========================
// MultiSelect component (固定 3 列；checkbox 左顶格；仅显示 name；搜索支持 name/slug；确认才生效)
// 挂载点：<div id="productDomains" class="ia-ms"></div>
// =========================
let __msStyleInjected = false
function ensureMultiSelectStyles() {
  if (__msStyleInjected) return
  __msStyleInjected = true

  const style = document.createElement('style')
  style.textContent = `
  .ia-ms { border: 1px solid rgba(0,0,0,.20); border-radius: 12px; padding: 10px; box-sizing: border-box; }
  .ia-ms-head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .ia-ms-title { font-size: 13px; font-weight: 800; }
  .ia-ms-actions { display:flex; gap:8px; align-items:center; }
  .ia-ms-iconbtn {
    border: 1px solid rgba(0,0,0,.25);
    background: #fff;
    border-radius: 999px;
    width: 34px;
    height: 34px;
    cursor: pointer;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    font-size: 14px;
    line-height: 1;
  }
  .ia-ms-iconbtn:disabled { opacity:.6; cursor:not-allowed; }

  .ia-ms-summary { margin-top: 8px; font-size: 12px; color: rgba(0,0,0,.70); white-space: pre-wrap; }

  .ia-ms-panel {
    display:none;
    margin-top: 10px;
    border: 1px solid rgba(0,0,0,.18);
    border-radius: 12px;
    padding: 10px;
    background: #fff;
  }
  .ia-ms-panel[style*="display: block"] { display:block; }

  .ia-ms-search {
    width:100%;
    box-sizing:border-box;
    border:1px solid rgba(0,0,0,.25);
    border-radius: 12px;
    padding: 10px 12px;
    font-size: 14px;
    outline: none;
  }
  .ia-ms-hint { margin-top: 8px; font-size: 12px; color: rgba(0,0,0,.60); }

  /* ✅ 固定 3 列 + 允许横向滚动（你说可以接受滚动条） */
  .ia-ms-grid {
    margin-top: 10px;
    display: grid;
    grid-template-columns: repeat(3, minmax(260px, 1fr));
    gap: 8px 16px;
    max-height: 260px;
    overflow: auto;
    padding: 0;              /* ✅ 避免左侧空隙 */
  }

  /* ✅ 单项：label 必须是 flex，checkbox 左顶格，文字紧跟右侧 */
  .ia-ms-row {
    display:flex;
    align-items:flex-start;
    justify-content:flex-start;
    gap: 8px;
    padding: 2px 0;
    margin: 0;
    width: 100%;
    box-sizing: border-box;
    cursor: pointer;
    user-select:none;
  }
  .ia-ms-row input[type="checkbox"]{
    margin: 0;               /* ✅ 左顶格核心 */
    flex: 0 0 auto;
    width: 16px;
    height: 16px;
  }
  .ia-ms-text{
    display:block;
    margin: 0;
    padding: 0;
    font-size: 13px;
    color: #111;
    line-height: 1.25;
    white-space: normal;     /* ✅ 防止一列只显示一个字 */
    word-break: break-word;
  }

  .ia-ms-foot { display:flex; justify-content:flex-end; gap:10px; margin-top: 10px; }
  .ia-ms-btn {
    border: 1px solid rgba(0,0,0,.25);
    background:#fff;
    border-radius: 10px;
    padding: 8px 12px;
    cursor:pointer;
    font-size: 13px;
  }
  .ia-ms-btn-primary { border-color: rgba(0,0,0,.45); font-weight: 800; }
  `
  document.head.appendChild(style)
}

/**
 * createMultiSelect
 * @param {Object} opts
 * @param {string} opts.title - 标题
 * @param {boolean} opts.multi - 是否多选（true=多选）
 * @param {string} opts.searchPlaceholder - 搜索框 placeholder
 * @returns {{ mount: (rootEl:HTMLElement)=>void, setOptions:(items:any[])=>void, getCommittedIds:()=>any[], clear:()=>void }}
 */
function createMultiSelect(opts) {
  ensureMultiSelectStyles()

  const title = opts?.title ?? '选择'
  const multi = opts?.multi !== false // 默认多选
  const searchPlaceholder = opts?.searchPlaceholder ?? '搜索…'

  // items: {id, name, slug?}
  let all = []
  let query = ''
  let isOpen = false

  // committed：最终生效集合（确认后写入）
  const committed = new Map() // id -> item
  // draft：面板打开期间临时勾选
  let draft = new Map() // id -> item

  // DOM
  const root = document.createElement('div')
  root.className = 'ia-ms'

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
  btnClear.title = '清空'
  btnClear.textContent = '×'

  const btnArrow = document.createElement('button')
  btnArrow.className = 'ia-ms-iconbtn'
  btnArrow.type = 'button'
  btnArrow.title = '展开'
  btnArrow.textContent = '▾'

  actions.appendChild(btnClear)
  actions.appendChild(btnArrow)

  head.appendChild(titleEl)
  head.appendChild(actions)

  const summary = document.createElement('div')
  summary.className = 'ia-ms-summary'
  summary.textContent = '未选择'

  const panel = document.createElement('div')
  panel.className = 'ia-ms-panel'

  const search = document.createElement('input')
  search.className = 'ia-ms-search'
  search.type = 'text'
  search.placeholder = searchPlaceholder
  search.autocomplete = 'off'

  const hint = document.createElement('div')
  hint.className = 'ia-ms-hint'
  hint.textContent = '点击 ▾ 展开；勾选后点“确认”才生效；点“取消”放弃本次改动。'

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

  panel.appendChild(search)
  panel.appendChild(hint)
  panel.appendChild(grid)
  panel.appendChild(foot)

  root.appendChild(head)
  root.appendChild(summary)
  root.appendChild(panel)

  function setSummary() {
    if (committed.size === 0) {
      summary.textContent = '未选择'
      return
    }
    const names = Array.from(committed.values()).map((x) => x.name).filter(Boolean)
    summary.textContent = multi ? `已选：${names.join('、')}` : `已选：${names[0] ?? '1 项'}`
  }

  function matches(item, q) {
    if (!q) return true
    const needle = q.toLowerCase()
    const n = String(item?.name ?? '').toLowerCase()
    const s = String(item?.slug ?? '').toLowerCase()
    // ✅ 仅显示 name，但搜索支持 name/slug
    return n.includes(needle) || s.includes(needle)
  }

  function renderGrid() {
    grid.innerHTML = ''

    const q = norm(query).toLowerCase()
    const shown = all.filter((it) => matches(it, q))

    for (const it of shown) {
      const id = it.id
      const checked = draft.has(id)

      const row = document.createElement('label')
      row.className = 'ia-ms-row'

      const cb = document.createElement('input')
      cb.type = 'checkbox'
      cb.checked = checked

      const text = document.createElement('span')
      text.className = 'ia-ms-text'
      // ✅ 只显示名称（不显示 slug）
      text.textContent = String(it.name ?? '')

      cb.addEventListener('change', (e) => {
        const on = !!e.target.checked
        if (!multi) {
          draft.clear()
          if (on) draft.set(id, it)
          // 单选时：把其它 checkbox 状态刷新掉
          renderGrid()
          return
        }
        if (on) draft.set(id, it)
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
    draft = new Map(committed) // 复制当前生效值作为草稿
    panel.style.display = 'block'
    btnArrow.textContent = '▴'
    btnArrow.title = '收起'
    query = ''
    search.value = ''
    renderGrid()
    search.focus()
  }

  function close({ commit = false } = {}) {
    if (!isOpen) return
    if (commit) {
      committed.clear()
      for (const [k, v] of draft.entries()) committed.set(k, v)
      setSummary()
    } else {
      draft = new Map(committed)
    }
    isOpen = false
    panel.style.display = 'none'
    btnArrow.textContent = '▾'
    btnArrow.title = '展开'
    query = ''
    search.value = ''
  }

  function clear() {
    committed.clear()
    draft.clear()
    setSummary()
    if (isOpen) renderGrid()
  }

  function setOptions(items) {
    // items: [{id,name,slug?}]
    all = Array.isArray(items) ? items : []
    // 保留已选（按 id）
    const keep = new Map()
    for (const it of all) {
      if (committed.has(it.id)) keep.set(it.id, it)
    }
    committed.clear()
    for (const [k, v] of keep.entries()) committed.set(k, v)
    setSummary()
    if (isOpen) renderGrid()
  }

  function getCommittedIds() {
    return Array.from(committed.keys())
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

  // outside click: close panel but do not commit
  document.addEventListener('click', (e) => {
    if (!isOpen) return
    if (!root.contains(e.target)) close({ commit: false })
  })

  setSummary()

  return {
    mount(rootEl) {
      rootEl.innerHTML = ''
      rootEl.appendChild(root)
    },
    setOptions,
    getCommittedIds,
    clear,
  }
}

// =========================
// Domain dropdown loading
// =========================
let __domainsCache = null
async function refreshDomains() {
  const token = getToken()
  const data = await apiGetJson(API.dropdownDomains, token)
  const items = (data?.items || []).map((x) => ({
    id: x.id,
    name: x.name,
    slug: x.slug,
  }))
  __domainsCache = items
  return items
}
async function ensureDomainsLoaded() {
  if (__domainsCache && Array.isArray(__domainsCache)) return __domainsCache
  return refreshDomains()
}

// =========================
// Wire buttons -> modals
// =========================
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
  await ensureDomainsLoaded()
  msDomains.setOptions(__domainsCache)
})
if (btnOpenOrgProduct) btnOpenOrgProduct.addEventListener('click', () => {
  alert('“录入企业产品”窗口尚未实现（下一步做）。')
})

// click overlay to close
for (const m of [orgModal, domainModal, productModal]) {
  if (!m) continue
  m.addEventListener('click', (e) => {
    if (e.target === m) closeModal(m)
  })
}

// =========================
// Organization modal
// =========================
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

    showConfirm({ title: '录入中', body: '写入企业/机构中…请稍候', okEnabled: false })

    try {
      const res = await apiPostJson(API.createOrganization, payload, getToken())
      updateConfirm({
        title: '录入成功',
        body: `✅ 已写入 organization\n\n${JSON.stringify(res ?? {}, null, 2)}`,
        okText: '确认返回',
        okEnabled: true,
        onOk: () => {
          // 不自动关闭 orgModal：你可以继续录入；确认后返回当前弹窗
        },
      })
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

// =========================
// Domain modal
// =========================
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
      security_domain_name: norm(domainName?.value),
      cybersecurity_domain_slug: norm(domainSlug?.value),
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

      // 新增领域后：刷新产品弹窗候选
      await refreshDomains()
      msDomains.setOptions(__domainsCache)
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

// =========================
// Product modal + domain MultiSelect
// =========================
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
  msDomains.clear()
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

  const domainIds = msDomains.getCommittedIds()
  if (!domainIds.length) {
    setInvalid(null, productDomainsErr, '对应安全领域为必选（至少 1 个）。')
    ok = false
  } else {
    clearInvalid(null, productDomainsErr)
  }

  return ok
}

// mount MultiSelect into #productDomains
const msDomains = createMultiSelect({
  title: '安全领域',
  multi: true,
  searchPlaceholder: '搜索领域名称（也支持输入 slug 搜索，但不显示 slug）…',
})
{
  const mountEl = $('#productDomains')
  if (mountEl) msDomains.mount(mountEl)
}

if (productSubmit) {
  productSubmit.addEventListener('click', async () => {
    if (!validateProductForm()) return

    const payload = {
      security_product_name: norm(productName?.value),
      security_product_slug: norm(productSlug?.value),
      // ✅ 对接后端 product.js：字段名必须叫 domains
      domains: msDomains.getCommittedIds(),
    }

    showConfirm({ title: '录入中', body: '写入安全产品中…请稍候', okEnabled: false })

    try {
      const res = await apiPostJson(API.createProduct, payload, getToken())
      updateConfirm({
        title: '录入成功',
        body: `✅ 已写入 cybersecurity_product + cybersecurity_product_domain\n\n${JSON.stringify(res ?? {}, null, 2)}`,
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

// =========================
// Initial: preload domains cache (non-blocking)
// =========================
ensureDomainsLoaded()
  .then((items) => msDomains.setOptions(items))
  .catch((e) => {
    // 不阻塞 UI，只在控制台提示
    console.warn('domains preload failed:', e?.message || e)
  })
