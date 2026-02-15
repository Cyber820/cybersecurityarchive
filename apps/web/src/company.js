// apps/web/src/company.js

import { mountGlobalSearch } from './ui/global-search.js';

injectBaseStyles();
mountGlobalSearch(document.getElementById('globalSearch'));

const q = getPathTail('/company');
if (!q) {
  setText('#pageTitle', '企业/机构');
  setText('#baseInfo', '（缺少企业标识）');
  setText('#description', '（缺少企业标识）');
} else {
  loadCompany(q);
}

// modal
const $modal = document.getElementById('devModal');
const $modalClose = document.getElementById('devModalClose');
if ($modal && $modalClose) {
  $modalClose.addEventListener('click', () => ($modal.style.display = 'none'));
  $modal.addEventListener('click', (e) => {
    if (e.target === $modal) $modal.style.display = 'none';
  });
}

function openDevModal() {
  if ($modal) $modal.style.display = '';
}

async function loadCompany(q) {
  clearEl('#featuredProducts');
  clearEl('#otherProducts');
  setText('#baseInfo', '（加载中）');
  setText('#description', '（加载中）');

  try {
    const res = await fetch(`/api/company/${encodeURIComponent(q)}`);
    if (!res.ok) {
      const t = await safeText(res);
      throw new Error(`HTTP ${res.status}: ${t || res.statusText}`);
    }
    const data = await res.json();
    const c = data.company || {};
    const title = c.organization_short_name || c.organization_full_name || c.organization_slug || q;
    setText('#pageTitle', title);

    // base info
    const lines = [];
    lines.push(`企业全称：${c.organization_full_name || '（无）'}`);
    lines.push(`成立时间：${c.establish_year ?? '（无）'}`);
    // 需求：未上市就不显示“最近融资：”这一行
    if (c.if_ipo === true) {
      lines.push('最近融资：已上市');
    }
    setText('#baseInfo', lines.join('\n'));

    // description
    const desc = c.organization_description || '';
    setText('#description', desc.trim() ? desc : '（无）');

    // products
    const products = Array.isArray(data.products) ? data.products : [];
    const featured = products.filter((p) => (p.recommendation_score ?? 0) >= 6);
    const other = products.filter((p) => (p.recommendation_score ?? 0) < 6);

    renderProducts('#featuredProducts', featured, { color: 'blue', clickMode: 'modal' });
    renderProducts('#otherProducts', other, { color: 'gray', clickMode: 'modal' });
  } catch (e) {
    setText('#baseInfo', '（无）');
    setText('#description', '（无）');
    const err = document.createElement('div');
    err.className = 'error';
    err.textContent = `加载失败：${e?.message || e}`;
    document.querySelector('main').insertAdjacentElement('afterbegin', err);
  }
}

function renderProducts(sel, items, { color, clickMode }) {
  const el = document.querySelector(sel);
  if (!el) return;
  el.innerHTML = '';
  if (!items.length) {
    el.innerHTML = '<div class="muted">（无）</div>';
    return;
  }

  for (const p of items) {
    const name = p.security_product_name || p.security_product_slug || String(p.security_product_id || '');
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `chip ${color === 'blue' ? 'chip-blue' : 'chip-gray'}`;
    // 需求：不显示评分
    chip.textContent = name;
    chip.addEventListener('click', () => {
      if (clickMode === 'modal') openDevModal();
    });
    el.appendChild(chip);
  }
}

function getPathTail(prefix) {
  const path = window.location.pathname || '';
  const idx = path.indexOf(prefix);
  if (idx === -1) return '';
  const tail = path.slice(idx + prefix.length).replace(/^\/+/, '');
  return decodeURIComponent(tail || '').trim();
}

function setText(sel, text) {
  const el = document.querySelector(sel);
  if (el) el.textContent = text;
}

function clearEl(sel) {
  const el = document.querySelector(sel);
  if (el) el.innerHTML = '';
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

function injectBaseStyles() {
  if (document.getElementById('baseStyles')) return;
  const style = document.createElement('style');
  style.id = 'baseStyles';
  style.textContent = `
    :root{--bg:#f6f7fb;--card:#fff;--border:#e6e8ef;--text:#111;--muted:#6b7280;--purple:#6d28d9;--purple2:#7c3aed;--blue:#2563eb;--blue2:#3b82f6;}
    body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; background:var(--bg); color:var(--text);}
    .page{max-width:980px;margin:32px auto;padding:0 16px 48px;}
    .page-title{font-size:34px;letter-spacing:0.2px;margin:0 0 18px;}
    .card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px 18px;margin:14px 0;}
    .card-title{font-size:18px;margin:0 0 10px;}
    .kv{line-height:1.7;white-space:pre-wrap;}
    .muted{color:var(--muted);}
    .grid-2{display:grid;grid-template-columns:1fr;gap:14px;}
    @media (min-width:860px){.grid-2{grid-template-columns:1fr 1fr;}}
    .chip-row{display:flex;flex-wrap:wrap;gap:10px;}
    .chip{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;text-decoration:none;border:1px solid transparent;cursor:pointer;background:#fff;}
    .chip-blue{background:rgba(59,130,246,0.12);border-color:rgba(59,130,246,0.22);color:#0a2c6a;}
    .chip-blue:hover{background:rgba(59,130,246,0.18);}
    .chip-gray{background:rgba(148,163,184,0.12);border-color:rgba(148,163,184,0.22);color:#1f2937;}
    .chip-gray:hover{background:rgba(148,163,184,0.18);}
    .error{background:#fff5f5;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:10px 12px;margin:0 0 14px;}
    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;}
    .modal{width:min(520px,100%);background:#fff;border:1px solid rgba(0,0,0,0.15);border-radius:14px;padding:14px;}
    .modal-title{font-size:16px;font-weight:700;margin-bottom:8px;}
    .modal-body{color:var(--muted);line-height:1.6;}
    .modal-actions{display:flex;justify-content:flex-end;margin-top:12px;}
    .btn{border:1px solid var(--border);background:#fff;border-radius:10px;padding:8px 12px;cursor:pointer;}
    .btn:hover{background:#f8fafc;}
  `;
  document.head.appendChild(style);
}
