// apps/web/src/admin.js
// Admin entry: 负责基础设施（token、modal、confirm、HTTP）+ 挂载各个 feature

import { mountDomainAdmin } from './features/domain-admin.js'
import { mountProductAdmin } from './features/product-admin.js'
import { mountOrganizationAdmin } from './features/organization-admin.js'

/**
 * =========================
 * Constants
 * =========================
 */
const TOKEN_STORAGE_KEY = 'ia_admin_token'

export const API = {
  // create
  createOrganization: '/api/admin/organization',
  createDomain: '/api/admin/domain',
  createProduct: '/api/admin/product',

  // dropdowns
  listDomains: '/api/admin/dropdowns/domains',
}

export const FIELD = {
  // domain
  domainName: 'security_domain_name',
  domainSlug: 'cybersecurity_domain_slug',

  // product
  productName: 'security_product_name',
  productSlug: 'security_product_slug',
  productDomainIds: 'domain_ids',
}

/**
 * =========================
 * DOM helpers
 * =========================
 */
export function $(sel) {
  return document.querySelector(sel)
}

export function norm(v) {
  return (v ?? '').toString().trim()
}

export function setInvalid(inputEl, msgEl, message) {
  if (inputEl?.setAttribute) inputEl.setAttribute('aria-invalid', 'true')
  if (msgEl) {
    msgEl.textContent = message || ''
    msgEl.style.display = message ? 'block' : 'none'
  }
}

export function clearInvalid(inputEl, msgEl) {
  if (inputEl?.removeAttribute) inputEl.removeAttribute('aria-invalid')
  if (msgEl) {
    msgEl.textContent = ''
    msgEl.style.display = 'none'
  }
}

export function isValidSlug(s) {
  return /^[a-z0-9-]+$/.test(norm(s))
}

export function validateEstablishYear(raw) {
  const t = norm(raw)
  if (!t) return { value: null, error: null }
  if (!/^\d{4}$/.test(t)) return { value: null, error: '成立时间必须是 4 位数字年份（或留空）。' }

  const year = Number(t)
  const nowYear = new Date().getFullYear()
  if (year < 1990 || year > nowYear) return { value: null, error: `成立时间范围：1990 ~ ${nowYear}。` }

  return { value: year, error: null }
}

/**
 * =========================
 * Token（只输入一次）
 * =========================
 */
function getTokenInputEl() {
  return $('#tokenInput')
}

export function getToken() {
  const el = getTokenInputEl()
  const v = norm(el?.value)
  if (v) return v
  return norm(localStorage.getItem(TOKEN_STORAGE_KEY))
}

function saveTokenIfNeeded() {
  const el = getTokenInputEl()
  if (!el) return
  const v = norm(el.value)
  if (!v) return
  localStorage.setItem(TOKEN_STORAGE_KEY, v)
}

function restoreToken() {
  const el = getTokenInputEl()
  if (!el) return
  const v = norm(localStorage.getItem(TOKEN_STORAGE_KEY))
  if (v) el.value = v
}

/**
 * =========================
 * Modal & Confirm
 * =========================
 */
let __modalZ = 99999

export function openModal(modalOverlayEl) {
  if (!modalOverlayEl) return

  // ✅ 关键：每次打开都给更高 z-index，避免“旧弹窗遮住新弹窗”
  __modalZ += 2
  modalOverlayEl.style.zIndex = String(__modalZ)

  modalOverlayEl.style.display = 'flex'
  modalOverlayEl.setAttribute('aria-hidden', 'false')

  // 让弹窗内部第一个 input 获取焦点（可选）
  const first = modalOverlayEl.querySelector('input, textarea, button, select')
  if (first && typeof first.focus === 'function') {
    try { first.focus() } catch (_) {}
  }
}

export function closeModal(modalOverlayEl) {
  if (!modalOverlayEl) return
  modalOverlayEl.style.display = 'none'
  modalOverlayEl.setAttribute('aria-hidden', 'true')

  // 避免 console：aria-hidden descendant retained focus
  try { document.body.focus() } catch (_) {}
}

const confirmOverlay = $('#confirmOverlay')
const confirmTitle = $('#confirmTitle')
const confirmBody = $('#confirmBody')
const confirmOk = $('#confirmOk')

let __confirmOkHandler = null

export function showConfirm({ title, body, okEnabled = true, okText = '确定', onOk } = {}) {
  if (!confirmOverlay) return

  // ✅ confirm 永远在最上层
  __modalZ += 2
  confirmOverlay.style.zIndex = String(__modalZ)

  confirmTitle.textContent = title || '状态'
  confirmBody.textContent = body || ''

  confirmOk.textContent = okText
  confirmOk.disabled = !okEnabled

  if (__confirmOkHandler) {
    confirmOk.removeEventListener('click', __confirmOkHandler)
    __confirmOkHandler = null
  }

  __confirmOkHandler = () => {
    hideConfirm()
    if (typeof onOk === 'function') onOk()
  }
  confirmOk.addEventListener('click', __confirmOkHandler)

  confirmOverlay.style.display = 'flex'
  confirmOverlay.setAttribute('aria-hidden', 'false')
}

export function updateConfirm({ title, body, okEnabled = true, okText = '确定' } = {}) {
  if (!confirmOverlay) return
  if (title != null) confirmTitle.textContent = title
  if (body != null) confirmBody.textContent = body
  if (okText != null) confirmOk.textContent = okText
  confirmOk.disabled = !okEnabled
}

function hideConfirm() {
  if (!confirmOverlay) return
  confirmOverlay.style.display = 'none'
  confirmOverlay.setAttribute('aria-hidden', 'true')
  try { document.body.focus() } catch (_) {}
}

/**
 * =========================
 * HTTP
 * =========================
 */
async function _fetchJson(url, { method = 'GET', token, body } = {}) {
  saveTokenIfNeeded()

  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['x-admin-token'] = token

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch (_) {
    data = text
  }

  if (!res.ok) {
    const msg =
      typeof data === 'object' && data && data.error
        ? data.error
        : (typeof data === 'string' ? data : res.statusText)
    const err = new Error(msg || `HTTP ${res.status}`)
    err.status = res.status
    err.detail = data
    throw err
  }

  return data
}

export async function apiGetJson(url, token) {
  return _fetchJson(url, { method: 'GET', token })
}

export async function apiPostJson(url, body, token) {
  return _fetchJson(url, { method: 'POST', token, body })
}

/**
 * =========================
 * Boot
 * =========================
 */
function boot() {
  restoreToken()

  const ctx = {
    API,
    FIELD,
    $, norm,
    openModal, closeModal,
    showConfirm, updateConfirm,
    apiGetJson, apiPostJson,
    getToken,
    setInvalid, clearInvalid,
    isValidSlug,
    validateEstablishYear,
  }

  mountOrganizationAdmin(ctx)
  mountDomainAdmin(ctx)
  mountProductAdmin(ctx)

  // 预留：企业产品、企业编辑等后续 feature
}

boot()
