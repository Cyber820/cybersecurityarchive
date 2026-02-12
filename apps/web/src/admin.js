// apps/web/src/admin.js 
import { $, openModal, closeModal, setInvalid, clearInvalid, norm, isSlug } from './core/dom.js'
import { apiFetch, initAdminTokenInput } from './core/api.js'
import { initConfirm } from './core/confirm.js'

import { mountOrganizationAdmin } from './features/organization.js'
import { mountDomainAdmin } from './features/domain.js'
import { mountDomainEditAdmin } from './features/domain-edit.js'
import { mountProductAdmin } from './features/product.js'
import { mountOrgProductAdmin } from './features/org-product.js'

/* =========================
 * Confirm (loading -> result -> ack)
 * ========================= */
function safeInitConfirm() {
  try {
    return initConfirm({ $, openModal, closeModal })
  } catch (e) {
    console.error('[admin] initConfirm failed:', e)
    // Fallback: a no-op confirm flow so the page can still work for debugging.
    return {
      showConfirmFlow: async ({ action } = {}) => {
        if (typeof action === 'function') return await action()
        return null
      }
    }
  }
}

const { showConfirmFlow } = safeInitConfirm();

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

const { getToken } = safeInitToken();

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
 * Domain Edit (search/edit/delete)
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
 * Organization Product
 * ========================= */
try {
  mountOrgProductAdmin({ $, openModal, closeModal, setInvalid, clearInvalid, norm, apiFetch, getToken, showConfirmFlow })
} catch (e) {
  console.error('[admin] mountOrgProductAdmin failed:', e)
}
