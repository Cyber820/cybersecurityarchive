// apps/web/src/ui/multiselect-grid.js
/**
 * MultiSelectGrid（可搜索 + 固定3列 checkbox + “确认才生效”）
 *
 * 重点：为避免任何全局 CSS 干扰，本版本把“会影响对齐/显示”的关键布局
 * 全部用 inline style（node.style.xxx）强制写死。
 *
 * ⭐你要的“左顶格”不再依赖 CSS 选择器：
 * - grid 的 justify-items / padding-left / overflow
 * - row label 的 display:flex / gap / width / padding
 * - checkbox 的 margin
 * - text 的 white-space / overflow-wrap
 */

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;

    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "checked" && tag === "input") node.checked = !!v;
    else if (k === "disabled") node.disabled = !!v;
    else node.setAttribute(k, String(v));
  }

  for (const c of Array.isArray(children) ? children : [children]) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

function norm(s) {
  return (s ?? "").toString().trim();
}

function normalizeOptions(options) {
  const out = [];
  for (const it of options || []) {
    if (it == null) continue;
    if (typeof it === "string") {
      out.push({ id: it, name: it, description: null, slug: null });
      continue;
    }
    out.push({
      id: it.id ?? it.value ?? it.key,
      name: it.name ?? it.label ?? String(it.id ?? ""),
      description: it.description ?? it.desc ?? null,
      slug: it.slug ?? null,
    });
  }
  return out.filter((x) => x.id != null && String(x.name || "").trim().length > 0);
}

let __styleInjected = false;
function injectStyleOnce() {
  if (__styleInjected) return;
  __styleInjected = true;

  // 这些只负责“整体美观”；关键对齐用 inline style 强制
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
    .ia-ms-summary{ margin-top:8px; font-size:12px; color:rgba(0,0,0,.70); white-space:pre-wrap; }

    .ia-ms-panel{ margin-top:10px; border:1px solid rgba(0,0,0,.15); border-radius:12px; padding:10px; display:none; background:#fff; }
    .ia-ms-input{
      width:100%; box-sizing:border-box;
      border:1px solid rgba(0,0,0,.25); border-radius:10px;
      padding:8px 10px; font-size:14px;
    }
    .ia-ms-hint{ margin-top:6px; font-size:12px; color:rgba(0,0,0,.6); }

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
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}

export function createMultiSelectGrid(cfg) {
  injectStyleOnce();

  const {
    title,
    required = false,
    placeholder = "搜索并选择…",
    hint,
    options = [],
    // 搜索匹配用：可让用户输入 slug 搜索，但显示依然只显示 name
    searchText = (o) => `${o?.name ?? ""} ${o?.description ?? ""} ${o?.slug ?? ""}`.trim(),
    // 固定 3 列每列宽度（px）：你想滚动少就调小；想更舒适就调大
    colWidth = 280,
  } = cfg;

  const state = {
    isOpen: false,
    query: "",
    options: normalizeOptions(options),
    committed: new Set(), // string id
    draft: new Set(),
  };

  const root = el("div", { class: "ia-ms" });

  const titleEl = el("div", { class: "ia-ms-title" }, [
    title ?? "选择",
    required ? el("span", { html: " *", style: "color:#b00020" }) : null,
  ]);

  const btnClear = el("button", { class: "ia-ms-iconbtn", type: "button", html: "×", title: "清空" });
  const btnArrow = el("button", { class: "ia-ms-iconbtn", type: "button", html: "▾", title: "展开选择" });

  const head = el("div", { class: "ia-ms-head" }, [
    titleEl,
    el("div", { class: "ia-ms-actions" }, [btnClear, btnArrow]),
  ]);

  const summary = el("div", { class: "ia-ms-summary" }, "未选择");

  const panel = el("div", { class: "ia-ms-panel" });
  const input = el("input", { class: "ia-ms-input", type: "text", placeholder, autocomplete: "off" });
  const hintEl = el("div", { class: "ia-ms-hint" }, hint || "▾ 展开；勾选后点“确认”生效；点“取消”放弃本次改动。");
  const grid = el("div", {}); // 不给 class，避免被全局 CSS 命中（关键布局全部 inline）
  const empty = el("div", { class: "ia-ms-empty", style: "display:none" }, "无匹配结果");

  // ✅ 强制 grid 的布局（inline）
  grid.style.marginTop = "10px";
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = `repeat(3, ${colWidth}px)`; // 固定 3 列
  grid.style.columnGap = "12px";
  grid.style.rowGap = "6px";
  grid.style.justifyItems = "start"; // ←【左对齐核心：单元格内贴左】
  grid.style.alignItems = "start";
  grid.style.maxHeight = "320px";
  grid.style.overflowY = "auto";
  grid.style.overflowX = "auto";     // 允许横向滚动
  grid.style.paddingLeft = "0";      // 整体不左缩进
  grid.style.paddingRight = "6px";
  grid.style.boxSizing = "border-box";

  const btnConfirm = el("button", { class: "ia-btn ia-btn-primary", type: "button" }, "确认");
  const btnCancel = el("button", { class: "ia-btn", type: "button" }, "取消");
  const foot = el("div", { class: "ia-ms-foot" }, [btnCancel, btnConfirm]);

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
    if (!vals.length) summary.textContent = "未选择";
    else if (vals.length <= 6) summary.textContent = `已选：${vals.join("、")}`;
    else summary.textContent = `已选：${vals.length} 项`;
  }

  function render() {
    grid.innerHTML = "";
    const q = norm(state.query).toLowerCase();

    const filtered = state.options.filter((o) => {
      if (!q) return true;
      return searchText(o).toLowerCase().includes(q);
    });

    if (!filtered.length) {
      empty.style.display = "";
      return;
    }
    empty.style.display = "none";

    for (const opt of filtered) {
      const id = String(opt.id);
      const checked = state.draft.has(id);

      // 用 label 包住 checkbox + 文本（点击文本也能勾选）
      const row = el("label", {}, []);

      // ✅ 强制 row 的布局（inline）—— 不吃任何 label 全局 CSS
      row.style.width = "100%";                 // ←【左对齐核心：撑满单元格】
      row.style.display = "flex";
      row.style.alignItems = "flex-start";
      row.style.justifyContent = "flex-start";
      row.style.gap = "8px";
      row.style.cursor = "pointer";
      row.style.userSelect = "none";
      row.style.padding = "2px 0";              // ← 没有左 padding
      row.style.margin = "0";
      row.style.boxSizing = "border-box";

      const cb = el("input", {
        type: "checkbox",
        checked,
        onChange: (e) => {
          if (e.target.checked) state.draft.add(id);
          else state.draft.delete(id);
        },
      });

      // ✅ 强制 checkbox 的边距（inline）
      cb.style.margin = "0";
      cb.style.width = "14px";
      cb.style.height = "14px";
      cb.style.flex = "0 0 auto";

      const text = el("span", {}, opt.name); // ✅ 显示只显示 name

      // ✅ 强制文本正常显示（inline）
      text.style.flex = "1 1 auto";
      text.style.minWidth = "0";
      text.style.whiteSpace = "normal";        // ← 不会一字一行（除非列宽极小）
      text.style.overflowWrap = "anywhere";
      text.style.wordBreak = "normal";
      text.style.fontSize = "13px";
      text.style.color = "#111";
      text.style.lineHeight = "1.2";

      row.appendChild(cb);
      row.appendChild(text);

      grid.appendChild(row);
    }
  }

  function open() {
    state.isOpen = true;
    state.draft = new Set(state.committed);
    state.query = "";
    panel.style.display = "block";
    btnArrow.innerHTML = "▴";
    btnArrow.title = "收起";
    input.value = "";
    render();
    input.focus();
  }

  function close({ commit = false } = {}) {
    if (commit) state.committed = new Set(state.draft);
    else state.draft = new Set(state.committed);

    state.isOpen = false;
    state.query = "";
    panel.style.display = "none";
    btnArrow.innerHTML = "▾";
    btnArrow.title = "展开选择";
    setSummary();
  }

  // events
  btnArrow.addEventListener("click", () => {
    if (state.isOpen) close({ commit: false });
    else open();
  });

  btnClear.addEventListener("click", () => {
    state.committed.clear();
    state.draft.clear();
    state.query = "";
    setSummary();
    if (state.isOpen) render();
  });

  input.addEventListener("input", () => {
    state.query = input.value;
    render();
  });

  btnConfirm.addEventListener("click", () => close({ commit: true }));
  btnCancel.addEventListener("click", () => close({ commit: false }));

  document.addEventListener("click", (e) => {
    if (!root.contains(e.target)) {
      if (state.isOpen) close({ commit: false });
    }
  });

  setSummary();

  return {
    element: root,
    getValues: () => [...state.committed],
    setOptions: (next) => {
      state.options = normalizeOptions(next);
      if (state.isOpen) render();
      setSummary();
    },
    setValues: (ids) => {
      state.committed = new Set((ids || []).map((x) => String(x)));
      state.draft = new Set(state.committed);
      setSummary();
      if (state.isOpen) render();
    },
    clear: () => {
      state.committed.clear();
      state.draft.clear();
      state.query = "";
      setSummary();
      if (state.isOpen) render();
    },
    open,
    close,
  };
}
