// apps/web/src/ui/multiselect-grid.js
/**
 * MultiSelectGrid（可搜索 + 固定3列 + 自绘checkbox + “确认才生效”）
 *
 * 为什么要自绘 checkbox？
 * - 原生 checkbox 在不同平台/缩放/DPI 下“绘制区域”会产生视觉偏移，
 *   即使布局已左顶格，也会看起来“不贴左”。
 * - 自绘后：方框从像素级贴左，观感统一。
 *
 * 左对齐的关键（本文件已强制）：
 * - grid.style.justifyItems = 'start'
 * - row.style.width = '100%'
 * - 自绘 box 不依赖 input 默认样式
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

/**
 * 创建“自绘 checkbox”
 * - 返回 { wrap, input, setChecked(boolean), getChecked() }
 * - input 仍存在用于可访问性/状态，但隐藏
 */
function createFakeCheckbox({ checked = false } = {}) {
  const wrap = document.createElement("span");
  // wrap 作为视觉 checkbox 容器：像素级可控
  wrap.style.display = "inline-flex";
  wrap.style.alignItems = "flex-start";
  wrap.style.justifyContent = "flex-start";
  wrap.style.width = "14px";
  wrap.style.height = "14px";
  wrap.style.flex = "0 0 auto";

  // 真 input：隐藏但保留可访问性/状态
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = !!checked;

  // 隐藏 input（但仍可通过 label 点击切换）
  input.style.position = "absolute";
  input.style.opacity = "0";
  input.style.pointerEvents = "none";
  input.style.width = "1px";
  input.style.height = "1px";
  input.style.margin = "0";

  // 视觉方框
  const box = document.createElement("span");
  box.style.display = "inline-block";
  box.style.width = "14px";
  box.style.height = "14px";
  box.style.boxSizing = "border-box";
  box.style.border = "1px solid rgba(0,0,0,.55)";
  box.style.borderRadius = "3px";
  box.style.background = "#fff";
  box.style.position = "relative";

  // 勾（用伪元素效果：一个小的旋转边框）
  const tick = document.createElement("span");
  tick.style.position = "absolute";
  tick.style.left = "3px";
  tick.style.top = "1px";
  tick.style.width = "6px";
  tick.style.height = "9px";
  tick.style.borderRight = "2px solid #111";
  tick.style.borderBottom = "2px solid #111";
  tick.style.transform = "rotate(40deg)";
  tick.style.display = checked ? "block" : "none";

  box.appendChild(tick);
  wrap.appendChild(box);
  wrap.appendChild(input);

  function setChecked(v) {
    input.checked = !!v;
    tick.style.display = input.checked ? "block" : "none";
  }
  function getChecked() {
    return !!input.checked;
  }

  // 同步：当 input 状态变化时更新 tick（以防 label 默认切换）
  input.addEventListener("change", () => setChecked(input.checked));

  return { wrap, input, setChecked, getChecked };
}

export function createMultiSelectGrid(cfg) {
  injectStyleOnce();

  const {
    title,
    required = false,
    placeholder = "搜索并选择…",
    hint,
    options = [],
    searchText = (o) => `${o?.name ?? ""} ${o?.description ?? ""} ${o?.slug ?? ""}`.trim(),
    colWidth = 280, // 固定3列每列宽度
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

  // grid（关键布局全部 inline，避免任何全局 CSS 干扰）
  const grid = document.createElement("div");
  grid.style.marginTop = "10px";
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = `repeat(3, ${colWidth}px)`; // 固定3列
  grid.style.columnGap = "12px";
  grid.style.rowGap = "6px";
  grid.style.justifyItems = "start"; // ← 左对齐核心
  grid.style.alignItems = "start";
  grid.style.maxHeight = "320px";
  grid.style.overflowY = "auto";
  grid.style.overflowX = "auto";
  grid.style.paddingLeft = "0";
  grid.style.paddingRight = "6px";
  grid.style.boxSizing = "border-box";

  const empty = el("div", { class: "ia-ms-empty", style: "display:none" }, "无匹配结果");

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

      // 行 label（点击文字也能切换）
      const row = document.createElement("label");
      row.style.width = "100%";                 // ← 行撑满单元格
      row.style.display = "flex";
      row.style.alignItems = "flex-start";
      row.style.justifyContent = "flex-start";
      row.style.gap = "8px";
      row.style.cursor = "pointer";
      row.style.userSelect = "none";
      row.style.padding = "2px 0";              // 无左 padding
      row.style.margin = "0";
      row.style.boxSizing = "border-box";

      // 自绘 checkbox（视觉方框 + 隐藏 input）
      const fake = createFakeCheckbox({ checked });

      // 文本（只显示 name，不显示 slug）
      const text = document.createElement("span");
      text.textContent = opt.name;
      text.style.flex = "1 1 auto";
      text.style.minWidth = "0";
      text.style.whiteSpace = "normal";
      text.style.overflowWrap = "anywhere";
      text.style.wordBreak = "normal";
      text.style.fontSize = "13px";
      text.style.color = "#111";
      text.style.lineHeight = "1.2";

      row.appendChild(fake.wrap);
      row.appendChild(text);

      // 当 input 状态变化时，同步到 draft
      fake.input.addEventListener("change", () => {
        const now = !!fake.input.checked;
        if (now) state.draft.add(id);
        else state.draft.delete(id);
      });

      // 允许点击整行时切换（部分浏览器对隐藏 input 点击区域不一致）
      row.addEventListener("click", (e) => {
        // 如果点击的是 input 本身，让默认行为走；否则手动切换
        if (e.target === fake.input) return;
        // 避免双触发：用 preventDefault + 手动 toggle
        e.preventDefault();
        fake.setChecked(!fake.getChecked());
        // 手动触发 change 同步 draft（上面监听 change）
        fake.input.dispatchEvent(new Event("change", { bubbles: true }));
      });

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
