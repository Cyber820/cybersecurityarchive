// apps/web/src/admin.js
const $ = (id) => document.getElementById(id);

const STORAGE_KEY = 'industry_admin_token_v1';

/** =========================
 * Token
 * ========================= */
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

function tokenHeader() {
  const t = getToken();
  return t ? { 'X-Admin-Token': t } : {};
}

function requireTokenOrPrompt() {
  if (getToken()) return true;
  openTokenModal();
  return false;
}

/** =========================
 * Modal helpers
 * ========================= */
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

/** =========================
 * API
 * ========================= */
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

/** =========================
 * Busy Modal (3-state)
 * ========================= */
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

/** =========================
 * Token modal
 * ========================= */
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

/** =========================
 * Reusable checkbox multi-select component
 * =========================
 * - 3-column grid rendered by CSS
 * - search filter
 * - getSelectedIds(), clearSelection()
 */
function createCheckboxMultiSelect({
  searchEl,
  metaEl,
  gridEl,
  emptyEl,
  // required: fetchOptions() -> {items:[{id,name,slug}]}
  fetchOptions,
  // how to render label text from item
  formatLabel = (item) => `${item.name} (${item.slug})`,
  // unique checkbox id prefix
  idPrefix = 'ms'
}) {
  let allItems = [];   // normalized items
  let filtered = [];

  function setMeta(text) {
    metaEl.textContent = text;
  }

  function normalize(items) {
    return (items || [])
      .map((x) => ({
        id: Number(x.id),
        name: String(x.name || ''),
        slug: String(x.slug || '')
      }))
      .filter((x) => Number.isFinite(x.id));
  }

  function render(list) {
    filtered = list;
    gridEl.innerHTML = '';

    for (const item of list) {
      const cbId = `${idPrefix}_${item.id}`;

      const label = document.createElement('label');
      label.className = 'ms-item';
      label.setAttribute('for', cbId);

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = cbId;
      cb.value = String(item.id);

      const text = document.createElement('span');
      text.className = 'ms-label';
      text.textContent = formatLabel(item);

      label.appendChild(cb);
      label.appendChild(text);
      gridEl.appendChild(label);
    }

    emptyEl.style.display = list.length ? 'none' : 'block';
  }

  function applyFilter(q) {
    const qq = String(q || '').trim().toLowerCase();
    if (!qq) {
      render(allItems);
      setMeta(`共 ${allItems.length} 项`);
      return;
    }
    const next = allItems.filter((it) => {
      const n = it.name.toLowerCase();
      const s = it.slug.toLowerCase();
      return n.includes(qq) || s.includes(qq);
    });
    render(next);
    setMeta(`匹配 ${next.length} / ${allItems.length}`);
  }

  async function load(force = false) {
    // 这里不做 token 检查，由外层保证（这样组件更通用）
    if (!force && allItems.length) {
      applyFilter(searchEl.value);
      return;
    }

    setMeta('加载中…');
    gridEl.innerHTML = '';
    emptyEl.style.display = 'none';

    const data = await fetchOptions();
    allItems = normalize(data?.items);
    applyFilter(searchEl.value);
  }

  function getSelectedIds() {
    const ids = [];
    gridEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      if (cb.checked) {
        const n = Number(cb.value);
        if (Number.isFinite(n)) ids.push(n);
      }
    });
    return Array.from(new Set(ids));
  }

  function clearSelection() {
    gridEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => (cb.checked = false));
  }

  // wire events
  searchEl.addEventListener('input', () => applyFilter(searchEl.value));

  return {
    load,
    applyFilter,
    getSelectedIds,
    clearSelection
  };
}

/** =========================
 * Instantiate multi-selects
 * ========================= */
const domainMultiSelect = createCheckboxMultiSelect({
  searchEl: $('domainSearch'),
  metaEl: $('domainMeta'),
  gridEl: $('domainCheckboxGrid'),
  emptyEl: $('domainEmpty'),
  idPrefix: 'domain_cb',
  fetchOptions: async () => {
    if (!requireTokenOrPrompt()) return { items: [] };
    return apiGet('/api/admin/dropdowns/domains?limit=500');
  },
  formatLabel: (d) => `${d.name} (${d.slug})`
});

/** =========================
 * Entry buttons
 * ========================= */
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
    await domainMultiSelect.load(true);
    $('domainSearch').value = '';
    domainMultiSelect.applyFilter('');
  } catch (e) {
    showMsg('productMsg', { ok: false, error: '加载领域失败：' + e.message, status: e.status, detail: e.data });
  }
});

/** =========================
 * Domain submit
 * ========================= */
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

    // 新增领域后刷新领域多选数据（便于马上录产品）
    await domainMultiSelect.load(true);
    domainMultiSelect.applyFilter($('domainSearch').value || '');
  } catch (e) {
    showMsg('domainMsg', { ok: false, error: e.message, status: e.status, detail: e.data });
    busyFail('安全领域录入失败');
  }
});

/** =========================
 * Product submit
 * ========================= */
$('btnProductSubmit').addEventListener('click', async () => {
  if (!requireTokenOrPrompt()) return;

  clearMsg('productMsg');

  const domainIds = domainMultiSelect.getSelectedIds();

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
    domainMultiSelect.clearSelection();
  } catch (e) {
    showMsg('productMsg', { ok: false, error: e.message, status: e.status, detail: e.data });
    busyFail('安全产品录入失败');
  }
});

/** =========================
 * init
 * ========================= */
refreshTokenStatus();

// 点击遮罩关闭（busyModal 允许按按钮关闭；遮罩点击不关闭）
['tokenModal','domainModal','productModal'].forEach((mid) => {
  const overlay = $(mid);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(mid);
  });
});
