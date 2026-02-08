// apps/web/src/admin.js
import { createMultiSelectGrid } from './ui/multiselect-grid.js'
import { createEntitySearch } from './ui/entity-search.js'
import { capturePrefill, applyPrefill } from './ui/prefill.js'
import { $, openModal, closeModal, setInvalid, clearInvalid, norm, isSlug } from './core/dom.js'

async function apiFetch(path, { method = 'GET', token = '', body = null } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['x-admin-token'] = token

  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })

  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }

  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    err.detail = data
    throw err
  }
  return data
}

/* =========================
 * Confirm (loading -> result -> ack)
 * ========================= */
function createConfirm() {
  const overlay = $('confirmOverlay')
  const titleEl = $('confirmTitle')
  const bodyEl = $('confirmBody')
  const okBtn = $('confirmOk')

  let resolver = null

  function open() { openModal(overlay) }
  function close() { closeModal(overlay) }

  function setLoading(title = '录入中', body = '请稍候…') {
    titleEl.textContent = title
    bodyEl.textContent = body
    okBtn.disabled = true
    open()
  }

  function setResult(ok, message) {
    titleEl.textContent = ok ? '完成' : '失败'
    bodyEl.textContent = message || ''
    okBtn.disabled = false
    open()
  }

  function waitAck() {
    return new Promise((resolve) => {
      resolver = resolve
      const onClick = () => {
        okBtn.removeEventListener('click', onClick)
        close()
        resolver && resolver(true)
        resolver = null
      }
      okBtn.addEventListener('click', onClick)
    })
  }

  return { setLoading, setResult, waitAck }
}

const confirm = createConfirm()

/* =========================
 * Token cache
 * ========================= */
const tokenInput = $('tokenInput')
const TOKEN_KEY = 'ia_admin_token'
tokenInput.value = localStorage.getItem(TOKEN_KEY) || ''
tokenInput.addEventListener('input', () => {
  localStorage.setItem(TOKEN_KEY, tokenInput.value || '')
})
function getToken() { return tokenInput.value || '' }

/* =========================
 * Organization: Create + Edit shared form
 * ========================= */
const orgModal = $('orgModal')
const orgModalTitle = $('orgModalTitle')
const orgClose = $('orgClose')

const orgShortName = $('orgShortName')
const orgFullName = $('orgFullName')
const orgEstablishYear = $('orgEstablishYear')
const orgSlug = $('orgSlug')

const orgShortNameErr = $('orgShortNameErr')
const orgEstablishYearErr = $('orgEstablishYearErr')
const orgSlugErr = $('orgSlugErr')

const orgActionsCreate = $('orgActionsCreate')
const orgActionsEdit = $('orgActionsEdit')

const orgReset = $('orgReset')
const orgSubmit = $('orgSubmit')

const orgEditReset = $('orgEditReset')
const orgEditCancel = $('orgEditCancel')
const orgEditSubmit = $('orgEditSubmit')

let orgMode = 'create' // create | edit
let editingOrgId = null
let orgPrefillSnap = null

function orgGetters() {
  return {
    organization_short_name: () => norm(orgShortName.value),
    organization_full_name: () => norm(orgFullName.value),
    establish_year: () => norm(orgEstablishYear.value),
    organization_slug: () => norm(orgSlug.value)
  }
}

function orgSetMode(mode) {
  orgMode = mode
  if (mode === 'create') {
    orgModalTitle.textContent = '添加企业/机构'
    orgActionsCreate.style.display = 'flex'
    orgActionsEdit.style.display = 'none'
    editingOrgId = null
  } else {
    orgModalTitle.textContent = '编辑企业/机构'
    orgActionsCreate.style.display = 'none'
    orgActionsEdit.style.display = 'flex'
  }
}

function orgClearInvalidAll() {
  clearInvalid(orgShortName, orgShortNameErr)
  clearInvalid(orgEstablishYear, orgEstablishYearErr)
  clearInvalid(orgSlug, orgSlugErr)
}

function orgValidate() {
  orgClearInvalidAll()

  const shortName = norm(orgShortName.value)
  const establishYear = norm(orgEstablishYear.value)
  const slug = norm(orgSlug.value)

  let ok = true

  if (!shortName) {
    setInvalid(orgShortName, orgShortNameErr, '必须填写企业简称')
    ok = false
  }

  if (establishYear && !/^\d{4}$/.test(establishYear)) {
    setInvalid(orgEstablishYear, orgEstablishYearErr, '成立年份应为4位数字（可留空）')
    ok = false
  }

  if (slug && !isSlug(slug)) {
    setInvalid(orgSlug, orgSlugErr, 'Slug 仅允许小写字母/数字/连字符（如 example-company）')
    ok = false
  }

  return ok
}

function orgCollectPayload() {
  const g = orgGetters()
  const payload = {
    organization_short_name: g.organization_short_name(),
    organization_full_name: g.organization_full_name() || null,
    establish_year: g.establish_year() ? Number(g.establish_year()) : null,
    organization_slug: g.organization_slug() || null
  }
  return payload
}

function orgFillForm(data) {
  orgShortName.value = data.organization_short_name || ''
  orgFullName.value = data.organization_full_name || ''
  orgEstablishYear.value = data.establish_year ?? ''
  orgSlug.value = data.organization_slug || ''
  orgClearInvalidAll()

  // snapshot prefill
  orgPrefillSnap = capturePrefill({
    orgShortName,
    orgFullName,
    orgEstablishYear,
    orgSlug
  })
}

function orgResetToPrefill() {
  if (!orgPrefillSnap) return
  applyPrefill(orgPrefillSnap)
  orgClearInvalidAll()
}

async function orgSubmitCreate() {
  if (!orgValidate()) return

  const token = getToken()
  const payload = orgCollectPayload()

  confirm.setLoading('录入中', '正在写入企业/机构…')
  try {
    const out = await apiFetch('/api/admin/organization', {
      method: 'POST',
      token,
      body: payload
    })
    confirm.setResult(true, `已创建：${out?.organization_short_name || payload.organization_short_name}`)
  } catch (e) {
    confirm.setResult(false, e.message || '创建失败')
  }
  await confirm.waitAck()
}

async function orgSubmitEdit() {
  if (!editingOrgId) return
  if (!orgValidate()) return

  const token = getToken()
  const payload = orgCollectPayload()

  confirm.setLoading('保存中', '正在更新企业/机构…')
  try {
    const out = await apiFetch(`/api/admin/organization/${editingOrgId}`, {
      method: 'PUT',
      token,
      body: payload
    })
    confirm.setResult(true, `已更新：${out?.organization_short_name || payload.organization_short_name}`)
  } catch (e) {
    confirm.setResult(false, e.message || '更新失败')
  }
  await confirm.waitAck()
}

/* ----- open/close org modal ----- */
function orgOpenCreate() {
  orgSetMode('create')
  orgFillForm({
    organization_short_name: '',
    organization_full_name: '',
    establish_year: '',
    organization_slug: ''
  })
  openModal(orgModal)
}

function orgOpenEdit(orgId, data) {
  editingOrgId = orgId
  orgSetMode('edit')
  orgFillForm(data || {})
  openModal(orgModal)
}

function orgCloseModal() {
  closeModal(orgModal)
}

orgClose.addEventListener('click', orgCloseModal)
orgReset.addEventListener('click', () => {
  orgFillForm({
    organization_short_name: '',
    organization_full_name: '',
    establish_year: '',
    organization_slug: ''
  })
})
orgSubmit.addEventListener('click', orgSubmitCreate)

orgEditReset.addEventListener('click', orgResetToPrefill)
orgEditCancel.addEventListener('click', orgCloseModal)
orgEditSubmit.addEventListener('click', orgSubmitEdit)

/* =========================
 * Organization: Search -> Details -> Edit
 * ========================= */
const orgSearchModal = $('orgSearchModal')
const orgSearchClose = $('orgSearchClose')
const orgSearchBox = $('orgSearchBox')
const orgSearchBtn = $('orgSearchBtn')
const orgSearchHint = $('orgSearchHint')
const orgSearchResults = $('orgSearchResults')

const orgDetailsModal = $('orgDetailsModal')
const orgDetailsClose = $('orgDetailsClose')
const orgDetailsBody = $('orgDetailsBody')
const orgDetailsEditBtn = $('orgDetailsEditBtn')

let selectedOrg = null // { id, record }

const orgSearchUI = createEntitySearch({
  inputEl: orgSearchBox,
  buttonEl: orgSearchBtn,
  hintEl: orgSearchHint,
  resultsEl: orgSearchResults,
  placeholder: '输入企业简称/全称/slug 关键词…',
  onSearch: async (q) => {
    const token = getToken()
    const data = await apiFetch('/api/admin/search/organizations', {
      method: 'POST',
      token,
      body: { q }
    })
    return data?.items || []
  },
  renderItem: (item) => {
    const short = item.organization_short_name || '(无简称)'
    const full = item.organization_full_name ? ` / ${item.organization_full_name}` : ''
    const slug = item.organization_slug ? ` (${item.organization_slug})` : ''
    return `${short}${full}${slug}`
  },
  onPick: (item) => {
    selectedOrg = { id: item.organization_id, record: item }
    openModal(orgDetailsModal)
    orgDetailsBody.textContent = JSON.stringify(item, null, 2)
  }
})

function openOrgSearch() {
  selectedOrg = null
  openModal(orgSearchModal)
  orgSearchUI.reset()
}

function closeOrgSearch() { closeModal(orgSearchModal) }
orgSearchClose.addEventListener('click', closeOrgSearch)

orgDetailsClose.addEventListener('click', () => closeModal(orgDetailsModal))
orgDetailsEditBtn.addEventListener('click', () => {
  if (!selectedOrg) return
  closeModal(orgDetailsModal)
  closeModal(orgSearchModal)
  orgOpenEdit(selectedOrg.id, selectedOrg.record)
})

/* =========================
 * Organization buttons
 * ========================= */
$('btnOpenOrgCreate').addEventListener('click', orgOpenCreate)
$('btnOpenOrgEdit').addEventListener('click', openOrgSearch)

/* =========================
 * Domain: Create
 * ========================= */
const domainModal = $('domainModal')
const domainClose = $('domainClose')

const domainName = $('domainName')
const domainSlug = $('domainSlug')

const domainNameErr = $('domainNameErr')
const domainSlugErr = $('domainSlugErr')

const domainReset = $('domainReset')
const domainSubmit = $('domainSubmit')

function domainClearInvalidAll() {
  clearInvalid(domainName, domainNameErr)
  clearInvalid(domainSlug, domainSlugErr)
}

function domainValidate() {
  domainClearInvalidAll()

  const name = norm(domainName.value)
  const slug = norm(domainSlug.value)

  let ok = true

  if (!name) {
    setInvalid(domainName, domainNameErr, '必须填写安全领域名称')
    ok = false
  }

  if (slug && !isSlug(slug)) {
    setInvalid(domainSlug, domainSlugErr, 'Slug 仅允许小写字母/数字/连字符（如 endpoint-security）')
    ok = false
  }

  return ok
}

function domainCollectPayload() {
  return {
    security_domain_name: norm(domainName.value),
    security_domain_slug: norm(domainSlug.value) || null
  }
}

function domainOpenCreate() {
  domainName.value = ''
  domainSlug.value = ''
  domainClearInvalidAll()
  openModal(domainModal)
}

function domainCloseModal() { closeModal(domainModal) }
domainClose.addEventListener('click', domainCloseModal)

domainReset.addEventListener('click', () => {
  domainName.value = ''
  domainSlug.value = ''
  domainClearInvalidAll()
})

domainSubmit.addEventListener('click', async () => {
  if (!domainValidate()) return

  const token = getToken()
  const payload = domainCollectPayload()

  confirm.setLoading('录入中', '正在写入安全领域…')
  try {
    const out = await apiFetch('/api/admin/domain', {
      method: 'POST',
      token,
      body: payload
    })
    confirm.setResult(true, `已创建：${out?.security_domain_name || payload.security_domain_name}`)
  } catch (e) {
    confirm.setResult(false, e.message || '创建失败')
  }
  await confirm.waitAck()
})

$('btnOpenDomainCreate').addEventListener('click', domainOpenCreate)

/* =========================
 * Product: Create + Domain link (grid)
 * ========================= */
const productModal = $('productModal')
const productClose = $('productClose')

const productName = $('productName')
const productSlug = $('productSlug')

const productNameErr = $('productNameErr')
const productSlugErr = $('productSlugErr')

const productReset = $('productReset')
const productSubmit = $('productSubmit')

const domainGridMount = $('domainGridMount')
const domainGridHint = $('domainGridHint')
const domainGridRefresh = $('domainGridRefresh')

const domainGrid = createMultiSelectGrid({
  mountEl: domainGridMount,
  hintEl: domainGridHint,
  columns: 3,
  rowGap: 8,
  colGap: 10,
  checkboxSize: 16
})

async function loadDomainsIntoGrid() {
  const token = getToken()
  const data = await apiFetch('/api/admin/dropdowns/domains', { token })
  const items = (data?.items || []).map(d => ({
    id: d.security_domain_id,
    label: d.security_domain_name
  }))
  domainGrid.setItems(items)
}

domainGridRefresh.addEventListener('click', async () => {
  confirm.setLoading('加载中', '正在刷新安全领域列表…')
  try {
    await loadDomainsIntoGrid()
    confirm.setResult(true, '已刷新安全领域列表')
  } catch (e) {
    confirm.setResult(false, e.message || '刷新失败')
  }
  await confirm.waitAck()
})

function productClearInvalidAll() {
  clearInvalid(productName, productNameErr)
  clearInvalid(productSlug, productSlugErr)
}

function productValidate() {
  productClearInvalidAll()

  const name = norm(productName.value)
  const slug = norm(productSlug.value)

  let ok = true

  if (!name) {
    setInvalid(productName, productNameErr, '必须填写安全产品名称')
    ok = false
  }

  if (slug && !isSlug(slug)) {
    setInvalid(productSlug, productSlugErr, 'Slug 仅允许小写字母/数字/连字符（如 acme-av)）')
    ok = false
  }

  return ok
}

function productCollectPayload() {
  const domainIds = domainGrid.getSelectedIds()
  return {
    security_product_name: norm(productName.value),
    security_product_slug: norm(productSlug.value) || null,
    security_domain_ids: domainIds
  }
}

function productOpenCreate() {
  productName.value = ''
  productSlug.value = ''
  productClearInvalidAll()
  domainGrid.clearSelected()
  openModal(productModal)

  // lazy load domains
  loadDomainsIntoGrid().catch(() => { /* silent */ })
}

function productCloseModal() { closeModal(productModal) }
productClose.addEventListener('click', productCloseModal)

productReset.addEventListener('click', () => {
  productName.value = ''
  productSlug.value = ''
  productClearInvalidAll()
  domainGrid.clearSelected()
})

productSubmit.addEventListener('click', async () => {
  if (!productValidate()) return

  const token = getToken()
  const payload = productCollectPayload()

  confirm.setLoading('录入中', '正在写入安全产品…')
  try {
    const out = await apiFetch('/api/admin/product', {
      method: 'POST',
      token,
      body: payload
    })
    confirm.setResult(true, `已创建：${out?.security_product_name || payload.security_product_name}`)
  } catch (e) {
    confirm.setResult(false, e.message || '创建失败')
  }
  await confirm.waitAck()
})

$('btnOpenProductCreate').addEventListener('click', productOpenCreate)
