// apps/web/src/securitydomain.js
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

async function loadDomain(qRaw) {
  const q = normalizeQ(qRaw);
  const url = `/api/domain/${encodeURIComponent(q)}`;

  const qEl = $('q');
  const apiEl = $('apiUrl');
  const statusEl = $('status');
  const outEl = $('output');

  if (qEl) qEl.textContent = q || '(空)';
  if (apiEl) apiEl.textContent = url;

  if (statusEl) statusEl.textContent = '加载中…';
  if (outEl) outEl.textContent = '';

  const res = await fetch(url);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    if (statusEl) statusEl.textContent = `❌ 失败：HTTP ${res.status}`;
    if (outEl) outEl.textContent = JSON.stringify(data, null, 2);
    return;
  }

  if (statusEl) statusEl.textContent = '✅ 成功';
  if (outEl) outEl.textContent = JSON.stringify(data, null, 2);

  // 如果用户输入了 .html，纠正地址栏
  const qPath = getQFromPath();
  const normalized = normalizeQ(qPath);
  if (normalized && normalized !== qPath) {
    history.replaceState(null, '', `/securitydomain/${encodeURIComponent(normalized)}`);
  }
}

function init() {
  const qPath = getQFromPath();
  const q = normalizeQ(qPath);

  const btn = $('btnGo');
  const input = $('inputQ');

  if (btn) {
    btn.addEventListener('click', async () => {
      const vRaw = (input?.value || '').trim();
      if (!vRaw) return alert('请输入安全领域名或 slug');
      const v = normalizeQ(vRaw);
      history.replaceState(null, '', `/securitydomain/${encodeURIComponent(v)}`);
      await loadDomain(v);
    });
  }

  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btn?.click();
    });
  }

  if (!q) {
    const statusEl = $('status');
    if (statusEl) statusEl.textContent = '请输入 /securitydomain/xxx 或在下方输入框输入安全领域名/slug。';
    return;
  }

  loadDomain(q);
}

init();
