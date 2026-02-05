// apps/web/src/ui/checkbox-multiselect.js

/**
 * Reusable checkbox multi-select (search + 3-column grid by CSS)
 *
 * Requirements:
 * - You provide existing DOM elements: searchEl, metaEl, gridEl, emptyEl
 * - You provide fetchOptions(): async () => ({ items: [{id,name,slug}, ...] })
 *
 * Returned API:
 * - load(force=false): load options (and re-render)
 * - applyFilter(q): filter by name/slug
 * - getSelectedIds(): number[]
 * - clearSelection(): void
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
  let allItems = [];

  function setMeta(text) {
    if (metaEl) metaEl.textContent = text;
  }

  function normalize(items) {
    return (items || [])
      .map((x) => ({
        id: Number(x.id),
        name: String(x.name || ''),
        slug: String(x.slug || '')
      }))
      .filter((x) => Number.isFinite(x.id));
  }

  // ✅ 关键：渲染时给 ms-label 加 inline style 兜底，防止被全局 CSS 隐藏
  function createLabelSpan(textValue) {
    const span = document.createElement('span');
    span.className = 'ms-label';
    span.textContent = textValue;

    // Inline fallback: ensure visible even if CSS is overridden
    span.style.display = 'inline-block';
    span.style.flex = '1 1 auto';
    span.style.minWidth = '0';
    span.style.color = '#111';
    span.style.opacity = '1';
    span.style.visibility = 'visible';
    span.style.whiteSpace = 'nowrap';

    return span;
  }

  function render(list) {
    gridEl.innerHTML = '';

    for (const item of list) {
      const cbId = `${idPrefix}_${item.id}`;

      const label = document.createElement('label');
      label.className = 'ms-item';
      label.setAttribute('for', cbId);

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = cbId;
      cb.value = String(item.id);

      const span = createLabelSpan(formatLabel(item));

      label.appendChild(cb);
      label.appendChild(span);
      gridEl.appendChild(label);
    }

    if (emptyEl) emptyEl.style.display = list.length ? 'none' : 'block';
  }

  function applyFilter(q) {
    const qq = String(q || '').trim().toLowerCase();
    if (!qq) {
      render(allItems);
      setMeta(`共 ${allItems.length} 项`);
      return;
    }

    const next = allItems.filter((it) => {
      const n = it.name.toLowerCase();
      const s = it.slug.toLowerCase();
      return n.includes(qq) || s.includes(qq);
    });

    render(next);
    setMeta(`匹配 ${next.length} / ${allItems.length}`);
  }

  async function load(force = false) {
    if (!force && allItems.length) {
      applyFilter(searchEl?.value || '');
      return;
    }

    setMeta('加载中…');
    gridEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'none';

    const data = await fetchOptions();
    allItems = normalize(data?.items);
    applyFilter(searchEl?.value || '');
  }

  function getSelectedIds() {
    const ids = [];
    gridEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      if (cb.checked) {
        const n = Number(cb.value);
        if (Number.isFinite(n)) ids.push(n);
      }
    });
    return Array.from(new Set(ids));
  }

  function clearSelection() {
    gridEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => (cb.checked = false));
  }

  // wire search
  if (searchEl) {
    searchEl.addEventListener('input', () => applyFilter(searchEl.value));
  }

  return { load, applyFilter, getSelectedIds, clearSelection };
}
