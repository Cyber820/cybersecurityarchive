// apps/web/src/company.js
const $ = (id) => document.getElementById(id);

function normalizeQ(raw) {
  let q = String(raw ?? '').trim();
  if (q.toLowerCase().endsWith('.html')) q = q.slice(0, -5);
  return q;
}

function getQFromPath() {
  const parts = (location.pathname || '').split('/').filter(Boolean);
  const idx = parts.indexOf('company');
  if (idx < 0) return '';
  const q = parts.slice(idx + 1).join('/');
  try { return decodeURIComponent(q); } catch { return q; }
}

async function loadCompany(qRaw) {
  const q = normalizeQ(qRaw);
  const url = `/api/company/${encodeURIComponent(q)}`;

  $('q').textContent = q || '(空)';
  $('apiUrl').textContent = url;
  $('status').textContent = '加载中…';
  $('output').textContent = '';

  const res = await fetch(url);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    $('status').textContent = `❌ 失败：HTTP ${res.status}`;
    $('output').textContent = JSON.stringify(data, null, 2);
    return;
  }

  $('status').textContent = '✅ 成功';
  $('output').textContent = JSON.stringify(data, null, 2);

  // 如果用户输入了 .html，纠正地址栏
  const qPath = getQFromPath();
  const normalized = normalizeQ(qPath);
  if (normalized && normalized !== qPath) {
    history.replaceState(null, '', `/company/${encodeURIComponent(normalized)}`);
  }
}

function init() {
  const qPath = getQFromPath();
  const q = normalizeQ(qPath);

  $('btnGo').addEventListener('click', async () => {
    const vRaw = ($('inputQ')?.value || '').trim();
    if (!vRaw) return alert('请输入企业 slug / 简称 / 全称');
    const v = normalizeQ(vRaw);
    history.replaceState(null, '', `/company/${encodeURIComponent(v)}`);
    await loadCompany(v);
  });

  $('inputQ').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('btnGo')?.click();
  });

  if (!q) {
    $('status').textContent = '请输入 /company/xxx 或在下方输入框输入企业 slug/简称/全称。';
    return;
  }

  loadCompany(q);
}

init();
