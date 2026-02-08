// apps/web/src/admin.js
import { createMultiSelectGrid } from './ui/multiselect-grid.js'
import { createEntitySearch } from './ui/entity-search.js'
import { capturePrefill, applyPrefill } from './ui/prefill.js'
import {
  $,
  openModal,
  closeModal,
  setInvalid,
  clearInvalid,
  norm,
  isSlug,
} from './core/dom.js'

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

async function showConfirmFlow({ titleLoading, bodyLoading, action }) {
  confirm.setLoading(titleLoading || '录入中', bodyLoading || '请稍候…')
  try {
    const msg = await action()
    confirm.setResult(true, msg || '✅ 成功')
  } catch (e) {
    confirm.setResult(false, `❌ 失败：${e?.message || String(e)}`)
  }
  await confirm.waitAck()
}

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
    organization_full_name: () => norm(orgFullName.value) || '',
    establish_year: () => norm(orgEstablishYear.value) || '',
    organization_slug: () => norm(orgSlug.value),
  }
}
function orgSetters() {
  return {
    organization_short_name: (v) => { orgShortName.value = v ?? '' },
    organization_full_name: (v) => { orgFullName.value = v ?? '' },
    establish_year: (v) => { orgEstablishYear.value = v ?? '' },
    organization_slug: (v) => { orgSlug.value = v ?? '' },
  }
}

function orgClearErrors() {
  clearInvalid(orgShortName, orgShortNameErr)
  clearInvalid(orgEstablishYear, orgEstablishYearErr)
  clearInvalid(orgSlug, orgSlugErr)
}

function orgValidate() {
  orgClearErrors()

  const shortName = norm(orgShortName.value)
  const slug = norm(orgSlug.value)
  const yearStr = norm(orgEstablishYear.value)

  let ok = true
  if (!shortName) {
    setInvalid(orgShortName, orgShortNameErr, '企业简称为必填。')
    ok = false
  }
  if (!slug) {
    setInvalid(orgSlug, orgSlugErr, 'slug 为必填。')
    ok = false
  } else if (!isSlug(slug)) {
    setInvalid(orgSlug, orgSlugErr, 'slug 仅允许 a-z / 0-9 / 连字符 -（建议小写）。')
    ok = false
  }

  if (yearStr) {
    const y = Number(yearStr)
    const now = new Date().getFullYear()
    if (!Number.isFinite(y) || !Number.isInteger(y)) {
      setInvalid(orgEstablishYear, orgEstablishYearErr, '成立时间必须为整数年份。')
      ok = false
    } else if (y < 1990 || y > now) {
      setInvalid(orgEstablishYear, orgEstablishYearErr, `成立时间范围：1990 ~ ${now}。`)
      ok = false
    }
  }

  return ok
}

function orgCollectPayload() {
  const shortName = norm(orgShortName.value)
  const fullName = norm(orgFullName.value)
  const slug = norm(orgSlug.value)
  const yearStr = norm(orgEstablishYear.value)

  return {
    organization_short_name: shortName,
    organization_full_name: fullName || null,
    establish_year: yearStr ? Number(yearStr) : null,
    organization_slug: slug,
  }
}

function setOrgModeCreate() {
  orgMode = 'create'
  editingOrgId = null
  orgPrefillSnap = null

  orgModalTitle.textContent = '添加企业/机构'
  orgActionsCreate.style.display = ''
  orgActionsEdit.style.display = 'none'
}

function setOrgModeEdit({ organization }) {
  orgMode = 'edit'
  editingOrgId = organization.organization_id

  orgModalTitle.textContent = '编辑企业/机构（基础信息）'
  orgActionsCreate.style.display = 'none'
  orgActionsEdit.style.display = ''

  applyPrefill(orgSetters(), {
    organization_short_name: organization.organization_short_name ?? '',
    organization_full_name: organization.organization_full_name ?? '',
    establish_year: organization.establish_year ?? '',
    organization_slug: organization.organization_slug ?? '',
  })
  orgPrefillSnap = capturePrefill(orgGetters())
}

function orgResetToEmpty() {
  applyPrefill(orgSetters(), {
    organization_short_name: '',
    organization_full_name: '',
    establish_year: '',
    organization_slug: '',
  })
}

orgClose.addEventListener('click', () => closeModal(orgModal))
orgEditCancel.addEventListener('click', () => closeModal(orgModal))

orgReset.addEventListener('click', () => {
  orgClearErrors()
  orgResetToEmpty()
})
orgEditReset.addEventListener('click', () => {
  orgClearErrors()
  if (orgPrefillSnap) applyPrefill(orgSetters(), orgPrefillSnap)
})

orgSubmit.addEventListener('click', async () => {
  if (!orgValidate()) return

  const payload = orgCollectPayload()
  const token = getToken()

  orgSubmit.disabled = true
  orgReset.disabled = true

  await showConfirmFlow({
    titleLoading: '录入中',
    bodyLoading: '写入企业/机构中…',
    action: async () => {
      const res = await apiFetch('/api/admin/organization', { method: 'POST', token, body: payload })
      closeModal(orgModal)
      orgResetToEmpty()
      return `✅ 写入成功：organization_id = ${res?.organization?.organization_id}`
    }
  })

  orgSubmit.disabled = false
  orgReset.disabled = false
})

orgEditSubmit.addEventListener('click', async () => {
  if (!orgValidate()) return
  if (!editingOrgId) {
    await showConfirmFlow({
      titleLoading: '更新中',
      bodyLoading: '缺少 organization_id（无法更新）',
      action: async () => { throw new Error('Missing organization_id') }
    })
    return
  }

  const payload = orgCollectPayload()
  const token = getToken()

  orgEditSubmit.disabled = true
  orgEditReset.disabled = true
  orgEditCancel.disabled = true

  await showConfirmFlow({
    titleLoading: '更新中',
    bodyLoading: '更新企业/机构中…',
    action: async () => {
      const res = await apiFetch(`/api/admin/organization/${editingOrgId}`, { method: 'PATCH', token, body: payload })
      closeModal(orgModal)
      return `✅ 更新成功：organization_id = ${res?.organization?.organization_id}`
    }
  })

  orgEditSubmit.disabled = false
  orgEditReset.disabled = false
  orgEditCancel.disabled = false
})

/* =========================
 * Organization Edit: Search + Info
 * ========================= */
const btnOpenOrg = $('btnOpenOrg')
const btnOpenOrgEdit = $('btnOpenOrgEdit')

const orgSearchModal = $('orgSearchModal')
const orgSearchClose = $('orgSearchClose')
const orgSearchInput = $('orgSearchInput')
const orgSearchList = $('orgSearchList')
const orgSearchStatus = $('orgSearchStatus')

const orgInfoModal = $('orgInfoModal')
const orgInfoClose = $('orgInfoClose')
const orgInfoCancel = $('orgInfoCancel')
const orgInfoEdit = $('orgInfoEdit')
const orgInfoBody = $('orgInfoBody')

// admin.html 里 orgInfoModal 的标题 div 没有 id，这里用更稳的选择器
const orgInfoTitleEl = orgInfoModal.querySelector('.modal-title')

let currentOrgDetail = null

orgSearchClose.addEventListener('click', () => closeModal(orgSearchModal))
orgInfoClose.addEventListener('click', () => closeModal(orgInfoModal))
orgInfoCancel.addEventListener('click', () => closeModal(orgInfoModal))

function orgDisplayName(org) {
  const full = norm(org?.organization_full_name)
  const short = norm(org?.organization_short_name)
  return full || short || '（未命名企业/机构）'
}

function renderOrgInfo(org) {
  function kv(k, v) {
    const row = document.createElement('div')
    row.className = 'kv'

    const kk = document.createElement('div')
    kk.className = 'kv-k'
    kk.textContent = k

    const vv = document.createElement('div')
    vv.className = 'kv-v'
    vv.textContent = (v === null || v === undefined || v === '') ? '—' : String(v)

    row.appendChild(kk)
    row.appendChild(vv)
    return row
  }

  if (orgInfoTitleEl) {
    orgInfoTitleEl.textContent = `企业/机构信息：${orgDisplayName(org)}`
  }

  orgInfoBody.innerHTML = ''
  orgInfoBody.appendChild(kv('企业简称', org.organization_short_name))
  orgInfoBody.appendChild(kv('企业全称', org.organization_full_name))
  orgInfoBody.appendChild(kv('成立时间', org.establish_year))
  orgInfoBody.appendChild(kv('Slug', org.organization_slug))
  orgInfoBody.appendChild(kv('ID', org.organization_id))
}

const orgSearch = createEntitySearch({
  inputEl: orgSearchInput,
  listEl: orgSearchList,
  statusEl: orgSearchStatus,
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
  onPick: async (it) => {
    const token = getToken()
    try {
      orgSearchStatus.textContent = '读取详情中…'
      const res = await apiFetch(`/api/admin/organization/${it.organization_id}`, { token })
      currentOrgDetail = res.organization
      renderOrgInfo(currentOrgDetail)
      openModal(orgInfoModal)
    } catch (e) {
      orgSearchStatus.textContent = `读取失败：${e?.message || String(e)}`
    }
  }
})

orgInfoEdit.addEventListener('click', () => {
  if (!currentOrgDetail) return
  closeModal(orgInfoModal)
  closeModal(orgSearchModal)

  setOrgModeEdit({ organization: currentOrgDetail })
  orgClearErrors()
  openModal(orgModal)
})

btnOpenOrg.addEventListener('click', () => {
  setOrgModeCreate()
  orgClearErrors()
  orgResetToEmpty()
  openModal(orgModal)
})

btnOpenOrgEdit.addEventListener('click', () => {
  openModal(orgSearchModal)
  orgSearch.clear()
  orgSearch.focus()
})

/* =========================
 * Domain/Product Admin
 * ========================= */
const domainModal = $('domainModal')
const productModal = $('productModal')

const btnOpenDomain = $('btnOpenDomain')
const btnOpenProduct = $('btnOpenProduct')

const domainClose = $('domainClose')
const domainReset = $('domainReset')
const domainSubmit = $('domainSubmit')
const domainName = $('domainName')
const domainSlug = $('domainSlug')
const domainNameErr = $('domainNameErr')
const domainSlugErr = $('domainSlugErr')

const productClose = $('productClose')
const productReset = $('productReset')
const productSubmit = $('productSubmit')
const productName = $('productName')
const productSlug = $('productSlug')
const productNameErr = $('productNameErr')
const productSlugErr = $('productSlugErr')
const productDomainsErr = $('productDomainsErr')

const productDomainsHost = $('productDomains')

btnOpenDomain.addEventListener('click', () => openModal(domainModal))
domainClose.addEventListener('click', () => closeModal(domainModal))

function domainClearErrors() {
  clearInvalid(domainName, domainNameErr)
  clearInvalid(domainSlug, domainSlugErr)
}
function domainValidate() {
  domainClearErrors()
  let ok = true
  if (!norm(domainName.value)) {
    setInvalid(domainName, domainNameErr, '安全领域名称为必填。'); ok = false
  }
  const slug = norm(domainSlug.value)
  if (!slug) { setInvalid(domainSlug, domainSlugErr, 'slug 为必填。'); ok = false }
  else if (!isSlug(slug)) { setInvalid(domainSlug, domainSlugErr, 'slug 仅允许 a-z / 0-9 / 连字符 -'); ok = false }
  return ok
}

domainReset.addEventListener('click', () => {
  domainClearErrors()
  domainName.value = ''
  domainSlug.value = ''
})
domainSubmit.addEventListener('click', async () => {
  if (!domainValidate()) return
  const token = getToken()

  const payload = {
    security_domain_name: norm(domainName.value),
    cybersecurity_domain_slug: norm(domainSlug.value),
  }

  domainSubmit.disabled = true
  domainReset.disabled = true

  await showConfirmFlow({
    titleLoading: '录入中',
    bodyLoading: '写入安全领域中…',
    action: async () => {
      const res = await apiFetch('/api/admin/domain', { method: 'POST', token, body: payload })
      closeModal(domainModal)
      domainName.value = ''
      domainSlug.value = ''
      return `✅ 写入成功：security_domain_id = ${res?.domain?.security_domain_id}`
    }
  })

  domainSubmit.disabled = false
  domainReset.disabled = false
})

/* ---------- Product ---------- */
btnOpenProduct.addEventListener('click', async () => {
  openModal(productModal)
  try { await refreshDomainGrid() } catch (e) { console.error(e) }
})
productClose.addEventListener('click', () => closeModal(productModal))

function productClearErrors() {
  clearInvalid(productName, productNameErr)
  clearInvalid(productSlug, productSlugErr)
  productDomainsErr.textContent = ''
  productDomainsErr.style.display = 'none'
}
function setProductDomainsErr(msg) {
  productDomainsErr.textContent = msg
  productDomainsErr.style.display = msg ? 'block' : 'none'
}
function productValidate(selectedDomainIds) {
  productClearErrors()
  let ok = true

  if (!norm(productName.value)) { setInvalid(productName, productNameErr, '安全产品名称为必填。'); ok = false }
  const slug = norm(productSlug.value)
  if (!slug) { setInvalid(productSlug, productSlugErr, 'slug 为必填。'); ok = false }
  else if (!isSlug(slug)) { setInvalid(productSlug, productSlugErr, 'slug 仅允许 a-z / 0-9 / 连字符 -'); ok = false }

  if (!selectedDomainIds || selectedDomainIds.length === 0) {
    setProductDomainsErr('至少选择一个安全领域。')
    ok = false
  }
  return ok
}

let domainGrid = null

async function refreshDomainGrid() {
  const token = getToken()
  const res = await apiFetch('/api/admin/dropdowns/domains', { token })

  const options = (res?.items || []).map(x => ({
    id: x.security_domain_id,
    name: x.security_domain_name,
    // 关键：让 slug 也能被搜索，但 UI 不显示 slug
    slug: x.cybersecurity_domain_slug || null,
    description: null,
  }))

  if (!domainGrid) {
    domainGrid = createMultiSelectGrid({
      title: '安全领域',
      required: true,
      placeholder: '搜索领域名称（也支持输入 slug 搜索，但不显示 slug）…',
      columns: 3,
      options,
      // 用 name + slug 做搜索文本
      searchText: (o) => `${o?.name ?? ''} ${o?.slug ?? ''}`.trim(),
    })

    // ✅ 关键修复：把组件 element 挂到 productDomainsHost
    productDomainsHost.innerHTML = ''
    productDomainsHost.appendChild(domainGrid.element)
  } else {
    domainGrid.setOptions(options)
  }
}

productReset.addEventListener('click', () => {
  productClearErrors()
  productName.value = ''
  productSlug.value = ''
  domainGrid?.clear?.()
})

productSubmit.addEventListener('click', async () => {
  const token = getToken()

  // 确保 domains 列表是最新的（也确保 domainGrid 已挂载）
  await refreshDomainGrid()

  // ✅ 关键修复：multiselect-grid 的取值方法是 getValues()
  const selectedRaw = domainGrid?.getValues?.() || []

  // 后端支持 number[] 或 string[]；这里统一转为 number[]
  const selected = selectedRaw
    .map(x => Number(x))
    .filter(n => Number.isFinite(n))

  if (!productValidate(selected)) return

  // ✅ 关键修复：后端字段名为 domains
  const payload = {
    security_product_name: norm(productName.value),
    security_product_slug: norm(productSlug.value),
    domains: selected,
  }

  productSubmit.disabled = true
  productReset.disabled = true

  await showConfirmFlow({
    titleLoading: '录入中',
    bodyLoading: '写入安全产品中…',
    action: async () => {
      const res = await apiFetch('/api/admin/product', { method: 'POST', token, body: payload })
      closeModal(productModal)
      productName.value = ''
      productSlug.value = ''
      domainGrid?.clear?.()
      return `✅ 写入成功：security_product_id = ${res?.product?.security_product_id}`
    }
  })

  productSubmit.disabled = false
  productReset.disabled = false
})

/* =========================
 * 企业产品（organization_product）后续拆分后再做
 * ========================= */
