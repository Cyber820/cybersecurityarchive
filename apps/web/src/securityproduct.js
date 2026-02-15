// apps/web/src/securityproduct.js
import { mountGlobalSearch } from './ui/globalSearch.js';

const $ = (id) => document.getElementById(id);

function normalizeQ(raw) {
  let q = String(raw ?? '').trim();
  if (q.toLowerCase().endsWith('.html')) q = q.slice(0, -5);
  return q;
}

function getQFromPath() {
  const parts = (location.pathname || '').split('/').filter(Boolean);
  const idx = parts.indexOf('securityproduct');
  if (idx < 0) return '';
  const q = parts.slice(idx + 1).join('/');
  try { return decodeURIComponent(q); } catch { return q; }
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function setKV(id, text) {
  const el = $(id);
  if (!el) return;
  const v = String(text ?? '').trim();
  if (!v) {
    el.textContent = '（无）';
    el.classList.add('empty');
    return;
  }
  el.textContent = v;
  el.classList.remove('empty');
}

function clearRelatedDomains() {
  const box = $('relatedDomains');
  if (box) box.innerHTML = '';
  const empty = $('relatedDomainsEmpty');
  if (empty) empty.style.display = 'none';
}

function renderRelatedDomains(items) {
  const box = $('relatedDomains');
  const empty = $('relatedDomainsEmpty');
  if (!box || !empty) return;

  box.innerHTML = '';
  if (!Array.isArray(items) || items.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  for (const d of items) {
    const name = d?.security_domain_name || '（未命名领域）';
    const slug = d?.cybersecurity_domain_slug || '';
    const target = slug || name;
    const url = `/securitydomain/${encodeURIComponent(target)}`;

    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = name;
    chip.setAttribute('role', 'link');
    chip.tabIndex = 0;
    chip.addEventListener('click', () => { location.href = url; });
    chip.addEventListener('keydown', (e) => { if (e.key === 'Enter') location.href = url; });

    box.appendChild(chip);
  }
}

async function loadProduct(qRaw) {
  const q = normalizeQ(qRaw);
  if (!q) {
    setText('pageTitle', '安全产品：—');
    setKV('productAliases', '');
    clearRelatedDomains();
    setText('productStatus', '请输入 /securityproduct/<slug 或产品名> 访问。');
    return;
  }

  setKV('productAliases', '加载中…');
  clearRelatedDomains();
  setText('productStatus', '');

  const url = `/api/product/${encodeURIComponent(q)}`;

  let res, text, data;
  try {
    res = await fetch(url);
    text = await res.text();
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
  } catch (e) {
    setText('pageTitle', `安全产品：${q}`);
    setKV('productAliases', '');
    clearRelatedDomains();
    setText('productStatus', `❌ 加载失败：网络错误：${String(e?.message || e)}`);
    return;
  }

  if (!res.ok) {
    setText('pageTitle', `安全产品：${q}`);
    setKV('productAliases', '');
    clearRelatedDomains();
    setText('productStatus', `❌ 加载失败：HTTP ${res.status}（${data?.error || 'unknown'}）`);
    return;
  }

  // 1) 标题：产品名称
  const productName = data?.security_product_name || '（未命名产品）';
  setText('pageTitle', `安全产品：${productName}`);

  // 3) aliases
  const aliases = Array.isArray(data?.aliases) ? data.aliases : [];
  setKV('productAliases', aliases.length ? aliases.join('、') : '');

  // 4) related domains chips
  renderRelatedDomains(Array.isArray(data?.related_domains) ? data.related_domains : []);

  // 纠正地址栏 .html
  const qPath = getQFromPath();
  const normalized = normalizeQ(qPath);
  if (normalized && normalized !== qPath) {
    history.replaceState(null, '', `/securityproduct/${encodeURIComponent(normalized)}`);
  }
}

function init() {
  mountGlobalSearch('globalSearch');
  const q = normalizeQ(getQFromPath());
  loadProduct(q);
}

init();
