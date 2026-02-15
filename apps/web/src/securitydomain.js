// apps/web/src/securitydomain.js
import { mountGlobalSearch } from './ui/globalSearch.js';

const $ = (id) => document.getElementById(id);

function normalizeQ(raw) {
  let q = String(raw ?? '').trim();
  if (q.toLowerCase().endsWith('.html')) q = q.slice(0, -5);
  return q;
}

function getQFromPath() {
  const parts = (location.pathname || '').split('/').filter(Boolean);
  const idx = parts.indexOf('securitydomain');
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

function clearRelatedProducts() {
  const box = $('relatedProducts');
  if (box) box.innerHTML = '';
  const empty = $('relatedProductsEmpty');
  if (empty) empty.style.display = 'none';
}

function renderRelatedProducts(items) {
  const box = $('relatedProducts');
  const empty = $('relatedProductsEmpty');
  if (!box || !empty) return;

  box.innerHTML = '';
  if (!Array.isArray(items) || items.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  for (const p of items) {
    const name = p?.security_product_name || '（未命名产品）';
    const slug = p?.security_product_slug || '';
    const target = slug || name; // slug 优先，否则用 name（后端 /api/product 支持 name 精确匹配）
    const url = `/securityproduct/${encodeURIComponent(target)}`;

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

async function loadDomain(qRaw) {
  const q = normalizeQ(qRaw);
  if (!q) {
    setText('pageTitle', '网安领域：—');
    setKV('domainAliases', '');
    setKV('domainDesc', '');
    setText('domainStatus', '请输入 /securitydomain/<slug 或领域名> 访问。');
    clearRelatedProducts();
    return;
  }

  setKV('domainAliases', '加载中…');
  setKV('domainDesc', '加载中…');
  setText('domainStatus', '');
  clearRelatedProducts();

  const url = `/api/domain/${encodeURIComponent(q)}`;

  let res, text, data;
  try {
    res = await fetch(url);
    text = await res.text();
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
  } catch (e) {
    setText('pageTitle', `网安领域：${q}`);
    setKV('domainAliases', '');
    setKV('domainDesc', '');
    setText('domainStatus', `❌ 加载失败：网络错误：${String(e?.message || e)}`);
    return;
  }

  if (!res.ok) {
    setText('pageTitle', `网安领域：${q}`);
    setKV('domainAliases', '');
    setKV('domainDesc', '');
    setText('domainStatus', `❌ 加载失败：HTTP ${res.status}（${data?.error || 'unknown'}）`);
    return;
  }

  // 1) 标题：优先 domain_name（兼容两种字段名）
  const domainName = data?.cybersecurity_domain_name || data?.security_domain_name || '（未命名领域）';
  setText('pageTitle', `网安领域：${domainName}`);

  // 4) aliases
  const aliases = Array.isArray(data?.aliases) ? data.aliases : [];
  setKV('domainAliases', aliases.length ? aliases.join('、') : '');

  // 5) description（兼容两种字段名）
  setKV('domainDesc', data?.security_domain_description || data?.cybersecurity_domain_description || '');

  // 3) 关联安全产品
  renderRelatedProducts(Array.isArray(data?.related_products) ? data.related_products : []);

  // 如果用户输入了 .html，纠正地址栏
  const qPath = getQFromPath();
  const normalized = normalizeQ(qPath);
  if (normalized && normalized !== qPath) {
    history.replaceState(null, '', `/securitydomain/${encodeURIComponent(normalized)}`);
  }
}

function init() {
  mountGlobalSearch('globalSearch');
  const q = normalizeQ(getQFromPath());
  loadDomain(q);
}

init();
