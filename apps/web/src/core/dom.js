// apps/web/src/core/dom.js

/* =========================
 * DOM / validation helpers
 * ========================= */

export function $(id) {
  return document.getElementById(id)
}

export function openModal(overlayEl) {
  overlayEl.style.display = 'flex'
  overlayEl.setAttribute('aria-hidden', 'false')
}

export function closeModal(overlayEl) {
  overlayEl.style.display = 'none'
  overlayEl.setAttribute('aria-hidden', 'true')
}

export function setInvalid(inputEl, errEl, msg) {
  inputEl.setAttribute('aria-invalid', 'true')
  errEl.textContent = msg
  errEl.style.display = 'block'
}

export function clearInvalid(inputEl, errEl) {
  inputEl.removeAttribute('aria-invalid')
  errEl.textContent = ''
  errEl.style.display = 'none'
}

export function norm(v) {
  return String(v ?? '').trim()
}

export function isSlug(s) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)
}
