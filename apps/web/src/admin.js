// apps/web/src/admin.js
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
import { apiFetch, initAdminTokenInput } from './core/api.js'
import { initConfirm } from './core/confirm.js'

import { mountDomainAdmin } from './features/domain.js'
import { mountProductAdmin } from './features/product.js'
import { mountOrgProductAdmin } from './features/org-product.js'

/* =========================
 * Confirm (loading -> result -> ack)
 * ========================= */
const { showConfirmFlow } = initConfirm({ $, openModal, closeModal })

/* =========================
 * Admin token (input + localStorage)
 * ========================= */
const { getToken } = initAdminTokenInput($('tokenInput'), { storageKey: 'ia_admin_token' })

/* =========================
 * Domain Admin
 * ========================= */
mountDomainAdmin({
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
})

/* =========================
 * Product Admin
 * ========================= */
mountProductAdmin({
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
})

/* =========================
 * Organization Product Admin (NEW)
 * ========================= */
mountOrgProductAdmin({
  $,
  openModal,
  closeModal,
  setInvalid,
  clearInvalid,
  norm,
  apiFetch,
  getToken,
  showConfirmFlow,
})

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
  editingOrgId = null
  orgPrefillSnap = null

  orgModalTitle.textContent = '添加企业/机构'
  orgActionsCreate.style.display = ''
  orgActionsEdit.style.display = 'none'
}

function setOrgModeEdit({ organization }) {
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
      return `✅ 写入成功：organization_id = ${res?.organization?.organization_id ?? res?.organization_id ?? '（未返回）'}`
    }
  })

  orgSubmit.disabled = false
  orgReset.disabled = false
})

orgEditSubmit.addEventListener('click', async () => {
  if (!orgValidate()) return
  if (!editingOrgId) throw new Error('Missing organization_id')

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
      return `✅ 更新成功：organization_id = ${res?.organization?.organization_id ?? res?.organization_id ?? '（未返回）'}`
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
      currentOrgDetail = res.organization ?? res
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
