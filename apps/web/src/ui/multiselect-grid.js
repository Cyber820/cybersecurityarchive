// apps/web/src/ui/multiselect-grid.js
/**
 * MultiSelectGrid（可搜索 + 三列 checkbox + “确认才生效”）
 *
 * UI 目标：
 * - 收起态：标题 + 已选摘要 + 清空(×) + 展开(▾)
 * - 展开态：搜索框 + 三列 checkbox 列表 + 确认/取消
 * - 勾选只影响 draft；点“确认”才写入 committed
 *
 * ✅ 本版修复：
 * 1) “每行只有一个字” —— 给 grid 列设置最小宽度 minmax(220px, 1fr)，避免列被压到极窄
 * 2) “checkbox 不左顶格” —— 去掉 row 左 padding，grid 加 padding-left:0，并强制 checkbox margin:0
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

  /* ✅ 三列网格：每列有最小宽度，避免被压到“一行一个字” */
  .ia-ms-grid{
    margin-top:10px;
    display:grid;
    grid-template-columns: repeat(3, minmax(220px, 1fr));
    column-gap: 12px;
    row-gap: 4px;
    align-items:start;
    max-height: 320px;
    overflow:auto;
    padding-left: 0;      /* ✅ 左顶格 */
    padding-right: 4px;
  }
  @media (max-width: 900px){
    .ia-ms-grid{ grid-template-columns: repeat(2, minmax(220px, 1fr)); }
  }
  @media (max-width: 520px){
    .ia-ms-grid{ grid-template-columns: 1fr; }
  }

  /* ✅ 行内布局：取消左 padding，checkbox + 文字紧贴 */
  .ia-ms-row{
    display:flex;
    align-items:flex-start;
    justify-content:flex-start;
    gap:8px;
    cursor:pointer;
    user-select:none;
    padding:2px 0;        /* ✅ 原来会有左侧 padding，导致不顶格 */
    border-radius:8px;
    color:#111;
    line-height:1.2;
  }
  .ia-ms-row:hover{ background:rgba(0,0,0,.05); }

  .ia-ms-row > input[type="checkbox"]{
    margin:0 !important;  /* ✅ 强制清零，避免 UA 样式/全局 reset 干扰 */
    flex:0 0 auto;
    width:14px; height:14px;
  }
  .ia-ms-text{
    flex:1 1 auto;
    min-width:0;
    white-space:normal;
    word-break:break-word;
    color:#111;
    font-size:13px;
  }
  .ia-ms-desc{ opacity:.7; font-size:12px; }

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

/**
 * @param {object} cfg
 * @param {string} cfg.title
 * @param {boolean} [cfg.required=false]
 * @param {string} [cfg.placeholder='搜索并选择…']
 * @param {string} [cfg.hint]
 * @param {Array} [cfg.options=[]]  // {id,name,description?,slug?} or string
 * @param {function(item):string} [cfg.searchText] // 默认 name+description+slug（仅用于搜索，不影响显示）
 */
export function createMultiSelectGrid(cfg) {
  injectStyleOnce();

  const {
    title,
    required = false,
    placeholder = '搜索并选择…',
    hint,
    options = [],
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

      // ✅ 显示：只显示 opt.name（不显示 slug/desc）
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

  // events
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
    getValues: () => [...state.committed], // string ids
    setOptions: (next) => { state.options = normalizeOptions(next); if (state.isOpen) render(); setSummary(); },
    setValues: (ids) => { state.committed = new Set((ids || []).map((x) => String(x))); state.draft = new Set(state.committed); setSummary(); if (state.isOpen) render(); },
    clear: () => { state.committed.clear(); state.draft.clear(); state.query=''; setSummary(); if (state.isOpen) render(); },
    open,
    close,
  };
}
