// apps/web/src/securityproduct.js

import { mountGlobalSearch } from './ui/global-search.js';

injectBaseStyles();
mountGlobalSearch(document.getElementById('globalSearch'));

const q = getPathTail('/securityproduct');
if (!q) {
  setText('#pageTitle', '安全产品');
  setText('#aliases', '（缺少产品标识）');
  setText('#description', '（缺少产品标识）');
} else {
  loadProduct(q);
}

async function loadProduct(q) {
  setText('#aliases', '（加载中）');
  setText('#description', '（加载中）');
  clearEl('#relatedDomains');
  clearEl('#recCompaniesCn');

  try {
    const res = await fetch(`/api/product/${encodeURIComponent(q)}`);
    if (!res.ok) {
      const t = await safeText(res);
      throw new Error(`HTTP ${res.status}: ${t || res.statusText}`);
    }
    const data = await res.json();
    const product = data.product || {};

    const name = product.security_product_name || product.security_product_slug || q;
    setText('#pageTitle', `安全产品：${name}`);
    setText('#introTitle', `${name}介绍`);

    // aliases
    const aliases = Array.isArray(data.aliases) ? data.aliases : [];
    setText('#aliases', aliases.length ? aliases.join('、') : '（无）');

    // description
    const desc = product.security_product_description || '';
    setText('#description', desc.trim() ? desc : '（无）');

    // related domains chips
    const domains = Array.isArray(data.domains) ? data.domains : [];
    if (!domains.length) {
      document.querySelector('#relatedDomains').innerHTML = '<div class="muted">（无）</div>';
    } else {
      for (const d of domains) {
        const label = d.security_domain_name || d.cybersecurity_domain_slug || String(d.security_domain_id || '');
        const slug = d.cybersecurity_domain_slug;
        const a = document.createElement('a');
        a.className = 'chip chip-purple';
        a.textContent = label;
        a.href = slug ? `/securitydomain/${encodeURIComponent(slug)}` : '#';
        document.querySelector('#relatedDomains').appendChild(a);
      }
    }

    // recommended companies (CN)
    const rec = Array.isArray(data.recommended_companies_cn) ? data.recommended_companies_cn : [];
    if (!rec.length) {
      document.querySelector('#recCompaniesCn').innerHTML = '<div class="muted">（无）</div>';
    } else {
      for (const c of rec) {
        const label = c.organization_short_name || c.organization_slug || String(c.organization_id || '');
        const slug = c.organization_slug;
        const a = document.createElement('a');
        a.className = 'chip chip-blue';
        a.textContent = label;
        a.href = slug ? `/company/${encodeURIComponent(slug)}` : '#';
        document.querySelector('#recCompaniesCn').appendChild(a);
      }
    }
  } catch (e) {
    setText('#aliases', '（无）');
    setText('#description', '（无）');
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
    .grid-2{display:grid;grid-template-columns:1fr;gap:14px;}
    @media (min-width:860px){.grid-2{grid-template-columns:1fr 1fr;}}
    .chip-row{display:flex;flex-wrap:wrap;gap:10px;}
    .chip{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;text-decoration:none;border:1px solid transparent;}
    .chip-purple{background:rgba(124,58,237,0.12);border-color:rgba(124,58,237,0.22);color:#2a0a7a;}
    .chip-purple:hover{background:rgba(124,58,237,0.18);}
    .chip-blue{background:rgba(59,130,246,0.12);border-color:rgba(59,130,246,0.22);color:#0a2c6a;}
    .chip-blue:hover{background:rgba(59,130,246,0.18);}
    .error{background:#fff5f5;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:10px 12px;margin:0 0 14px;}
  `;
  document.head.appendChild(style);
}
