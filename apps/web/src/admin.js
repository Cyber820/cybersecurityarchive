// apps/web/src/admin.js

/**
 * admin.js 负责：
 * - token 只输入一次（localStorage）
 * - 打开各个录入弹窗（如果对应 modal 存在）
 * - “添加企业/机构”录入：校验 + POST /api/admin/organization
 * - 通用 confirm：录入中 -> 成功/失败 -> 点确定关闭
 */

const TOKEN_KEY = 'ia_admin_token_v1'

// ===== small helpers =====
function $(sel) { return document.querySelector(sel) }
function norm(v) { return (v ?? '').toString().trim() }

function setInvalid(inputEl, errEl, msg) {
  inputEl.setAttribute('aria-invalid', 'true')
  errEl.textContent = msg
  errEl.style.display = 'block'
}
function clearInvalid(inputEl, errEl) {
  inputEl.removeAttribute('aria-invalid')
  errEl.textContent = ''
  errEl.style.display = 'none'
}

// slug：a-z0-9-
function isValidSlug(slug) {
  return /^[a-z0-9-]+$/.test(slug)
}

// establish_year: 1990 ~ this year
function validateEstablishYear(v) {
  const s = norm(v)
  if (!s) return { value: null }
  if (!/^\d{4}$/.test(s)) return { error: '成立时间必须是 4 位数字（YYYY）。' }
  const n = Number(s)
  const nowYear = new Date().getFullYear()
  if (n < 1990 || n > nowYear) return { error: `成立时间范围：1990 ~ ${nowYear}` }
  return { value: n }
}

// ===== modal open/close =====
function openModal(modalEl) {
  if (!modalEl) return
  modalEl.style.display = 'flex'
  modalEl.setAttribute('aria-hidden', 'false')
}
function closeModal(modalEl) {
  if (!modalEl) return
  modalEl.style.display = 'none'
  modalEl.setAttribute('aria-hidden', 'true')
}

// ===== token =====
const tokenInput = $('#tokenInput')
if (tokenInput) {
  tokenInput.value = localStorage.getItem(TOKEN_KEY) || ''
  tokenInput.addEventListener('input', () => {
    localStorage.setItem(TOKEN_KEY, tokenInput.value)
  })
}
function getToken() {
  return tokenInput ? norm(tokenInput.value) : ''
}

// ===== confirm (录入中/成功/失败) =====
const confirmOverlay = $('#confirmOverlay')
const confirmTitle = $('#confirmTitle')
const confirmBody = $('#confirmBody')
const confirmOk = $('#confirmOk')

// confirm 状态：
// - loading：OK disabled
// - done：OK enabled，点 OK 关闭
function showConfirm({ title, body, okText = '确定', okEnabled = false } = {}) {
  if (!confirmOverlay) return
  confirmTitle.textContent = title || ''
  confirmBody.textContent = body || ''
  confirmOk.textContent = okText
  confirmOk.disabled = !okEnabled
  openModal(confirmOverlay)
}
function updateConfirm({ title, body, okText, okEnabled } = {}) {
  if (!confirmOverlay) return
  if (title != null) confirmTitle.textContent = title
  if (body != null) confirmBody.textContent = body
  if (okText != null) confirmOk.textContent = okText
  if (okEnabled != null) confirmOk.disabled = !okEnabled
}
function hideConfirm() {
  if (!confirmOverlay) return
  closeModal(confirmOverlay)
}

if (confirmOk) {
  confirmOk.addEventListener('click', () => {
    if (!confirmOk.disabled) hideConfirm()
  })
}

// ===== API helper =====
async function apiPostJson(url, payload, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['x-admin-token'] = token

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch (_) {}

  if (!res.ok) {
    const msg = json?.error || json?.message || text || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return json
}

// ✅ 如果你的后端路径不同，只改这里
const API_ORG_CREATE = '/api/admin/organization'

// ====== buttons: open other modals if exist (不再写死 alert 占位) ======
function tryOpenModalById(id) {
  const el = document.getElementById(id)
  if (!el) return false
  openModal(el)
  return true
}

const btnOpenDomain = $('#btnOpenDomain')
if (btnOpenDomain) {
  btnOpenDomain.addEventListener('click', () => {
    // 你现有实现里 modal id 如果不同，改这里
    if (!tryOpenModalById('domainModal')) {
      alert('未找到 #domainModal。请确认 admin.html 里安全领域弹窗的 id。')
    }
  })
}

const btnOpenProduct = $('#btnOpenProduct')
if (btnOpenProduct) {
  btnOpenProduct.addEventListener('click', () => {
    if (!tryOpenModalById('productModal')) {
      alert('未找到 #productModal。请确认 admin.html 里安全产品弹窗的 id。')
    }
  })
}

const btnOpenOrgProduct = $('#btnOpenOrgProduct')
if (btnOpenOrgProduct) {
  btnOpenOrgProduct.addEventListener('click', () => {
    if (!tryOpenModalById('orgProductModal')) {
      alert('未找到 #orgProductModal。请确认 admin.html 里企业产品弹窗的 id。')
    }
  })
}

// ====== Organization modal wiring ======
const orgModal = $('#orgModal')
const btnOpenOrg = $('#btnOpenOrg')
const orgClose = $('#orgClose')
const orgReset = $('#orgReset')
const orgSubmit = $('#orgSubmit')

const orgShortName = $('#orgShortName')
const orgFullName = $('#orgFullName')
const orgEstablishYear = $('#orgEstablishYear')
const orgSlug = $('#orgSlug')

const orgShortNameErr = $('#orgShortNameErr')
const orgEstablishYearErr = $('#orgEstablishYearErr')
const orgSlugErr = $('#orgSlugErr')

function resetOrgForm({ keepFocus = true } = {}) {
  if (orgShortName) orgShortName.value = ''
  if (orgFullName) orgFullName.value = ''
  if (orgEstablishYear) orgEstablishYear.value = ''
  if (orgSlug) orgSlug.value = ''

  if (orgShortName && orgShortNameErr) clearInvalid(orgShortName, orgShortNameErr)
  if (orgEstablishYear && orgEstablishYearErr) clearInvalid(orgEstablishYear, orgEstablishYearErr)
  if (orgSlug && orgSlugErr) clearInvalid(orgSlug, orgSlugErr)

  if (keepFocus && orgShortName) orgShortName.focus()
}

function validateOrgForm() {
  let ok = true

  const shortName = norm(orgShortName?.value)
  if (!shortName) {
    setInvalid(orgShortName, orgShortNameErr, '企业简称为必填。')
    ok = false
  } else clearInvalid(orgShortName, orgShortNameErr)

  const slug = norm(orgSlug?.value)
  if (!slug) {
    setInvalid(orgSlug, orgSlugErr, 'slug 为必填。')
    ok = false
  } else if (!isValidSlug(slug)) {
    setInvalid(orgSlug, orgSlugErr, 'slug 仅允许 a-z / 0-9 / 连字符 -（建议小写）。')
    ok = false
  } else clearInvalid(orgSlug, orgSlugErr)

  const yr = validateEstablishYear(orgEstablishYear?.value)
  if (yr.error) {
    setInvalid(orgEstablishYear, orgEstablishYearErr, yr.error)
    ok = false
  } else {
    clearInvalid(orgEstablishYear, orgEstablishYearErr)
  }

  return ok
}

// open org modal
if (btnOpenOrg && orgModal) {
  btnOpenOrg.addEventListener('click', () => {
    openModal(orgModal)
    orgShortName?.focus()
  })
}

// close org modal
if (orgClose && orgModal) orgClose.addEventListener('click', () => closeModal(orgModal))
if (orgModal) {
  orgModal.addEventListener('click', (e) => {
    if (e.target === orgModal) closeModal(orgModal)
  })
}

// reset
if (orgReset) orgReset.addEventListener('click', () => resetOrgForm())

// submit
if (orgSubmit) {
  orgSubmit.addEventListener('click', async () => {
    if (!validateOrgForm()) return

    const yr = validateEstablishYear(orgEstablishYear?.value)
    const payload = {
      organization_short_name: norm(orgShortName?.value),
      organization_full_name: norm(orgFullName?.value) || null,
      establish_year: yr.value, // null 或 number
      organization_slug: norm(orgSlug?.value),
    }

    // 关键修复：这里不要 await 一个“等你点确定才 resolve”的 Promise
    showConfirm({ title: '录入中', body: '写入中…请稍候', okText: '确定', okEnabled: false })

    try {
      // 真正发请求写库
      const res = await apiPostJson(API_ORG_CREATE, payload, getToken())

      updateConfirm({
        title: '录入成功',
        body: `✅ 已写入 organization\n\n返回：${JSON.stringify(res ?? {}, null, 2)}`,
        okText: '确认返回',
        okEnabled: true,
      })

      // 用户点“确认返回”后：关闭 confirm，保留 orgModal，清空表单便于连续录入
      // confirm 的关闭由按钮 click 处理（hideConfirm）
      // 这里监听 confirm 关闭：用一次性轮询，简单稳定
      const waitClosed = () => new Promise((r) => {
        const t = setInterval(() => {
          if (confirmOverlay && confirmOverlay.style.display === 'none') {
            clearInterval(t); r()
          }
        }, 80)
      })
      await waitClosed()

      // 返回到企业弹窗并清空
      openModal(orgModal)
      resetOrgForm({ keepFocus: true })
    } catch (e) {
      updateConfirm({
        title: '录入失败',
        body: `❌ ${e?.message || String(e)}`,
        okText: '确认返回',
        okEnabled: true,
      })
    }
  })
}
