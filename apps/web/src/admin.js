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
  $('tokenStatus').textContent = getToken() ? '已设置' : '未设置';
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
    headers: { 'Content-Type': 'application/json', ...tokenHeader() },
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
$('btnBusyClose').addEventListener('click', () => closeModal('busyModal'));

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

  // refresh domains list each time product modal opens (you can cache later)
  await loadDomainsForCheckboxes(true);
  $('domainSearch').value = '';
  filterDomains('');
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
    showMsg('domainMsg', { ok: true, message: '录入成功', data });
    busySuccess('安全领域录入成功');

    // 连续录入友好：清空输入但不关闭弹窗
    $('dom_name').value = '';
    $('dom_slug').value = '';

    // 新增领域后，刷新产品弹窗领域列表（如果用户接着录产品）
    await loadDomainsForCheckboxes(true);
    filterDomains($('domainSearch').value || '');
  } catch (e) {
    showMsg('domainMsg', { ok: false, error: e.message, status: e.status, detail: e.data });
    busyFail('安全领域录入失败');
  }
});

/** ===== Product submit ===== */
$('btnProductSubmit').addEventListener('click', async () => {
  if (!requireTokenOrPrompt()) return;

  clearMsg('productMsg');

  const domainIds = getSelectedDomainIds();

  const body = {
    security_product_name: $('prod_name').value.trim(),
    security_product_slug: $('prod_slug').value.trim(),
    ...(domainIds.length ? { domains: domainIds } : {})
  };

  busyStart('录入中：安全产品…');
  try {
    const data = await apiPost('/api/admin/product', body);
    showMsg('productMsg', { ok: true, message: '录入成功', data });
    busySuccess('安全产品录入成功');

    // 清空输入，保留弹窗便于连续录入
    $('prod_name').value = '';
    $('prod_slug').value = '';
    clearDomainSelection();
  } catch (e) {
    showMsg('productMsg', { ok: false, error: e.message, status: e.status, detail: e.data });
    busyFail('安全产品录入失败');
  }
});

/** ===== Checkbox multi-select: Domains ===== */
let domainsAll = [];      // [{id,name,slug}]
let domainsFiltered = []; // current list after filter

async function loadDomainsForCheckboxes(force = false) {
  if (!requireTokenOrPrompt()) return;

  // 简单策略：force=true 就重拉；否则若已有就复用
  if (!force && domainsAll.length) {
    renderDomains(domainsAll);
    return;
  }

  setDomainMeta('加载中…');
  $('domainCheckboxGrid').innerHTML = '';
  $('domainEmpty').style.display = 'none';

  try {
    const data = await apiGet('/api/admin/dropdowns/domains?limit=500');
    domainsAll = (data?.items || []).map((x) => ({
      id: Number(x.id),
      name: String(x.name || ''),
      slug: String(x.slug || '')
    })).filter((x) => Number.isFinite(x.id));

    renderDomains(domainsAll);
    setDomainMeta(`共 ${domainsAll.length} 项`);
  } catch (e) {
    setDomainMeta('加载失败（检查 token / 接口）');
    showMsg('productMsg', {
      ok: false,
      error: '加载领域下拉失败：' + e.message,
      status: e.status,
      detail: e.data
    });
  }
}

function setDomainMeta(text) {
  $('domainMeta').textContent = text;
}

function renderDomains(list) {
  domainsFiltered = list;

  const grid = $('domainCheckboxGrid');
  grid.innerHTML = '';

  for (const d of list) {
    const id = `domain_cb_${d.id}`;

    const item = document.createElement('label');
    item.className = 'ms-item';
    item.setAttribute('for', id);

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = id;
    cb.value = String(d.id);
    cb.dataset.name = d.name.toLowerCase();
    cb.dataset.slug = d.slug.toLowerCase();

    const text = document.createElement('span');
    text.className = 'ms-label';
    text.textContent = `${d.name} (${d.slug})`;

    item.appendChild(cb);
    item.appendChild(text);
    grid.appendChild(item);
  }

  $('domainEmpty').style.display = list.length ? 'none' : 'block';
}

function filterDomains(q) {
  const qq = String(q || '').trim().toLowerCase();
  if (!qq) {
    renderDomains(domainsAll);
    setDomainMeta(`共 ${domainsAll.length} 项`);
    return;
  }
  const filtered = domainsAll.filter((d) => {
    const name = (d.name || '').toLowerCase();
    const slug = (d.slug || '').toLowerCase();
    return name.includes(qq) || slug.includes(qq);
  });
  renderDomains(filtered);
  setDomainMeta(`匹配 ${filtered.length} / ${domainsAll.length}`);
}

function getSelectedDomainIds() {
  const checks = $('domainCheckboxGrid').querySelectorAll('input[type="checkbox"]');
  const ids = [];
  checks.forEach((cb) => {
    if (cb.checked) {
      const n = Number(cb.value);
      if (Number.isFinite(n)) ids.push(n);
    }
  });
  // 去重
  return Array.from(new Set(ids));
}

function clearDomainSelection() {
  const checks = $('domainCheckboxGrid').querySelectorAll('input[type="checkbox"]');
  checks.forEach((cb) => (cb.checked = false));
}

$('domainSearch').addEventListener('input', (e) => {
  filterDomains(e.target.value);
});

/** ===== init ===== */
refreshTokenStatus();

// 点击遮罩关闭（busyModal 不允许点遮罩关闭）
['tokenModal','domainModal','productModal'].forEach((mid) => {
  const overlay = $(mid);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(mid);
  });
});
