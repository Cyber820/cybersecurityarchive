// apps/web/src/ui/prefill.js

/**
 * capturePrefill(getters)
 * - getters: { key: () => value }
 * - 返回一个“快照对象”，用于后续 reset 回到预填状态
 */
export function capturePrefill(getters) {
  const snap = {}
  for (const [k, fn] of Object.entries(getters || {})) {
    try { snap[k] = fn() }
    catch { snap[k] = null }
  }
  return snap
}

/**
 * applyPrefill(setters, snapshot)
 * - setters: { key: (value) => void }
 * - snapshot: capturePrefill 的返回值
 */
export function applyPrefill(setters, snapshot) {
  for (const [k, fn] of Object.entries(setters || {})) {
    if (typeof fn !== 'function') continue
    fn(snapshot ? snapshot[k] : null)
  }
}
