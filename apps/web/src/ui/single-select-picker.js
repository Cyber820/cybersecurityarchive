// apps/web/src/ui/single-select-picker.js
import { createEntitySearch } from './entity-search.js'

/**
 * Single Select Search Picker
 * ---------------------------
 * 把“搜索列表 + 单选 + 已选提示 + 清除 + 必填校验”抽成可复用组件。
 *
 * 你现有的 UI 结构（orgProductOrg / domainAliasTarget / productAliasTarget）都符合：
 * - pickedEl: 显示“已选择”文本的元素
 * - clearBtn: 清除按钮（可隐藏）
 * - inputEl / statusEl / listEl: 搜索输入、状态提示、结果容器
 * - errEl: 错误显示（可选）
 *
 * searchFn/ renderItem 复用你现有 createEntitySearch 约定。
 */
export function createSingleSelectPicker({
  pickedEl,
  clearBtn,
  inputEl,
  statusEl,
  listEl,
  errEl = null,

  // required: async (q) => ({ items: [...] }) 或你当前 createEntitySearch 接受的结构
  searchFn,
  // required: (item) => ({ title, subtitle })
  renderItem,

  // optional
  getId = (it) => it?.id ?? it?.value ?? it?.organization_id ?? it?.security_domain_id ?? it?.security_product_id,
  getLabel = (it, rendered) => rendered?.title ?? String(getId(it) ?? ''),
  emptyText = '未选择（请在下方搜索并点击一个选项）',
  onPick = null, // (item, selection) => void|Promise<void>
} = {}) {
  if (!pickedEl) throw new Error('createSingleSelectPicker: missing pickedEl')
  if (!clearBtn) throw new Error('createSingleSelectPicker: missing clearBtn')
  if (!inputEl) throw new Error('createSingleSelectPicker: missing inputEl')
  if (!statusEl) throw new Error('createSingleSelectPicker: missing statusEl')
  if (!listEl) throw new Error('createSingleSelectPicker: missing listEl')
  if (typeof searchFn !== 'function') throw new Error('createSingleSelectPicker: missing searchFn')
  if (typeof renderItem !== 'function') throw new Error('createSingleSelectPicker: missing renderItem')

  let selected = null // { id, label, raw }

  function showErr(msg) {
    if (!errEl) return
    errEl.textContent = msg || ''
    errEl.style.display = msg ? '' : 'none'
  }

  function setPickedText(text) {
    pickedEl.textContent = text || emptyText
  }

  function setClearVisible(visible) {
    clearBtn.style.display = visible ? '' : 'none'
  }

  function setSelected(sel) {
    selected = sel ? { ...sel } : null
    if (selected) {
      setPickedText(selected.label || String(selected.id ?? ''))
      setClearVisible(true)
      showErr('')
    } else {
      setPickedText(emptyText)
      setClearVisible(false)
    }
  }

  function getSelected() {
    return selected
  }

  function clear() {
    setSelected(null)
    if (inputEl) inputEl.value = ''
    showErr('')
  }

  clearBtn.addEventListener('click', () => {
    clear()
  })

  const search = createEntitySearch({
    inputEl,
    listEl,
    statusEl,
    searchFn,
    renderItem,
    onPick: async (it) => {
      const rendered = renderItem(it) || {}
      const id = getId(it)
      const label = getLabel(it, rendered)

      const sel = { id, label, raw: it }
      setSelected(sel)

      if (typeof onPick === 'function') {
        await onPick(it, sel)
      }
    }
  })

  function validateRequired(msg = '此项为必填。') {
    if (selected && selected.id !== null && selected.id !== undefined && String(selected.id) !== '') {
      showErr('')
      return true
    }
    showErr(msg)
    return false
  }

  function focus() {
    if (typeof search?.focus === 'function') search.focus()
    else inputEl?.focus?.()
  }

  // init default UI state
  setSelected(null)

  return {
    search,
    getSelected,
    setSelected,
    clear,
    validateRequired,
    focus,
  }
}
