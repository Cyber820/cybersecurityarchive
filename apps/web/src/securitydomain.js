// apps/web/src/securitydomain.js
const $ = (id) => document.getElementById(id);

function normalizeQ(raw) {
  let q = String(raw ?? '').trim();
  // 容错：用户误把 slug 当成 html 文件名
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

async function loadDomain(qRaw) {
  const q = normalizeQ(qRaw);
  const url = `/api/domain/${encodeURIComponent(q)}`;
  $('apiUrl').textContent = url;

  $('status').textContent = '加载中…';
  $('output').textContent = '';

  const res = await fetch(url, { method: 'GET' });
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

  // 如果用户输入了 .html，我们把地址栏也纠正一下（更干净）
  const normalized = normalizeQ(getQFromPath());
  if (normalized && normalized !== getQFromPath()) {
    history.replaceState(null, '', `/securitydomain/${encodeURIComponent(normalized)}`);
    $('q').textContent = normalized;
  }
}

function init() {
  const qPath = getQFromPath();
  const q = normalizeQ(qPath);
  $('q').textContent = q || '(空)';

  $('btnGo').addEventListener('click', async () => {
    const vRaw = $('inputQ').value.trim();
    if (!vRaw) return alert('请输入安全领域名或 slug');
    const v = normalizeQ(vRaw);
    history.replaceState(null, '', `/securitydomain/${encodeURIComponent(v)}`);
    $('q').textContent = v;
    await loadDomain(v);
  });

  $('inputQ').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('btnGo').click();
  });

  if (!q) {
    $('status').textContent = '请输入 /securitydomain/xxx 或在下方输入框输入安全领域名/slug。';
    return;
  }

  loadDomain(q);
}

init();
