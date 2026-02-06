// apps/web/src/ui/multiselect-grid.js
/**
 * MultiSelectGrid（可搜索 + 固定3列 checkbox + “确认才生效”）
 *
 * 目标：
 * - 固定 3 列（你接受横向滚动）
 * - checkbox 在每列内部“真正左顶格”
 * - 文字正常横排显示（不会一字一行竖排）
 * - 列表只显示 name（不显示 slug），slug 仅用于搜索（由上层 searchText 决定）
 *
 * ⭐ “左对齐/顶格”由三件事共同决定：
 *  A) .ia-ms-grid { justify-items: start; }   <-- 【最关键】让 grid item 在单元格内贴左
 *  B) .ia-ms-row  { width: 100%; }           <-- 让 label 撑满单元格宽度，避免内容在中间漂
 *  C) checkbox    { margin:0 !important; }   <-- 抢回浏览器/全局CSS给 checkbox 的默认外边距
 */

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;

    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'checked' && tag === 'input') node.checked = !!v;
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

/**
 * 将 options 统一成 {id, name, description?, slug?}
 */
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

  // 必须有 id + name
  return out.filter((x) => x.id != null && String(x.name || '').trim().length > 0);
}

let __msStyleInjected = false;

/**
 * 注入一次样式（组件自带 CSS）
 * 如果你遇到“还是不左顶格”，90% 是全局 CSS 覆盖。
 * 所以本版本增加了更强的选择器 + !important 来夺回控制权。
 */
function injectStyleOnce() {
  if (__msStyleInjected) return;
  __msStyleInjected = true;

  // ✅ 固定 3 列时每列宽度。越大越不容易挤成竖排，但横向滚动越多。
  const COL_W = 280;

  const css = `
  /* =========================
   * 容器与头部
   * ========================= */
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
  .ia-ms-summary{ margin-top:8px; font-size:12px; color:rgba(0,0,0,.70); white-space:pre-wrap; }

  .ia-ms-panel{ margin-top:10px; border:1px solid rgba(0,0,0,.15); border-radius:12px; padding:10px; display:none; background:#fff; }
  .ia-ms-input{
    width:100%; box-sizing:border-box;
    border:1px solid rgba(0,0,0,.25); border-radius:10px;
    padding:8px 10px; font-size:14px;
  }
  .ia-ms-hint{ margin-top:6px; font-size:12px; color:rgba(0,0,0,.6); }

  /* =========================
   * 核心：固定 3 列 grid
   * ========================= */
  .ia-ms-grid{
    margin-top:10px;
    display:grid;

    /* ✅ 固定 3 列并给列宽（避免列被压到“一个字一行”） */
    grid-template-columns: repeat(3, ${COL_W}px);

    column-gap: 12px;
    row-gap: 6px;

    /* ⭐【左对齐关键参数 #1】让每个 grid item 在“格子内”贴左 */
    justify-items: start !important;

    /* 顶部对齐 */
    align-items: start;

    max-height: 320px;
    overflow-y: auto;
    overflow-x: auto;  /* ✅ 允许横向滚动 */

    /* ⭐【左对齐关键参数 #2】grid 自身不要左 padding，不然整体会被推右 */
    padding-left: 0 !important;
    padding-right: 6px;
    box-sizing: border-box;
  }

  /* =========================
   * 每行（label）
   * ========================= */
  .ia-ms-row{
    grid-column: auto !important;
    display: flex !important;
    align-items: center;
    cursor: pointer;
    user-select: none;
    gap: 6px;
    padding: 2px 6px;
    padding-right: 4px;
    border-radius: 8px;
    color: #111;
    font-size: 10.5px;
    line-height: 1.15;
    justify-content: flex-start;
  }
  .ia-ms-row:hover{ background:rgba(0,0,0,.05); }

  /* =========================
   * checkbox 本体
   * ========================= */
  .ia-ms-row > input[type="checkbox"]{
    order: 1;
    margin-left: 0;
    margin-right: 0;
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
  }

  /* =========================
   * 文本
   * ========================= */
  .ia-ms-text{
order: 2;
    flex: 0 1 auto;
    min-width: 0;
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
    word-break: break-word;
    color: #111;
  }

  .ia-ms-empty{  grid-column: 1 / -1; padding: 10px; font-size: 12px; opacity: 0.75; color: #111; } 

  /* =========================
   * 底部按钮
   * ========================= */
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
 * createMultiSelectGrid
 *
 * @param {object} cfg
 * @param {string} cfg.title - 标题（UI显示）
 * @param {boolean} [cfg.required=false] - 是否必填（仅 UI 标识）
 * @param {string} [cfg.placeholder] - 搜索框 placeholder
 * @param {string} [cfg.hint] - 说明文字
 * @param {Array}  [cfg.options=[]] - 候选项：{id,name,slug?,description?} 或 string
 * @param {function(item):string} [cfg.searchText]
 *   - 搜索匹配用的文本拼接（不影响显示）
 *   - 你可以传 name+slug，让用户输入 slug 也能搜索，但显示仍只显示 name
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
    committed: new Set(), // 已生效选择（string id）
    draft: new Set(),     // 展开态临时选择（string id）
  };

  const root = el('div', { class: 'ia-ms' });

  // header
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

  // panel
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
    getValues: () => [...state.committed],
    setOptions: (next) => { state.options = normalizeOptions(next); if (state.isOpen) render(); setSummary(); },
    setValues: (ids) => { state.committed = new Set((ids || []).map((x) => String(x))); state.draft = new Set(state.committed); setSummary(); if (state.isOpen) render(); },
    clear: () => { state.committed.clear(); state.draft.clear(); state.query = ''; setSummary(); if (state.isOpen) render(); },
    open,
    close,
  };
}
