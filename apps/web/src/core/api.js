// apps/web/src/core/api.js

/**
 * =========================
 * API helper + admin token store
 * =========================
 *
 * 约定：
 * - Admin token 放在 input#tokenInput
 * - localStorage key 默认 ia_admin_token
 * - 请求时带 header: x-admin-token
 */

export function initAdminTokenInput(inputEl, { storageKey = 'ia_admin_token' } = {}) {
  if (!inputEl) throw new Error('initAdminTokenInput: missing inputEl')

  inputEl.value = localStorage.getItem(storageKey) || ''

  inputEl.addEventListener('input', () => {
    localStorage.setItem(storageKey, inputEl.value || '')
  })

  function getToken() {
    return inputEl.value || ''
  }

  return { getToken, storageKey }
}

export async function apiFetch(path, { method = 'GET', token = '', body = null } = {}) {
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
