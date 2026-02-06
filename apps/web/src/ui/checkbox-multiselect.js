// apps/web/src/ui/checkbox-multiselect.js

/**
 * Dropdown Checkbox Multi-select
 * ==============================
 * 目标：
 * 1) 默认不展开（不“自动下拉”）
 * 2) 点击触发按钮（带箭头）才展开面板
 * 3) 勾选 checkbox 只影响“临时选择”（pending）
 * 4) 点击“确定”才把临时选择写入“已确认选择”（committed）
 * 5) 支持“清空”（清空已确认+临时），并刷新 summary
 *
 * 组件输出：
 * - load(force)                : 拉取选项并渲染
 * - open() / close() / toggle(): 控制面板显示
 * - confirm() / cancel()       : 确认/取消（取消会回滚临时选择）
 * - clear()                    : 清空所有选择
 * - getSelectedIds()           : 获取“已确认”的 id 列表（提交表单使用这个）
 * - getPendingIds()            : 获取“临时”的 id 列表（调试用）
 * - applyFilter(q)             : 过滤（name/slug）
 * - refreshSummary()           : 刷新 summary 文本（一般内部调用）
 */

export function createDropdownCheckboxMultiSelect({
  /** @type {HTMLButtonElement} triggerEl - 点击展开/收起的按钮（带箭头） */
  triggerEl,
  /** @type {HTMLElement} summaryEl - trigger 内显示“已选择xx项 / 选项文本”的元素 */
  summaryEl,
  /** @type {HTMLElement} panelEl - 下拉面板容器（默认 display:none） */
  panelEl,

  /** @type {HTMLInputElement} searchEl - 面板内搜索框（实时过滤） */
  searchEl,
  /** @type {HTMLElement} metaEl - 面板内状态文本（加载中/共N项/匹配M/N） */
  metaEl,
  /** @type {HTMLElement} gridEl - 面板内 checkbox 列表渲染容器 */
  gridEl,
  /** @type {HTMLElement} emptyEl - “无匹配项”提示容器 */
  emptyEl,

  /** @type {HTMLButtonElement} confirmEl - “确定”按钮 */
  confirmEl,
  /** @type {HTMLButtonElement} cancelEl - “取消”按钮（回滚 pending -> committed 并关闭面板） */
  cancelEl,
  /** @type {HTMLButtonElement} clearEl - “清空”按钮（清空 committed+pending，刷新 UI） */
  clearEl,

  /**
   * @type {Function} fetchOptions
   * - 拉取选项数据：async () => ({ items: [...] })
   * - items 至少要能映射出 id/name/slug（normalize 会做兼容字段名）
   */
  fetchOptions,

  /**
   * @type {Function} formatLabel
   * - 渲染单条选项文字：formatLabel(item) -> string
   * - 默认 `${name} (${slug})`
   */
  formatLabel = (item) => `${item.name} (${item.slug})`,

  /**
   * @type {Function} formatSummary
   * - 渲染 summary 文本：formatSummary(committedItems, allItems) -> string
   * - committedItems 为已确认选中的 item 数组
   */
  formatSummary,

  /**
   * @type {string} idPrefix
   * - checkbox 的 DOM id 前缀，避免多组件冲突
   * - checkbox id = `${idPrefix}_${item.id}`
   */
  idPrefix = 'dd_ms'
}) {
  /** allItems: 全量选项（标准化结构 {id,name,slug}） */
  let allItems = [];

  /** committedIds: 已确认选择（用于提交） */
  let committedIds = new Set();

  /** pendingIds: 面板内临时选择（用户勾选即时更新） */
  let pendingIds = new Set();

  /** 是否展开面板 */
  let isOpen = false;

  /** ========== 小工具：更新 meta 文本 ========== */
  function setMeta(text) {
    if (metaEl) metaEl.textContent = text;
  }

  /** ========== 标准化后端 items 字段名 ========== */
  function normalize(items) {
    return (items || [])
      .map((x) => ({
        id: Number(x.id),
        // 兼容不同 dropdown 返回字段名
        name: String(x.name ?? x.security_domain_name ?? x.security_product_name ?? ''),
        slug: String(x.slug ?? x.cybersecurity_domain_slug ?? x.security_product_slug ?? '')
      }))
      .filter((x) => Number.isFinite(x.id));
  }

  /** ========== 依据 committedIds 找出 item 列表（用于 summary） ========== */
  function getCommittedItems() {
    const ids = committedIds;
    return allItems.filter((it) => ids.has(it.id));
  }

  /** ========== 默认 summary 文本 ========== */
  function defaultFormatSummary(committedItems) {
    if (!committedItems.length) return '未选择';
    if (committedItems.length <= 3) return committedItems.map(formatLabel).join('，');
    return `已选择 ${committedItems.length} 项`;
  }

  /** ========== 刷新 summary（显示在 trigger 上） ========== */
  function refreshSummary() {
    if (!summaryEl) return;
    const items = getCommittedItems();
    const fn = formatSummary || defaultFormatSummary;
    summaryEl.textContent = fn(items, allItems);
  }

  /** ========== 渲染 checkbox 列表（按照 list 渲染；勾选来自 pendingIds） ========== */
  function render(list) {
    gridEl.innerHTML = '';

    for (const item of list) {
      const cbId = `${idPrefix}_${item.id}`;

      const label = document.createElement('label');
      label.className = 'dd-item';
      label.setAttribute('for', cbId);

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = cbId;
      cb.value = String(item.id);
      cb.checked = pendingIds.has(item.id);

      // 用户勾选时：只更新 pendingIds（不会影响 committedIds，直到点确定）
      cb.addEventListener('change', () => {
        const n = Number(cb.value);
        if (!Number.isFinite(n)) return;
        if (cb.checked) pendingIds.add(n);
        else pendingIds.delete(n);
        // 这里不刷新 summary，因为 summary 是已确认选择
      });

      const text = document.createElement('span');
      text.className = 'dd-label';
      text.textContent = formatLabel(item);

      label.appendChild(cb);
      label.appendChild(text);
      gridEl.appendChild(label);
    }

    if (emptyEl) emptyEl.style.display = list.length ? 'none' : 'block';
  }

  /** ========== 过滤（按 name/slug 子串匹配），过滤结果渲染到 gridEl ========== */
  function applyFilter(q) {
    const qq = String(q || '').trim().toLowerCase();
    if (!qq) {
      render(allItems);
      setMeta(`共 ${allItems.length} 项`);
      return;
    }

    const next = allItems.filter((it) => {
      const n = (it.name || '').toLowerCase();
      const s = (it.slug || '').toLowerCase();
      return n.includes(qq) || s.includes(qq);
    });

    render(next);
    setMeta(`匹配 ${next.length} / ${allItems.length}`);
  }

  /** ========== 将 committedIds 同步到 pendingIds（用于打开面板时初始化） ========== */
  function syncPendingFromCommitted() {
    pendingIds = new Set(committedIds);
  }

  /** ========== 打开面板：显示 panel + 初始化 pending + 渲染/过滤 ========== */
  function open() {
    if (isOpen) return;
    isOpen = true;
    panelEl.style.display = 'block';
    syncPendingFromCommitted();
    // 打开时按当前搜索值过滤（一般是空）
    applyFilter(searchEl?.value || '');
  }

  /** ========== 关闭面板：隐藏 panel ========== */
  function close() {
    if (!isOpen) return;
    isOpen = false;
    panelEl.style.display = 'none';
  }

  /** ========== 展开/收起 ========== */
  function toggle() {
    if (isOpen) close();
    else open();
  }

  /**
   * confirm
   * - 用户点击“确定”：pending -> committed
   * - 刷新 summary
   * - 关闭面板
   */
  function confirm() {
    committedIds = new Set(pendingIds);
    refreshSummary();
    close();
  }

  /**
   * cancel
   * - 用户点击“取消”：丢弃 pending（回滚到 committed）
   * - 关闭面板
   */
  function cancel() {
    syncPendingFromCommitted();
    close();
  }

  /**
   * clear
   * - 清空已确认选择（committed）+ 临时选择（pending）
   * - 刷新 summary
   * - 如果面板展开，则立即重绘（checkbox 都取消勾选）
   */
  function clear() {
    committedIds = new Set();
    pendingIds = new Set();
    refreshSummary();
    if (isOpen) applyFilter(searchEl?.value || '');
  }

  /**
   * getSelectedIds
   * - 获取“已确认”的 id 列表（提交表单请用这个）
   * @returns {number[]}
   */
  function getSelectedIds() {
    return Array.from(committedIds);
  }

  /**
   * getPendingIds
   * - 获取“临时”的 id 列表（一般仅调试用）
   * @returns {number[]}
   */
  function getPendingIds() {
    return Array.from(pendingIds);
  }

  /**
   * load
   * - 拉取 options，并渲染/刷新 meta/summary
   * @param {boolean} [force=false]
   *   - false：如果 allItems 已经存在，则不重新请求
   *   - true ：强制重新请求 fetchOptions()
   */
  async function load(force = false) {
    if (!force && allItems.length) {
      // 只刷新 UI（比如 summary ）
      refreshSummary();
      if (isOpen) applyFilter(searchEl?.value || '');
      return;
    }

    setMeta('加载中…');
    gridEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'none';

    const data = await fetchOptions();
    allItems = normalize(data?.items);

    // 数据更新后：刷新 summary（避免显示旧数量）
    refreshSummary();

    // 如果面板开着：按当前搜索过滤刷新列表
    if (isOpen) applyFilter(searchEl?.value || '');
    else setMeta(`共 ${allItems.length} 项`);
  }

  /** ========== 事件绑定：trigger / confirm / cancel / clear / search ========== */
  if (triggerEl) triggerEl.addEventListener('click', (e) => {
    e.preventDefault();
    toggle();
  });

  if (confirmEl) confirmEl.addEventListener('click', (e) => {
    e.preventDefault();
    confirm();
  });

  if (cancelEl) cancelEl.addEventListener('click', (e) => {
    e.preventDefault();
    cancel();
  });

  if (clearEl) clearEl.addEventListener('click', (e) => {
    e.preventDefault();
    clear();
  });

  if (searchEl) searchEl.addEventListener('input', () => {
    // 过滤只影响列表显示，不影响 committed/pending 本身
    applyFilter(searchEl.value);
  });

  /**
   * 点击面板外部自动关闭（不确认、不取消：等价 cancel）
   * 这样用户点空白处会收起，并回滚到已确认选择
   */
  document.addEventListener('click', (e) => {
    if (!isOpen) return;
    const t = e.target;
    // 如果点击发生在 trigger 或 panel 内部，忽略
    if (triggerEl.contains(t) || panelEl.contains(t) || (clearEl && clearEl.contains(t))) return;
    cancel();
  });

  // 初始 summary
  refreshSummary();

  return {
    load,
    open,
    close,
    toggle,
    confirm,
    cancel,
    clear,
    applyFilter,
    refreshSummary,
    getSelectedIds,
    getPendingIds
  };
}
