// apps/web/src/admin.js
import { createMultiSelectGrid } from './ui/multiselect-grid.js';

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = 'industry_admin_token_v1';

/** Token */
function getToken() { return (localStorage.getItem(STORAGE_KEY) || '').trim(); }
function setToken(token) { localStorage.setItem(STORAGE_KEY, String(token || '').trim()); refreshTokenStatus(); }
function refreshTokenStatus() { $('tokenStatus').textContent = getToken() ? '已设置' : '未设置'; }
function tokenHeader() { const t = getToken(); return t ? { 'X-Admin-Token': t } : {}; }
function requireTokenOrPrompt() { if (getToken()) return true; openTokenModal(); return false; }

/** Modal helpers */
function openModal(id) { const el = $(id); el.style.display = 'flex'; el.setAttribute('aria-hidden', 'false'); }
function closeModal(id) {
  const el = $(id);
  if (el.contains(document.activeElement)) document.activeElement.blur();
  el.style.display = 'none';
  el.setAttribute('aria-hidden', 'true');
}
function showMsg(containerId, msgObj) {
  const el = $(containerId);
  el.style.display = 'block';
  el.textContent = typeof msgObj === 'string' ? msgObj : JSON.stringify(msgObj, null, 2);
}
function clearMsg(containerId) { const el = $(containerId); el.style.display = 'none'; el.textContent = ''; }

/** API */
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

/** Busy modal */
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

/** Token modal */
function openTokenModal() { $('tokenInput').value = getToken(); openModal('tokenModal'); }
$('btnSetToken').addEventListener('click', openTokenModal);
$('btnTokenCancel').addEventListener('click', () => closeModal('tokenModal'));
$('btnTokenSave').addEventListener('click', () => { setToken($('tokenInput').value); closeModal('tokenModal'); });

/** Close buttons */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-close]');
  if (!btn) return;
  closeModal(btn.getAttribute('data-close'));
});

/** ===== Domains multiselect (3-column checkbox) ===== */
const domainMount = $('domainMsMount');

const domainMs = createMultiSelectGrid({
  title: '安全领域',
  required: false,
  placeholder: '搜索领域名称或 slug…',
  hint: '▾ 展开；勾选后点“确认”生效；点“取消”放弃本次改动。',
  options: [], // 打开 product modal 时再加载
  searchText: (o) => `${o?.name ?? ''} ${o?.slug ?? ''}`.trim()
});

domainMount.innerHTML = '';
domainMount.appendChild(domainMs.element);

async function loadDomainsIntoMs() {
  if (!requireTokenOrPrompt()) return;
  const data = await apiGet('/api/admin/dropdowns/domains?limit=500');
  const items = (data?.items || []).map(x => ({
    id: String(x.id),
    name: x.name,
    description: x.slug ? `(${x.slug})` : null,
    slug: x.slug
  }));
  domainMs.setOptions(items);
}

/** Entry buttons */
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

  try {
    await loadDomainsIntoMs();
  } catch (e) {
    showMsg('productMsg', { ok: false, error: '加载领域失败：' + e.message, status: e.status, detail: e.data });
  }
});

/** Domain submit */
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

    $('dom_name').value = '';
    $('dom_slug').value = '';

    // 新增后刷新候选
    await loadDomainsIntoMs();
  } catch (e) {
    showMsg('domainMsg', { ok: false, error: e.message, status: e.status, detail: e.data });
    busyFail('安全领域录入失败');
  }
});

/** Product submit */
$('btnProductSubmit').addEventListener('click', async () => {
  if (!requireTokenOrPrompt()) return;

  clearMsg('productMsg');

  // ✅ committed 值（确认后才会进入）
  const domainIds = domainMs.getValues().map(x => Number(x)).filter(Number.isFinite);

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

    $('prod_name').value = '';
    $('prod_slug').value = '';
    // 领域选择默认保留，方便连续录入；需要清空就点 ×
  } catch (e) {
    showMsg('productMsg', { ok: false, error: e.message, status: e.status, detail: e.data });
    busyFail('安全产品录入失败');
  }
});

/** Init */
refreshTokenStatus();

// overlay click close (except busyModal)
['tokenModal', 'domainModal', 'productModal'].forEach((mid) => {
  const overlay = $(mid);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(mid);
  });
});
