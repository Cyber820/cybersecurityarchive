// apps/web/src/ui/entity-search.js

/**
 * createEntitySearch
 *
 * 这是一个“可复用的简易搜索 UI 组件”，适合：
 * - admin 的“编辑某实体：先搜索再打开详情/编辑”
 * - viewer 的“无关键字但想按条件/关键字查找”
 *
 * 你只要提供：
 * - searchFn(query) -> Promise<{ items: any[] }>
 * - renderItem(item) -> { title: string, subtitle?: string }
 * - onPick(item) 当用户点中某条结果时触发
 */
export function createEntitySearch({
  inputEl,
  listEl,
  statusEl,
  searchFn,
  renderItem,
  onPick,
  debounceMs = 220,
  minQueryLen = 1,
}) {
  if (!inputEl || !listEl || !statusEl) {
    throw new Error('createEntitySearch: missing inputEl/listEl/statusEl')
  }

  let timer = null
  let lastQ = ''
  let inflight = 0

  function setStatus(text) {
    statusEl.textContent = text || ''
  }

  function clearList() {
    listEl.innerHTML = ''
  }

  function renderList(items) {
    clearList()
    if (!items || items.length === 0) {
      const div = document.createElement('div')
      div.className = 'hint'
      div.textContent = '没有匹配结果。'
      listEl.appendChild(div)
      return
    }

    for (const it of items) {
      const { title, subtitle } = renderItem(it) || {}
      const row = document.createElement('div')
      row.style.border = '1px solid rgba(0,0,0,.15)'
      row.style.borderRadius = '10px'
      row.style.padding = '10px'
      row.style.margin = '8px 0'
      row.style.cursor = 'pointer'
      row.style.userSelect = 'none'

      const t = document.createElement('div')
      t.style.fontWeight = '800'
      t.style.fontSize = '14px'
      t.textContent = title || '（未命名）'

      row.appendChild(t)

      if (subtitle) {
        const s = document.createElement('div')
        s.style.marginTop = '4px'
        s.style.fontSize = '12px'
        s.style.color = 'rgba(0,0,0,.65)'
        s.textContent = subtitle
        row.appendChild(s)
      }

      row.addEventListener('click', () => onPick && onPick(it))
      listEl.appendChild(row)
    }
  }

  async function doSearch(q) {
    const my = ++inflight
    setStatus('搜索中…')
    clearList()

    try {
      const res = await searchFn(q)
      if (my !== inflight) return // 过期响应丢弃

      const items = res?.items || []
      setStatus(`共 ${items.length} 项`)
      renderList(items)
    } catch (e) {
      if (my !== inflight) return
      setStatus(`搜索失败：${e?.message || String(e)}`)
    }
  }

  function schedule() {
    const q = String(inputEl.value || '').trim()
    lastQ = q

    if (timer) clearTimeout(timer)

    if (!q || q.length < minQueryLen) {
      inflight++
      setStatus('请输入关键字开始搜索。')
      clearList()
      return
    }

    timer = setTimeout(() => doSearch(q), debounceMs)
  }

  inputEl.addEventListener('input', schedule)

  return {
    refresh: () => schedule(),
    setQuery: (q) => { inputEl.value = q || ''; schedule() },
    clear: () => { inputEl.value = ''; schedule() },
    focus: () => inputEl.focus(),
    getQuery: () => lastQ,
  }
}
