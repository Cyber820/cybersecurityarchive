// apps/web/src/ui/alias-switch.js

/**
 * Alias Switch Controller
 * -----------------------
 * 用于处理“是否别名”模式切换：show/hide 不同的 row，并在切换时触发清理回调。
 *
 * 约定：
 * - selectEl 的 value 期望是 'yes' 或 'no'（与你当前 domainIsAlias/productIsAlias 一致）
 * - rowsWhenMain: mode='no' 时应显示的 rows
 * - rowsWhenAlias: mode='yes' 时应显示的 rows
 *
 * rows 允许传：
 * - 单个 HTMLElement
 * - HTMLElement 数组
 * - null/undefined（会被忽略）
 */
export function createAliasSwitch({
  selectEl,
  rowsWhenMain = [],
  rowsWhenAlias = [],
  onModeChange = null,
} = {}) {
  if (!selectEl) throw new Error('createAliasSwitch: missing selectEl')

  const normList = (x) => {
    if (!x) return []
    return Array.isArray(x) ? x.filter(Boolean) : [x].filter(Boolean)
  }

  const mainRows = normList(rowsWhenMain)
  const aliasRows = normList(rowsWhenAlias)

  function setVisible(el, visible) {
    if (!el) return
    el.style.display = visible ? '' : 'none'
  }

  function getMode() {
    const v = String(selectEl.value || '').toLowerCase()
    return v === 'yes' ? 'yes' : 'no'
  }

  function applyMode(mode = getMode(), { emit = false } = {}) {
    const m = mode === 'yes' ? 'yes' : 'no'

    // main mode => show mainRows, hide aliasRows
    // alias mode => show aliasRows, hide mainRows
    const isAlias = m === 'yes'
    for (const r of mainRows) setVisible(r, !isAlias)
    for (const r of aliasRows) setVisible(r, isAlias)

    if (emit && typeof onModeChange === 'function') {
      onModeChange(m)
    }
  }

  function isAlias() {
    return getMode() === 'yes'
  }

  // bind
  selectEl.addEventListener('change', () => {
    applyMode(getMode(), { emit: true })
  })

  // init once (do not emit by default)
  applyMode(getMode(), { emit: false })

  return {
    getMode,
    isAlias,
    applyMode,
  }
}
