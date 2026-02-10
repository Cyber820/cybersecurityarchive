// apps/web/src/core/dropdowns.js

/**
 * Keep all dropdown / union endpoints in ONE place.
 *
 * Why:
 * - product_union / domain_union will likely expand to more unions later
 * - features should not hardcode endpoint strings everywhere
 */

function enc(v) {
  return encodeURIComponent(String(v ?? ''))
}

/**
 * Factory: create a searchFn(q) that calls `/api/admin/dropdowns/<...>?q=`
 */
export function makeDropdownSearch({ apiFetch, getToken, path }) {
  if (!apiFetch) throw new Error('makeDropdownSearch: missing apiFetch')
  if (!getToken) throw new Error('makeDropdownSearch: missing getToken')
  if (!path) throw new Error('makeDropdownSearch: missing path')

  return async (q) => {
    const token = getToken()
    return await apiFetch(`${path}?q=${enc(q)}`, { token })
  }
}

// ===== Built-in searches we already use =====

export function makeDomainUnionSearch({ apiFetch, getToken }) {
  return makeDropdownSearch({ apiFetch, getToken, path: '/api/admin/dropdowns/domain_union' })
}

export function makeProductUnionSearch({ apiFetch, getToken }) {
  return makeDropdownSearch({ apiFetch, getToken, path: '/api/admin/dropdowns/product_union' })
}
