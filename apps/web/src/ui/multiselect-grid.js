// apps/web/src/ui/multiselect-grid.js
/**
 * MultiSelectGrid（可搜索 + 固定3列 checkbox + “确认才生效”）
 *
 * 需求：
 * - 固定 3 列（允许横向滚动）
 * - checkbox 左顶格
 * - 文字正常显示（不再一字一行竖排）
 * - 列表只显示 name（不显示 slug），slug 仅用于搜索（由上层 searchText 决定）
 *
 * ✅ 修复要点：
 * 1) 固定3列时，必须给列一个“可读的列宽”，否则列会被压到极窄导致竖排
 *    -> grid-template-columns: repeat(3, 260px)（可调）
 *    -> overflow-x: auto
 *
 * 2) checkbox 左顶格
 *    -> justify-items: start
 *    -> row width:100% + padding-left:0
 *    -> checkbox margin:0 !important
 */

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;

    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'checked' && tag === 'input') node.checked = !!v;
    else if (k === 'disabled') node.disabled = !!v;
    else node.setAttribute(k, String(v));
  }

  for (const c of Array.isArray(children) ? children : [children]) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

function norm(s) {
  return (s ?? '').toString().trim();
}

function normalizeOptions(options) {
  const out = [];
  for (const it of options || []) {
    if (it == null) continue;
    if (typeof it === 'string') {
      out.push({ id: it, name: it, description: null, slug: null });
      continue;
    }
    out.push({
      id: it.id ?? it.value ?? it.key,
      name: it.name ?? it.label ?? String(it.id ?? ''),
      description: it.description ?? it.desc ?? null,
      slug: it.slug ?? null,
    });
  }
  return out.filter((x) => x.id != null && String(x.name || '').trim().length > 0);
}

let __msStyleInjected = false;
function injectStyleOnce() {
  if (__msStyleInjected) return;
  __msStyleInjected = true;

  // ✅ 你可以只调整这里的列宽
  const COL_W = 260; // 每列宽度（px）：觉得挤就 280/300；想少滚动就 220/240

  const css = `
  .ia-ms { border:1px solid rgba(0,0,0,.20); border-radius:12px; padding:10px; box-sizing:border-box; }
  .ia-ms-head{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .ia-ms-title{ font-size:13px; font-weight:700; }
  .ia-ms-actions{ display:flex; gap:8px; align-items:center; }
  .ia-ms-iconbtn{
    border:1px solid rgba(0,0,0,.25); background:#fff; border-radius:999px;
    width:30px; height:30px; cursor:pointer;
    display:inline-flex; align-items:center; justify-content:center;
    font-size:14px; line-height:1;
  }
  .ia-ms-iconbtn:disabled{ opacity:.6; cursor:not-allowed; }
  .ia-ms-summary{ margin-top:8px; font-size:12px; color:rgba(0,0,0,.70); white-space:pre-wrap; }

  .ia-ms-panel{ margin-top:10px; border:1px solid rgba(0,0,0,.15); border-radius:12px; padding:10px; display:none; background:#fff; }
  .ia-ms-input{
    width:100%; box-sizing:border-box;
    border:1px solid rgba(0,0,0,.25); border-radius:10px;
    padding:8px 10px; font-size:14px;
  }
  .ia-ms-hint{ margin-top:6px; font-size:12px; color:rgba(0,0,0,.6); }

  /* ✅ 固定3列 + 允许横向滚动 */
  .ia-ms-grid{
    margin-top:10px;
    display:grid;

    grid-template-columns: repeat(3, ${COL_W}px);  /* ✅ 固定列宽，防止被压到一字一行 */
    column-gap: 12px;
    row-gap: 6px;

    justify-items: start; /* ✅ item 贴左 */
    align-items: start;

    max-height: 320px;
    overflow-y: auto;
    overflow-x: auto;     /* ✅ 横向滚动 */

    padding-left: 0;
    padding-right: 6px;
  }

  /* ✅ 行：撑满单元格，checkbox 真正左顶格 */
  .ia-ms-row{
    width: 100%;
    display:flex;
    align-items:flex-start;
    justify-content:flex-start;
    gap:8px;
    cursor:pointer;
    user-select:none;
    padding:2px 0;        /* ✅ 取消左 padding */
    border-radius:8px;
    color:#111;
    line-height:1.2;
    box-sizing:border-box;
  }
  .ia-ms-row:hover{ background:rgba(0,0,0,.05); }

  .ia-ms-row > input[type="checkbox"]{
    margin:0 !important;
    flex:0 0 auto;
    width:14px; height:14px;
  }

  .ia-ms-text{
    flex:1 1 auto;
    min-width:0;
    white-space: normal;      /* ✅ 正常换行（按词/字） */
    overflow-wrap: anywhere;  /* ✅ 极端长词也能断开 */
    color:#111;
    font-size:13px;
  }

  .ia-ms-empty{ padding:10px; font-size:12px; color:rgba(0,0,0,.6); }

  .ia-ms-foot{
    margin-top:10px;
    display:flex;
    justify-content:flex-end;
    gap:10px;
    position: sticky;
    bottom: -10px;
    padding-top: 10px;
    background:#fff;
    border-top:1px solid rgba(0,0,0,.08);
  }
  .ia-btn{
    border:1px solid rgba(0,0,0,.25); background:#fff; border-radius:10px;
    padding:8px 12px; cursor:pointer; font-size:13px;
  }
  .ia-btn-primary{ border-color:rgba(0,0,0,.45); font-weight:700; }
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

export function createMultiSelectGrid(cfg) {
  injectStyleOnce();

  const {
    title,
    required = false,
    placeholder = '搜索并选择…',
    hint,
    options = [],
    // 默认搜索字段：name/description/slug；你在 admin.js 里可覆盖为 name+slug
    searchText = (o) => `${o?.name ?? ''} ${o?.description ?? ''} ${o?.slug ?? ''}`.trim(),
  } = cfg;

  const state = {
    isOpen: false,
    query: '',
    options: normalizeOptions(options),
    committed: new Set(), // string id
    draft: new Set(),     // string id
  };

  const root = el('div', { class: 'ia-ms' });

  const titleEl = el('div', { class: 'ia-ms-title' }, [
    title ?? '选择',
    required ? el('span', { html: ' *', style: 'color:#b00020' }) : null,
  ]);

  const btnClear = el('button', { class: 'ia-ms-iconbtn', type: 'button', html: '×', title: '清空' });
  const btnArrow = el('button', { class: 'ia-ms-iconbtn', type: 'button', html: '▾', title: '展开选择' });

  const head = el('div', { class: 'ia-ms-head' }, [
    titleEl,
    el('div', { class: 'ia-ms-actions' }, [btnClear, btnArrow]),
  ]);

  const summary = el('div', { class: 'ia-ms-summary' }, '未选择');

  const panel = el('div', { class: 'ia-ms-panel' });
  const input = el('input', { class: 'ia-ms-input', type: 'text', placeholder, autocomplete: 'off' });
  const hintEl = el('div', { class: 'ia-ms-hint' }, hint || '▾ 展开；勾选后点“确认”生效；点“取消”放弃本次改动。');
  const grid = el('div', { class: 'ia-ms-grid' });
  const empty = el('div', { class: 'ia-ms-empty', style: 'display:none' }, '无匹配结果');

  const btnConfirm = el('button', { class: 'ia-btn ia-btn-primary', type: 'button' }, '确认');
  const btnCancel = el('button', { class: 'ia-btn', type: 'button' }, '取消');
  const foot = el('div', { class: 'ia-ms-foot' }, [btnCancel, btnConfirm]);

  panel.appendChild(input);
  panel.appendChild(hintEl);
  panel.appendChild(grid);
  panel.appendChild(empty);
  panel.appendChild(foot);

  root.appendChild(head);
  root.appendChild(summary);
  root.appendChild(panel);

  function buildMap() {
    const m = new Map();
    for (const o of state.options) m.set(String(o.id), o);
    return m;
  }

  function setSummary() {
    const m = buildMap();
    const vals = [...state.committed].map((id) => m.get(String(id))?.name || String(id));
    if (!vals.length) summary.textContent = '未选择';
    else if (vals.length <= 6) summary.textContent = `已选：${vals.join('、')}`;
    else summary.textContent = `已选：${vals.length} 项`;
  }

  function render() {
    grid.innerHTML = '';
    const q = norm(state.query).toLowerCase();

    const filtered = state.options.filter((o) => {
      if (!q) return true;
      return searchText(o).toLowerCase().includes(q);
    });

    if (!filtered.length) {
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';

    for (const opt of filtered) {
      const id = String(opt.id);
      const checked = state.draft.has(id);

      // ✅ 显示只显示 name（不显示 slug）
      const row = el('label', { class: 'ia-ms-row' }, [
        el('input', {
          type: 'checkbox',
          checked,
          onChange: (e) => {
            if (e.target.checked) state.draft.add(id);
            else state.draft.delete(id);
          },
        }),
        el('span', { class: 'ia-ms-text' }, opt.name),
      ]);

      grid.appendChild(row);
    }
  }

  function open() {
    state.isOpen = true;
    state.draft = new Set(state.committed);
    state.query = '';
    panel.style.display = 'block';
    btnArrow.innerHTML = '▴';
    btnArrow.title = '收起';
    input.value = '';
    render();
    input.focus();
  }

  function close({ commit = false } = {}) {
    if (commit) state.committed = new Set(state.draft);
    else state.draft = new Set(state.committed);

    state.isOpen = false;
    state.query = '';
    panel.style.display = 'none';
    btnArrow.innerHTML = '▾';
    btnArrow.title = '展开选择';
    setSummary();
  }

  btnArrow.addEventListener('click', () => {
    if (state.isOpen) close({ commit: false });
    else open();
  });

  btnClear.addEventListener('click', () => {
    state.committed.clear();
    state.draft.clear();
    state.query = '';
    setSummary();
    if (state.isOpen) render();
  });

  input.addEventListener('input', () => {
    state.query = input.value;
    render();
  });

  btnConfirm.addEventListener('click', () => close({ commit: true }));
  btnCancel.addEventListener('click', () => close({ commit: false }));

  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) {
      if (state.isOpen) close({ commit: false });
    }
  });

  setSummary();

  return {
    element: root,
    getValues: () => [...state.committed],
    setOptions: (next) => { state.options = normalizeOptions(next); if (state.isOpen) render(); setSummary(); },
    setValues: (ids) => { state.committed = new Set((ids || []).map((x) => String(x))); state.draft = new Set(state.committed); setSummary(); if (state.isOpen) render(); },
    clear: () => { state.committed.clear(); state.draft.clear(); state.query=''; setSummary(); if (state.isOpen) render(); },
    open,
    close,
  };
}
