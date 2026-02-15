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

async function loadDomain(qRaw) {
  const q = normalizeQ(qRaw);
  if (!q) {
    setText('pageTitle', `网安领域：'—'`);
    setKV('domainAliases', '');
    setKV('domainDesc', '');
    setText('domainStatus', '请输入 /securitydomain/<slug 或领域名> 访问。');
    return;
  }

  setKV('domainAliases', '加载中…');
  setKV('domainDesc', '加载中…');
  setText('domainStatus', '');

  const url = `/api/domain/${encodeURIComponent(q)}`;

  let res, text, data;
  try {
    res = await fetch(url);
    text = await res.text();
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
  } catch (e) {
    setText('pageTitle', `网安领域：'${q}'`);
    setKV('domainAliases', '');
    setKV('domainDesc', '');
    setText('domainStatus', `❌ 加载失败：网络错误：${String(e?.message || e)}`);
    return;
  }

  if (!res.ok) {
    setText('pageTitle', `网安领域：'${q}'`);
    setKV('domainAliases', '');
    setKV('domainDesc', '');
    setText('domainStatus', `❌ 加载失败：HTTP ${res.status}（${data?.error || 'unknown'}）`);
    return;
  }

  // 优先使用返回的 slug / name
  const slug = data?.cybersecurity_domain_slug || q;
  const name = data?.security_domain_name || '（未命名领域）';

  setText('pageTitle', `网安领域：'${slug}'`);
  setText('domainNameA', `（${name}）`);
  setText('domainNameB', `（${name}）`);

  // 4) aliases
  const aliases = Array.isArray(data?.aliases) ? data.aliases : [];
  const aliasText = aliases.length ? aliases.join('、') : '（无）';
  setKV('domainAliases', aliasText);

  // 5) description
  setKV('domainDesc', data?.security_domain_description || '');

  // 如果用户输入了 .html，纠正地址栏
  const qPath = getQFromPath();
  const normalized = normalizeQ(qPath);
  if (normalized && normalized !== qPath) {
    history.replaceState(null, '', `/securitydomain/${encodeURIComponent(normalized)}`);
  }
}

function init() {
  // 3) 全站搜索组件（每个页面都复用）
  mountGlobalSearch('globalSearch');

  const q = normalizeQ(getQFromPath());
  loadDomain(q);
}

init();
