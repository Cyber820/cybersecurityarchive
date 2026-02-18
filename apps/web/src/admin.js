// apps/web/src/admin.js
import { $, openModal, closeModal, setInvalid, clearInvalid, norm, isSlug } from './core/dom.js'
import { apiFetch, initAdminTokenInput } from './core/api.js'
import { initConfirm } from './core/confirm.js'

import { mountOrganizationAdmin } from './features/organization.js'
import { mountDomainAdmin } from './features/domain.js'
import { mountDomainEditAdmin } from './features/domain-edit.js'

import { mountProductAdmin } from './features/product.js'
import { mountProductEditAdmin } from './features/product-edit.js'

import { mountOrgProductAdmin } from './features/org-product.js'
import { mountOrgProductEditAdmin } from './features/org-product-edit.js'

/* =========================
 * Confirm (loading -> result -> ack)
 * ========================= */
function safeInitConfirm() {
  try {
    return initConfirm({ $, openModal, closeModal })
  } catch (e) {
    console.error('[admin] initConfirm failed:', e)
    return {
      showConfirmFlow: async ({ action } = {}) => {
        if (typeof action === 'function') return await action()
        return null
      }
    }
  }
}

const { showConfirmFlow } = safeInitConfirm()

/* =========================
 * Admin token (input + localStorage)
 * ========================= */
function safeInitToken() {
  const input = $('tokenInput')
  if (!input) {
    console.warn('[admin] tokenInput not found; API calls may fail with unauthorized.')
    return { getToken: () => '', storageKey: 'ia_admin_token' }
  }
  return initAdminTokenInput(input, { storageKey: 'ia_admin_token' })
}

const { getToken } = safeInitToken()

/* =========================
 * Organization
 * ========================= */
try {
  mountOrganizationAdmin({ $, openModal, closeModal, setInvalid, clearInvalid, norm, isSlug, apiFetch, getToken, showConfirmFlow })
} catch (e) {
  console.error('[admin] mountOrganizationAdmin failed:', e)
}

/* =========================
 * Domain
 * ========================= */
try {
  mountDomainAdmin({ $, openModal, closeModal, setInvalid, clearInvalid, norm, isSlug, apiFetch, getToken, showConfirmFlow })
} catch (e) {
  console.error('[admin] mountDomainAdmin failed:', e)
}

/* =========================
 * Domain (Edit)
 * ========================= */
try {
  mountDomainEditAdmin({ $, openModal, closeModal, setInvalid, clearInvalid, norm, isSlug, apiFetch, getToken, showConfirmFlow })
} catch (e) {
  console.error('[admin] mountDomainEditAdmin failed:', e)
}

/* =========================
 * Product
 * ========================= */
try {
  mountProductAdmin({ $, openModal, closeModal, setInvalid, clearInvalid, norm, isSlug, apiFetch, getToken, showConfirmFlow })
} catch (e) {
  console.error('[admin] mountProductAdmin failed:', e)
}

/* =========================
 * Product (Edit)
 * ========================= */
try {
  mountProductEditAdmin({ $, openModal, closeModal, setInvalid, clearInvalid, norm, isSlug, apiFetch, getToken, showConfirmFlow })
} catch (e) {
  console.error('[admin] mountProductEditAdmin failed:', e)
}

/* =========================
 * Organization Product (Create)
 * ========================= */
try {
  mountOrgProductAdmin({ $, openModal, closeModal, setInvalid, clearInvalid, norm, apiFetch, getToken, showConfirmFlow })
} catch (e) {
  console.error('[admin] mountOrgProductAdmin failed:', e)
}

/* =========================
 * Organization Product (Edit)
 * ========================= */
try {
  mountOrgProductEditAdmin({ $, openModal, closeModal, apiFetch, getToken, showConfirmFlow })
} catch (e) {
  console.error('[admin] mountOrgProductEditAdmin failed:', e)
}
