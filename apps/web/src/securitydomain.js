// apps/web/src/securitydomain.js
const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function getQFromPath() {
  // pathname like: /securitydomain/%E5%AE%89%E5%85%A8%E9%A2%86%E5%9F%9F%E5%90%8D
  const parts = (location.pathname || '').split('/').filter(Boolean);
  const idx = parts.indexOf('securitydomain');
  if (idx < 0) return '';
  const q = parts.slice(idx + 1).join('/'); // allow encoded slashes if ever happens
  try { return decodeURIComponent(q); } catch { return q; }
}

async function loadDomain(q) {
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
}

function init() {
  const q = getQFromPath();
  $('q').textContent = q || '(空)';

  // allow manual retry
  $('btnGo').addEventListener('click', async () => {
    const v = $('inputQ').value.trim();
    if (!v) return alert('请输入安全领域名或 slug');
    history.replaceState(null, '', `/securitydomain/${encodeURIComponent(v)}`);
    $('q').textContent = v;
    await loadDomain(v);
  });

  $('inputQ').addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') $('btnGo').click();
  });

  if (!q) {
    $('status').textContent = '请输入 /securitydomain/xxx 或在下方输入框输入安全领域名/slug。';
    return;
  }
  loadDomain(q);
}

init();
