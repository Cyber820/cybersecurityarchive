// apps/web/src/securitydomain.js

import { mountGlobalSearch } from './ui/global-search.js';

injectBaseStyles();
mountGlobalSearch(document.getElementById('globalSearch'));

const q = getPathTail('/securitydomain');
if (!q) {
  setText('#pageTitle', '网安领域');
  setText('#aliases', '（缺少领域标识）');
  setText('#description', '（缺少领域标识）');
} else {
  loadDomain(q);
}

async function loadDomain(q) {
  setText('#aliases', '（加载中）');
  setText('#description', '（加载中）');
  clearEl('#relatedProducts');

  try {
    const res = await fetch(`/api/domain/${encodeURIComponent(q)}`);
    if (!res.ok) {
      const t = await safeText(res);
      throw new Error(`HTTP ${res.status}: ${t || res.statusText}`);
    }
    const data = await res.json();

    const domain = data.domain || {};
    const title = domain.security_domain_name || domain.cybersecurity_domain_slug || q;
    setText('#pageTitle', `网安领域：${title}`);

    // aliases
    const aliases = Array.isArray(data.aliases) ? data.aliases : [];
    setText('#aliases', aliases.length ? aliases.join('、') : '（无）');

    // description
    const desc = domain.security_domain_description || '';
    setText('#description', desc.trim() ? desc : '（无）');

    // related products chips
    const products = Array.isArray(data.products) ? data.products : [];
    if (!products.length) {
      document.querySelector('#relatedProducts').innerHTML = '<div class="muted">（无）</div>';
    } else {
      for (const p of products) {
        const name = p.security_product_name || p.security_product_slug || String(p.security_product_id || '');
        const slug = p.security_product_slug;
        const a = document.createElement('a');
        a.className = 'chip chip-purple';
        a.textContent = name;
        a.href = slug ? `/securityproduct/${encodeURIComponent(slug)}` : '#';
        document.querySelector('#relatedProducts').appendChild(a);
      }
    }
  } catch (e) {
    setText('#aliases', '（无）');
    setText('#description', '（无）');
    document.querySelector('#relatedProducts').innerHTML = '';
    const err = document.createElement('div');
    err.className = 'error';
    err.textContent = `加载失败：${e?.message || e}`;
    document.querySelector('main').insertAdjacentElement('afterbegin', err);
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
    .chip-row{display:flex;flex-wrap:wrap;gap:10px;}
    .chip{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;text-decoration:none;border:1px solid transparent;}
    .chip-purple{background:rgba(124,58,237,0.12);border-color:rgba(124,58,237,0.22);color:#2a0a7a;}
    .chip-purple:hover{background:rgba(124,58,237,0.18);}
    .error{background:#fff5f5;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:10px 12px;margin:0 0 14px;}
  `;
  document.head.appendChild(style);
}
