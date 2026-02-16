// apps/web/src/lib/api.js
// 兼容层：提供 apiFetchJSON，内部复用 core/api.js 的 apiFetch

import { apiFetch } from '../core/api.js'

/**
 * apiFetchJSON(path, { method, token, body })
 * - path: '/api/xxx'
 * - token: admin token（会写入 x-admin-token）
 * - body: 传对象即可（内部会 JSON.stringify）
 */
export async function apiFetchJSON(path, { method = 'GET', token = '', body = null } = {}) {
  return apiFetch(path, { method, token, body })
}

// 如果你部分代码直接 import { apiFetch } from '../lib/api.js' 也能工作
export { apiFetch }
