// apps/web/src/features/product-admin.js
// 录入安全产品（含：选择对应安全领域 domains[]）

import { createMultiSelectGrid } from '../ui/multiselect-grid.js'

// 与 admin.js 保持一致（你 admin.js 里就是这个 key）
const TOKEN_STORAGE_KEY = 'ia_admin_token'

function $(id) { return document.getElementById(id) }

function getToken() {
  const input = $('tokenInput')
  const v = (input?.value ?? localStorage.getItem(TOKEN_STORAGE_KEY) ?? '').trim()
  return v || ''
}

function saveTokenFromInput() {
  const input = $('tokenInput')
  if (!input) return
  input.addEventListener('input', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, String(input.value || '').trim())
  })
}

function openOverlay(modalEl) {
  if (!modalEl) return
  modalEl.style.display = 'flex'
  modalEl.setAttribute('aria-hidden', 'false')
}

function closeOverlay(modalEl) {
  if (!modalEl) return
  modalEl.style.display = 'none'
  modalEl.setAttribute('aria-hidden', 'true')
}

function setInvalid(inputEl, errEl, message) {
  if (inputEl) inputEl.setAttribute('aria-invalid', 'true')
  if (errEl) { errEl.textContent = message; errEl.style.display = 'block' }
}
function clearInvalid(inputEl, errEl) {
  if (inputEl) inputEl.removeAttribute('aria-invalid')
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none' }
}

function norm(s) { return String(s ?? '').trim() }
function isSlug(s) { return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) }

function openConfirm({ title = '录入中', body = '请稍候…', lock = true } = {}) {
  const overlay = $('confirmOverlay')
  const t = $('confirmTitle')
  const b = $('confirmBody')
  const ok = $('confirmOk')
  if (!overlay || !t || !b || !ok) return { set(){}, close(){} }

  overlay.style.display = 'flex'
  overlay.setAttribute('aria-hidden', 'false')
  t.textContent = title
  b.textContent = body

  ok.disabled = !!lock

  function set(next) {
    if (next?.title != null) t.textContent = next.title
    if (next?.body != null) b.textContent = next.body
    if (next?.lock != null) ok.disabled = !!next.lock
  }
  function close() {
    overlay.style.display = 'none'
    overlay.setAttribute('aria-hidden', 'true')
  }

  ok.onclick = () => close()
  return { set, close }
}

async function fetchJson(url, { method = 'GET', body } = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['x-admin-token'] = token

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { /* ignore */ }

  if (!res.ok) {
    const msg = json?.error || json?.message || text || `${res.status} ${res.statusText}`
    throw new Error(msg)
  }
  return json
}

/**
 * mountProductAdmin()
 * - 不依赖额外 mount 点；只依赖 admin.html 中这些 id：
 *   btnOpenProduct, productModal, productClose, productReset, productSubmit,
 *   productName, productSlug, productDomainMount, productNameErr, productSlugErr
 */
export function mountProductAdmin() {
  saveTokenFromInput()

  const btnOpen = $('btnOpenProduct')
  const modal = $('productModal')
  const btnClose = $('productClose')
  const btnReset = $('productReset')
  const btnSubmit = $('productSubmit')

  const nameInput = $('productName')
  const slugInput = $('productSlug')
  const nameErr = $('productNameErr')
  const slugErr = $('productSlugErr')

  const mount = $('productDomainMount')

  // 如果关键 DOM 不存在，就别让整个 admin.js 崩；只是不启用该 feature
  if (!btnOpen || !modal || !btnClose || !btnReset || !btnSubmit || !nameInput || !slugInput || !mount) {
    console.warn('[product-admin] missing DOM nodes, feature disabled')
    return
  }

  // ====== MultiSelectGrid：对应安全领域 ======
  // 我们把组件固定在 mount 里，并且每次打开 modal 时 refresh options
  const msDomains = createMultiSelectGrid({
    title: '对应安全领域（可多选）',
    // 固定 3 列 + 可滚动
    columns: 3,
    maxHeight: 260,
    // 只显示 name（不显示 slug）
    renderLabel: (opt) => opt?.name ?? '',
    // 搜索也只搜 name
    filterText: (opt) => `${opt?.name ?? ''}`,
  })
  mount.innerHTML = ''
  mount.appendChild(msDomains.element)

  async function refreshDomains() {
    // 后端返回：{ items:[{id,name,slug}...] }
    const data = await fetchJson('/api/admin/dropdowns/domains')
    const items = Array.isArray(data?.items) ? data.items : []
    // 只喂 {id,name}，彻底忽略 slug（避免显示 slug）
    const options = items
      .map(x => ({ id: x.id, name: x.name }))
      .filter(x => x.id != null && norm(x.name))
    msDomains.setOptions(options)
  }

  function resetForm() {
    nameInput.value = ''
    slugInput.value = ''
    msDomains.clear()
    clearInvalid(nameInput, nameErr)
    clearInvalid(slugInput, slugErr)
  }

  function validate() {
    let ok = true

    const name = norm(nameInput.value)
    const slug = norm(slugInput.value)

    if (!name) { setInvalid(nameInput, nameErr, '安全产品名称为必填。'); ok = false }
    else clearInvalid(nameInput, nameErr)

    if (!slug) { setInvalid(slugInput, slugErr, 'slug 为必填。'); ok = false }
    else if (!isSlug(slug)) { setInvalid(slugInput, slugErr, 'slug 仅允许 a-z / 0-9 / 连字符 -（建议小写）。'); ok = false }
    else clearInvalid(slugInput, slugErr)

    return ok
  }

  // ====== events ======
  btnOpen.addEventListener('click', async () => {
    // 打开前刷新 domains，避免“空列表”/新录入领域后不更新
    const c = openConfirm({ title: '加载中', body: '正在加载安全领域列表…', lock: true })
    try {
      await refreshDomains()
      c.close()
      openOverlay(modal)
    } catch (e) {
      c.set({ title: '失败', body: `❌ 加载安全领域失败：${e?.message || String(e)}\n\n请确认：token 有效且 /api/admin/dropdowns/domains 可访问。`, lock: false })
    }
  })

  btnClose.addEventListener('click', () => closeOverlay(modal))
  modal.addEventListener('click', (e) => { if (e.target === modal) closeOverlay(modal) })

  btnReset.addEventListener('click', () => resetForm())

  btnSubmit.addEventListener('click', async () => {
    if (!validate()) return

    const payload = {
      security_product_name: norm(nameInput.value),
      security_product_slug: norm(slugInput.value),
      // 这里传 id[]，后端 normalizeDomainIds 支持 number[]
      domains: msDomains.getSelectedIds().map(x => Number(x)).filter(n => Number.isFinite(n)),
    }

    const c = openConfirm({ title: '录入中', body: '写入中…请稍候', lock: true })
    try {
      const res = await fetchJson('/api/admin/product', { method: 'POST', body: payload })
      c.set({ title: '录入成功', body: `✅ 写入成功\nsecurity_product_id = ${res?.product?.security_product_id ?? '（未知）'}`, lock: false })
      // 让用户点确定关闭 confirm，再关闭 modal（避免“录入中一直不消失”）
      $('confirmOk').onclick = () => {
        c.close()
        closeOverlay(modal)
        resetForm()
      }
    } catch (e) {
      c.set({ title: '录入失败', body: `❌ ${e?.message || String(e)}`, lock: false })
    }
  })
}
