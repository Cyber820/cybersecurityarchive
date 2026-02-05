// apps/web/src/admin.js
const $ = (id) => document.getElementById(id);

const STORAGE_KEY = 'industry_admin_token_v1';

function getToken() {
  return (localStorage.getItem(STORAGE_KEY) || '').trim();
}
function setToken(token) {
  localStorage.setItem(STORAGE_KEY, String(token || '').trim());
  refreshTokenStatus();
}
function refreshTokenStatus() {
  const t = getToken();
  $('tokenStatus').textContent = t ? '已设置' : '未设置';
}

function openModal(id) {
  const el = $(id);
  el.style.display = 'flex';
  el.setAttribute('aria-hidden', 'false');
}

function closeModal(id) {
  const el = $(id);
  el.style.display = 'none';
  el.setAttribute('aria-hidden', 'true');
}

function showMsg(containerId, msgObj) {
  const el = $(containerId);
  el.style.display = 'block';
  el.textContent = typeof msgObj === 'string' ? msgObj : JSON.stringify(msgObj, null, 2);
}

function clearMsg(containerId) {
  const el = $(containerId);
  el.style.display = 'none';
  el.textContent = '';
}

function tokenHeader() {
  const t = getToken();
  return t ? { 'X-Admin-Token': t } : {};
}

async function apiGet(url) {
  const res = await fetch(url, { headers: { ...tokenHeader() } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.error || 'Request failed'), { status: res.status, data });
  return data;
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...tokenHeader()
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.error || 'Request failed'), { status: res.status, data });
  return data;
}

function requireTokenOrPrompt() {
  if (getToken()) return true;
  openTokenModal();
  return false;
}

/** ===== Busy Modal (3-state) ===== */
function busyStart(title = '录入中…') {
  $('busyTitle').textContent = title;
  $('btnBusyClose').textContent = '请稍候';
  $('btnBusyClose').disabled = true;
  openModal('busyModal');
}

function busySuccess(title = '录入成功') {
  $('busyTitle').textContent = title;
  $('btnBusyClose').textContent = '确定';
  $('btnBusyClose').disabled = false;
}

function busyFail(title = '录入失败') {
  $('busyTitle').textContent = title;
  $('btnBusyClose').textContent = '确定';
  $('btnBusyClose').disabled = false;
}

$('btnBusyClose').addEventListener('click', () => {
  closeModal('busyModal');
});

/** ===== Token Modal ===== */
function openTokenModal() {
  $('tokenInput').value = getToken();
  openModal('tokenModal');
}

$('btnSetToken').addEventListener('click', openTokenModal);
$('btnTokenCancel').addEventListener('click', () => closeModal('tokenModal'));
$('btnTokenSave').addEventListener('click', () => {
  setToken($('tokenInput').value);
  closeModal('tokenModal');
});

/** Close buttons with data-close */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-close]');
  if (!btn) return;
  closeModal(btn.getAttribute('data-close'));
});

/** ===== Entry buttons ===== */
$('btnDomain').addEventListener('click', () => {
  if (!requireTokenOrPrompt()) return;
  clearMsg('domainMsg');
  $('dom_name').value = '';
  $('dom_slug').value = '';
  openModal('domainModal');
});

$('btnProduct').addEventListener('click', async () => {
  if (!requireTokenOrPrompt()) return;
  clearMsg('productMsg');
  $('prod_name').value = '';
  $('prod_slug').value = '';
  openModal('productModal');
  await loadDomainsDropdown(); // ensure dropdown populated
});

/** ===== Domain submit ===== */
$('btnDomainSubmit').addEventListener('click', async () => {
  if (!requireTokenOrPrompt()) return;

  clearMsg('domainMsg');

  const body = {
    security_domain_name: $('dom_name').value.trim(),
    cybersecurity_domain_slug: $('dom_slug').value.trim()
  };

  busyStart('录入中：安全领域…');
  try {
    const data = await apiPost('/api/admin/domain', body);

    // 在弹窗内显示结果
    showMsg('domainMsg', { ok: true, message: '录入成功', data });

    // Busy 弹窗转为成功态（等待用户点确定）
    busySuccess('安全领域录入成功');

    // 方便连续录入：不关闭 domainModal，只清空输入
    $('dom_name').value = '';
    $('dom_slug').value = '';

    // 可选：成功后刷新产品弹窗的领域下拉
    await loadDomainsDropdown(true);
  } catch (e) {
    showMsg('domainMsg', {
      ok: false,
      error: e.message,
      status: e.status,
      detail: e.data
    });
    busyFail('安全领域录入失败');
  }
});

/** ===== Product submit ===== */
$('btnProductSubmit').addEventListener('click', async () => {
  if (!requireTokenOrPrompt()) return;

  clearMsg('productMsg');

  const domainIdStr = $('prod_domain_select').value;
  const domainId = domainIdStr ? Number(domainIdStr) : null;

  const body = {
    security_product_name: $('prod_name').value.trim(),
    security_product_slug: $('prod_slug').value.trim(),
    ...(domainId ? { domains: [domainId] } : {})
  };

  busyStart('录入中：安全产品…');
  try {
    const data = await apiPost('/api/admin/product', body);

    showMsg('productMsg', { ok: true, message: '录入成功', data });
    busySuccess('安全产品录入成功');

    // 成功后保留弹窗，清空输入，方便连续录入
    $('prod_name').value = '';
    $('prod_slug').value = '';
    $('prod_domain_select').value = '';
  } catch (e) {
    showMsg('productMsg', {
      ok: false,
      error: e.message,
      status: e.status,
      detail: e.data
    });
    busyFail('安全产品录入失败');
  }
});

/** ===== Domains dropdown ===== */
let domainsCache = null;

async function loadDomainsDropdown(force = false) {
  if (!requireTokenOrPrompt()) return;

  if (!force && domainsCache) {
    renderDomains(domainsCache);
    return;
  }

  const sel = $('prod_domain_select');
  sel.innerHTML = `<option value="">加载中…</option>`;

  try {
    const data = await apiGet('/api/admin/dropdowns/domains?limit=500');
    domainsCache = data;
    renderDomains(data);
  } catch (e) {
    sel.innerHTML = `<option value="">加载失败（检查 token / 接口）</option>`;
    showMsg('productMsg', {
      ok: false,
      error: '加载领域下拉失败：' + e.message,
      status: e.status,
      detail: e.data
    });
  }
}

function renderDomains(data) {
  const sel = $('prod_domain_select');
  const items = data?.items || [];

  const options = [
    `<option value="">（不选择领域）</option>`,
    ...items.map((x) =>
      `<option value="${x.id}">${escapeHtml(x.name)} (${escapeHtml(x.slug)})</option>`
    )
  ];
  sel.innerHTML = options.join('');
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

/** ===== init ===== */
refreshTokenStatus();

// 点击遮罩关闭（busyModal 不允许）
['tokenModal','domainModal','productModal'].forEach((mid) => {
  const overlay = $(mid);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(mid);
  });
});
