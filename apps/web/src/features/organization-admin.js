// apps/web/src/features/organization-admin.js
// 企业/机构：添加 + 编辑（搜索 -> 查看 -> 编辑 -> PATCH 更新）
//
// 说明：为了避免“拆解后缺 DOM 节点导致功能直接被禁用”，
// 编辑相关弹窗全部动态创建，不依赖 admin.html 预置的 modal DOM。

const TOKEN_STORAGE_KEY = 'ia_admin_token'

function $(id) { return document.getElementById(id) }
function norm(s) { return String(s ?? '').trim() }
function isSlug(s) { return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) }

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

function openConfirm({ title = '处理中', body = '请稍候…', lock = true } = {}) {
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
  try { json = text ? JSON.parse(text) : null } catch {}

  if (!res.ok) {
    const msg = json?.error || json?.message || text || `${res.status} ${res.statusText}`
    throw new Error(msg)
  }
  return json
}

// ====== 动态弹窗基础组件 ======
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue
    if (k === 'class') node.className = v
    else if (k === 'html') node.innerHTML = v
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v)
    else node.setAttribute(k, String(v))
  }
  for (const c of Array.isArray(children) ? children : [children]) {
    if (c == null) continue
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c)
  }
  return node
}

let __orgEditStyleInjected = false
function ensureStyle() {
  if (__orgEditStyleInjected) return
  __orgEditStyleInjected = true
  const css = `
  .ia-ov{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:120000;padding:16px;}
  .ia-md{width:min(860px,100%);max-height:85vh;overflow:auto;border:1px solid rgba(0,0,0,.20);border-radius:12px;background:#fff;padding:12px;box-sizing:border-box;}
  .ia-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;}
  .ia-title{font-size:16px;font-weight:800;}
  .ia-btn{border:1px solid rgba(0,0,0,.25);background:#fff;border-radius:12px;padding:10px 12px;cursor:pointer;font-size:14px;}
  .ia-btn-primary{border-color:rgba(0,0,0,.45);font-weight:700;}
  .ia-row{display:grid;grid-template-columns:140px 1fr;gap:10px;align-items:start;margin:10px 0;}
  .ia-label{font-size:13px;font-weight:700;}
  .ia-input{width:100%;box-sizing:border-box;border:1px solid rgba(0,0,0,.25);border-radius:10px;padding:9px 10px;font-size:14px;outline:none;background:#fff;color:#111;}
  .ia-hint{font-size:12px;color:rgba(0,0,0,.65);margin-top:6px;}
  .ia-list{margin-top:10px;border:1px solid rgba(0,0,0,.15);border-radius:10px;overflow:auto;max-height:360px;}
  .ia-item{padding:8px 10px;display:flex;justify-content:space-between;gap:10px;cursor:pointer;font-size:13px;}
  .ia-item:hover{background:rgba(0,0,0,.04);}
  .ia-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:12px;flex-wrap:wrap;}
  .ia-kv{padding:6px 0;border-bottom:1px solid rgba(0,0,0,.08);display:flex;gap:10px;}
  .ia-k{width:160px;flex:0 0 160px;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .ia-v{flex:1 1 auto;min-width:0;word-break:break-word;white-space:pre-wrap;}
  `
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
}

function openModal({ title, contentEl, buttons = [] }) {
  ensureStyle()
  const overlay = el('div', { class: 'ia-ov' })
  const modal = el('div', { class: 'ia-md', role: 'dialog', 'aria-modal': 'true' })
  overlay.appendChild(modal)

  const head = el('div', { class: 'ia-head' }, [
    el('div', { class: 'ia-title' }, title || ''),
  ])

  const actions = el('div', { class: 'ia-actions' }, buttons)

  modal.appendChild(head)
  modal.appendChild(contentEl)
  modal.appendChild(actions)

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove() })
  document.body.appendChild(overlay)

  return {
    close: () => overlay.remove(),
    overlay,
    modal,
  }
}

// ====== 组织：编辑入口 ======
export function mountOrganizationAdmin() {
  saveTokenFromInput()

  // 添加企业（你已有 orgModal 这套 DOM）
  // 这里只保证：如果 DOM 存在就不影响旧功能；编辑功能是独立的。
  const btnEdit = $('btnOpenOrgEdit')
  if (!btnEdit) {
    console.warn('[organization-admin] missing #btnOpenOrgEdit, edit feature disabled')
    return
  }

  btnEdit.addEventListener('click', () => {
    openOrgSearchModal()
  })
}

function openOrgSearchModal() {
  const qInput = el('input', { class: 'ia-input', type: 'text', placeholder: '搜索：简称 / 全称 / slug（回车搜索）' })
  const hint = el('div', { class: 'ia-hint' }, '将查询 organization 表：short_name、full_name、slug；结果不重复。')
  const list = el('div', { class: 'ia-list' })
  const box = el('div', {}, [qInput, hint, list])

  const btnClose = el('button', { class: 'ia-btn', type: 'button' }, '关闭')
  const btnSearch = el('button', { class: 'ia-btn ia-btn-primary', type: 'button' }, '搜索')

  const modal = openModal({
    title: '编辑企业/机构：搜索',
    contentEl: box,
    buttons: [btnClose, btnSearch],
  })

  async function runSearch() {
    const q = norm(qInput.value)
    const c = openConfirm({ title: '搜索中', body: '查询 organization…', lock: true })
    try {
      // 约定：后端提供该搜索接口（如果你还没加，会 404；UI 仍正常弹）
      const data = await fetchJson(`/api/admin/organization/search?q=${encodeURIComponent(q)}&limit=50`)
      const items = Array.isArray(data?.items) ? data.items : []
      c.close()
      renderList(items)
    } catch (e) {
      c.set({ title: '搜索失败', body: `❌ ${e?.message || String(e)}\n\n如果提示 404：说明后端缺少 /api/admin/organization/search。`, lock: false })
    }
  }

  function renderList(items) {
    list.innerHTML = ''
    if (!items.length) {
      list.appendChild(el('div', { class: 'ia-item' }, '没有结果'))
      return
    }

    for (const it of items) {
      const label = norm(it.organization_full_name) || norm(it.organization_short_name) || '(未命名)'
      const right = el('small', {}, norm(it.organization_slug) ? `slug: ${it.organization_slug}` : '')
      const row = el('div', { class: 'ia-item' }, [label, right])
      row.addEventListener('click', () => {
        // 在“详情弹窗”上直接编辑 —— 不让搜索层覆盖
        modal.close()
        openOrgDetailModal(it)
      })
      list.appendChild(row)
    }
  }

  btnClose.addEventListener('click', () => modal.close())
  btnSearch.addEventListener('click', () => runSearch())
  qInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch() })

  qInput.focus()
}

function openOrgDetailModal(org) {
  const kv = (k, v) => el('div', { class: 'ia-kv' }, [
    el('div', { class: 'ia-k' }, k),
    el('div', { class: 'ia-v' }, v == null || v === '' ? '—' : String(v)),
  ])

  const box = el('div', {}, [
    kv('企业简称', org.organization_short_name),
    kv('企业全称', org.organization_full_name),
    kv('成立时间', org.establish_year),
    kv('slug', org.organization_slug),
  ])

  const btnCancel = el('button', { class: 'ia-btn', type: 'button' }, '取消')
  const btnEdit = el('button', { class: 'ia-btn ia-btn-primary', type: 'button' }, '编辑')

  const modal = openModal({
    title: '企业/机构信息',
    contentEl: box,
    buttons: [btnCancel, btnEdit],
  })

  btnCancel.addEventListener('click', () => modal.close())
  btnEdit.addEventListener('click', () => {
    modal.close()
    openOrgEditModal(org)
  })
}

function openOrgEditModal(org) {
  const nowYear = new Date().getFullYear()

  const shortInput = el('input', { class: 'ia-input', type: 'text', value: org.organization_short_name || '' })
  const fullInput = el('input', { class: 'ia-input', type: 'text', value: org.organization_full_name || '' })
  const yearInput = el('input', { class: 'ia-input', type: 'text', inputmode: 'numeric', value: org.establish_year ?? '' })
  const slugInput = el('input', { class: 'ia-input', type: 'text', value: org.organization_slug || '' })

  const prefill = {
    short: shortInput.value,
    full: fullInput.value,
    year: yearInput.value,
    slug: slugInput.value,
  }

  const box = el('div', {}, [
    el('div', { class: 'ia-row' }, [el('div', { class: 'ia-label' }, '企业简称 *'), shortInput]),
    el('div', { class: 'ia-row' }, [el('div', { class: 'ia-label' }, '企业全称'), fullInput]),
    el('div', { class: 'ia-row' }, [el('div', { class: 'ia-label' }, '成立时间'), yearInput]),
    el('div', { class: 'ia-row' }, [el('div', { class: 'ia-label' }, 'slug *'), slugInput]),
    el('div', { class: 'ia-hint' }, `成立时间：可空；如填写需为 1990 ~ ${nowYear} 的年份。slug：a-z/0-9/-。`),
  ])

  const btnCancel = el('button', { class: 'ia-btn', type: 'button' }, '取消')
  const btnReset = el('button', { class: 'ia-btn', type: 'button' }, '重置')
  const btnOk = el('button', { class: 'ia-btn ia-btn-primary', type: 'button' }, '确定')

  const modal = openModal({
    title: '编辑企业/机构基础信息',
    contentEl: box,
    buttons: [btnCancel, btnReset, btnOk],
  })

  btnCancel.addEventListener('click', () => modal.close())
  btnReset.addEventListener('click', () => {
    shortInput.value = prefill.short
    fullInput.value = prefill.full
    yearInput.value = prefill.year
    slugInput.value = prefill.slug
  })

  btnOk.addEventListener('click', async () => {
    const short = norm(shortInput.value)
    const full = norm(fullInput.value)
    const yearRaw = norm(yearInput.value)
    const slug = norm(slugInput.value)

    if (!short) {
      const c = openConfirm({ title: '校验失败', body: '企业简称为必填。', lock: false })
      return
    }
    if (!slug || !isSlug(slug)) {
      const c = openConfirm({ title: '校验失败', body: 'slug 必填，且仅允许 a-z/0-9/连字符 -。', lock: false })
      return
    }
    let year = null
    if (yearRaw) {
      const n = Number(yearRaw)
      if (!Number.isFinite(n) || n < 1990 || n > nowYear) {
        const c = openConfirm({ title: '校验失败', body: `成立时间需为 1990 ~ ${nowYear} 的年份，或留空。`, lock: false })
        return
      }
      year = n
    }

    const c = openConfirm({ title: '更新中', body: '正在写入…', lock: true })
    try {
      // 约定：后端提供 PATCH /api/admin/organization/:id
      await fetchJson(`/api/admin/organization/${org.organization_id}`, {
        method: 'PATCH',
        body: {
          organization_short_name: short,
          organization_full_name: full || null,
          establish_year: year,
          organization_slug: slug,
        },
      })
      c.set({ title: '更新成功', body: '✅ 更新成功。', lock: false })
      $('confirmOk').onclick = () => { c.close(); modal.close() }
    } catch (e) {
      c.set({ title: '更新失败', body: `❌ ${e?.message || String(e)}\n\n如果提示 404：说明后端缺少 PATCH /api/admin/organization/:id。`, lock: false })
    }
  })
}
