// apps/web/src/admin.js 
import { $ , openModal, closeModal, setInvalid, clearInvalid, norm, isSlug } from './core/dom.js'
import { apiFetch, initAdminTokenInput } from './core/api.js'
import { initConfirm } from './core/confirm.js'

import { mountOrganizationAdmin } from './features/organization.js'
import { mountDomainAdmin } from './features/domain.js'
import { mountProductAdmin } from './features/product.js'
import { mountOrgProductAdmin } from './features/org-product.js'

/* =========================
 * Confirm (loading -> result -> ack)
 * ========================= */
const { showConfirmFlow } = initConfirm({ $, openModal, closeModal });

/* =========================
 * Admin token (input + localStorage)
 * ========================= */
const { getToken } = initAdminTokenInput($('tokenInput'), { storageKey: 'ia_admin_token' });

/* =========================
 * Organization
 * ========================= */
mountOrganizationAdmin({
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
});

/* =========================
 * Domain
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
});

/* =========================
 * Product
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
});

/* =========================
 * Organization Product
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
});
