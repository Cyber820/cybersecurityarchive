// apps/web/src/ui/checkbox-multiselect.js

/**
 * createCheckboxMultiSelect
 * ========================
 * 目标：将 “搜索 + checkbox 多选列表” 抽象成可复用组件。
 *
 * 使用方式（示例）：
 * const domainMultiSelect = createCheckboxMultiSelect({
 *   searchEl: document.getElementById('domainSearch'),
 *   metaEl: document.getElementById('domainMeta'),
 *   gridEl: document.getElementById('domainCheckboxGrid'),
 *   emptyEl: document.getElementById('domainEmpty'),
 *   idPrefix: 'domain_cb',
 *   fetchOptions: async () => apiGet('/api/admin/dropdowns/domains?limit=500'),
 *   formatLabel: (d) => `${d.name} (${d.slug})`
 * });
 *
 * await domainMultiSelect.load(true);
 * const ids = domainMultiSelect.getSelectedIds();
 */

/**
 * @param {Object} opts
 * @param {HTMLInputElement} opts.searchEl
 *   - 搜索框 input（监听 input 事件，实时过滤）
 *
 * @param {HTMLElement} opts.metaEl
 *   - 状态文本容器（显示 “加载中 / 共N项 / 匹配M/N”）
 *
 * @param {HTMLElement} opts.gridEl
 *   - checkbox 列表渲染容器（会往里 append 多个 <label class="ms-item">）
 *
 * @param {HTMLElement} opts.emptyEl
 *   - “无匹配项”提示容器（过滤后 list 为空时显示）
 *
 * @param {Function} opts.fetchOptions
 *   - 异步拉取选项数据的函数
 *   - 必须返回 { items: [...] }
 *   - items 内部至少包含 id/name/slug（字段可由 normalize 做映射）
 *
 * @param {Function} [opts.formatLabel]
 *   - 渲染每个选项的文字：formatLabel(item) -> string
 *   - 默认 `${item.name} (${item.slug})`
 *
 * @param {string} [opts.idPrefix]
 *   - checkbox DOM id 的前缀，避免多个组件时 id 冲突
 *   - 最终 checkbox id 形如 `${idPrefix}_${item.id}`
 */
export function createCheckboxMultiSelect({
  searchEl,
  metaEl,
  gridEl,
  emptyEl,
  fetchOptions,
  formatLabel = (item) => `${item.name} (${item.slug})`,
  idPrefix = 'ms'
}) {
  /**
   * allItems
   * - 存放“完整数据集”（未过滤）
   * - 过滤时基于该数组计算 filtered 列表
   */
  let allItems = [];

  /**
   * setMeta
   * - 更新 metaEl 的状态文本
   * @param {string} text
   */
  function setMeta(text) {
    if (metaEl) metaEl.textContent = text;
  }

  /**
   * normalize
   * - 将后端返回的 items 统一成固定结构：
   *   { id:number, name:string, slug:string }
   * - 这样后续过滤和渲染不依赖后端字段名细节
   *
   * @param {Array<any>} items
   * @returns {Array<{id:number,name:string,slug:string}>}
   */
  function normalize(items) {
    return (items || [])
      .map((x) => ({
        id: Number(x.id),
        name: String(x.name ?? x.security_domain_name ?? x.security_product_name ?? ''),
        slug: String(x.slug ?? x.cybersecurity_domain_slug ?? x.security_product_slug ?? '')
      }))
      .filter((x) => Number.isFinite(x.id));
  }

  /**
   * render
   * - 将给定列表渲染为 checkbox 行
   * - 每行结构：
   *   <label class="ms-item" for="...">
   *     <input type="checkbox" ... />
   *     <span class="ms-label">...</span>
   *   </label>
   *
   * @param {Array<{id:number,name:string,slug:string}>} list
   */
  function render(list) {
    // 清空旧内容
    gridEl.innerHTML = '';

    for (const item of list) {
      const cbId = `${idPrefix}_${item.id}`;

      // 1) 行容器：label（点击文字也能触发 checkbox）
      const label = document.createElement('label');
      label.className = 'ms-item';
      label.setAttribute('for', cbId);

      // 2) checkbox
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = cbId;
      cb.value = String(item.id);

      // 3) 文本
      const text = document.createElement('span');
      text.className = 'ms-label';
      text.textContent = formatLabel(item);

      label.appendChild(cb);
      label.appendChild(text);
      gridEl.appendChild(label);
    }

    // 控制 “无匹配项” 提示
    if (emptyEl) emptyEl.style.display = list.length ? 'none' : 'block';
  }

  /**
   * applyFilter
   * - 根据 search 文本过滤（匹配 name 或 slug）
   * - 过滤后会调用 render() 重新渲染列表
   *
   * @param {string} q - 搜索关键字（允许为空）
   */
  function applyFilter(q) {
    const qq = String(q || '').trim().toLowerCase();

    // 空搜索：渲染全量
    if (!qq) {
      render(allItems);
      setMeta(`共 ${allItems.length} 项`);
      return;
    }

    // 非空搜索：子串匹配 name/slug
    const next = allItems.filter((it) => {
      const n = (it.name || '').toLowerCase();
      const s = (it.slug || '').toLowerCase();
      return n.includes(qq) || s.includes(qq);
    });

    render(next);
    setMeta(`匹配 ${next.length} / ${allItems.length}`);
  }

  /**
   * load
   * - 拉取选项数据，并渲染
   *
   * @param {boolean} [force=false]
   *   - false：如果 allItems 已有数据，则不重新请求，只按当前 search 过滤刷新
   *   - true：强制重新请求 fetchOptions()，并刷新列表
   */
  async function load(force = false) {
    // 已有缓存且不强制刷新：仅重新过滤渲染
    if (!force && allItems.length) {
      applyFilter(searchEl?.value || '');
      return;
    }

    // 进入加载态
    setMeta('加载中…');
    gridEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'none';

    // 拉取数据（必须返回 { items: [...] }）
    const data = await fetchOptions();

    // 规范化并保存
    allItems = normalize(data?.items);

    // 按当前搜索值渲染
    applyFilter(searchEl?.value || '');
  }

  /**
   * getSelectedIds
   * - 返回当前 grid 里被勾选的所有 id（去重后）
   *
   * @returns {number[]} ids
   */
  function getSelectedIds() {
    const ids = [];
    gridEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      if (cb.checked) {
        const n = Number(cb.value);
        if (Number.isFinite(n)) ids.push(n);
      }
    });
    // 去重
    return Array.from(new Set(ids));
  }

  /**
   * clearSelection
   * - 清空所有 checkbox 的勾选状态
   */
  function clearSelection() {
    gridEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => (cb.checked = false));
  }

  /**
   * 绑定搜索框事件：
   * - 用户输入时实时过滤
   */
  if (searchEl) {
    searchEl.addEventListener('input', () => applyFilter(searchEl.value));
  }

  // 对外暴露的 API
  return { load, applyFilter, getSelectedIds, clearSelection };
}
