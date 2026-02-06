// apps/web/src/admin.js
import { createMultiSelectGrid } from './ui/multiselect-grid.js' // 你已经在用（领域/产品）的话保留；没有用也不影响，只是未调用

/**
 * =========================
 * 基础：token 缓存
 * =========================
 */
const TOKEN_KEY = 'ia_admin_token_v1'

function $(sel) { return document.querySelector(sel) }

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

function norm(s) { return (s ?? '').toString().trim() }

/**
 * slug 规则：仅 a-z 0-9 -
 * - 你要求“验证英文”，这里用更实际的 slug 校验
 */
function isValidSlug(slug) {
  return /^[a-z0-9-]+$/.test(slug)
}

/**
 * 年份验证：1990 ~ 当前年份
 */
function parseEstablishYear(v) {
  const s = norm(v)
  if (!s) return null
  if (!/^\d{4}$/.test(s)) return { error: '成立时间必须是 4 位数字（YYYY）。' }
  const n = Number(s)
  const nowYear = new Date().getFullYear()
  if (n < 1990 || n > nowYear) return { error: `成立时间范围：1990 ~ ${nowYear}` }
  return { value: n }
}

/**
 * =========================
 * Confirm（录入中/成功/失败）
 * - 你之前要求：录入中 → 成功后直接变成“录入成功”，点击确定回到弹窗
 * =========================
 */
const confirmOverlay = $('#confirmOverlay')
const confirmTitle = $('#confirmTitle')
const confirmBody = $('#confirmBody')
const confirmOk = $('#confirmOk')

let _confirmResolve = null

function openConfirm({ title = '录入中', body = '请稍候…', okText = '确定', okEnabled = false } = {}) {
  confirmTitle.textContent = title
  confirmBody.textContent = body
  confirmOk.textContent = okText
  confirmOk.disabled = !okEnabled

  confirmOverlay.style.display = 'flex'
  confirmOverlay.setAttribute('aria-hidden', 'false')

  return new Promise((resolve) => { _confirmResolve = resolve })
}

function updateConfirm({ title, body, okText, okEnabled } = {}) {
  if (title != null) confirmTitle.textContent = title
  if (body != null) confirmBody.textContent = body
  if (okText != null) confirmOk.textContent = okText
  if (okEnabled != null) confirmOk.disabled = !okEnabled
}

function closeConfirm() {
  confirmOverlay.style.display = 'none'
  confirmOverlay.setAttribute('aria-hidden', 'true')
  if (_confirmResolve) {
    _confirmResolve(true)
    _confirmResolve = null
  }
}

confirmOk.addEventListener('click', () => {
  if (!confirmOk.disabled) closeConfirm()
})

/**
 * =========================
 * API helper
 * =========================
 */
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

/**
 * =========================
 * Modal helpers（避免 aria-hidden focus 报错）
 * - 我们不使用 aria-hidden 来隐藏 focused 元素，统一 display none
 * =========================
 */
function openModal(modalEl) {
  modalEl.style.display = 'flex'
  modalEl.setAttribute('aria-hidden', 'false')
}

function closeModal(modalEl) {
  modalEl.style.display = 'none'
  modalEl.setAttribute('aria-hidden', 'true')
}

/**
 * =========================
 * Token input
 * =========================
 */
const tokenInput = $('#tokenInput')
tokenInput.value = localStorage.getItem(TOKEN_KEY) || ''
tokenInput.addEventListener('input', () => {
  localStorage.setItem(TOKEN_KEY, tokenInput.value)
})

function getToken() {
  return norm(tokenInput.value)
}

/**
 * =========================
 * 添加企业/机构 Modal
 * =========================
 */
const orgModal = $('#orgModal')
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

// 打开按钮
$('#btnOpenOrg').addEventListener('click', () => {
  // 打开时不清空（方便连续录入），但你也可以改成每次清空
  openModal(orgModal)
  // 默认 focus 到必填项
  orgShortName.focus()
})

// 关闭（overlay 点击空白也关闭）
orgClose.addEventListener('click', () => closeModal(orgModal))
orgModal.addEventListener('click', (e) => {
  if (e.target === orgModal) closeModal(orgModal)
})

// 清空
orgReset.addEventListener('click', () => {
  orgShortName.value = ''
  orgFullName.value = ''
  orgEstablishYear.value = ''
  orgSlug.value = ''
  clearInvalid(orgShortName, orgShortNameErr)
  clearInvalid(orgEstablishYear, orgEstablishYearErr)
  clearInvalid(orgSlug, orgSlugErr)
  orgShortName.focus()
})

// 校验 + 提交
function validateOrgForm() {
  let ok = true

  const shortName = norm(orgShortName.value)
  if (!shortName) {
    setInvalid(orgShortName, orgShortNameErr, '企业简称为必填。')
    ok = false
  } else clearInvalid(orgShortName, orgShortNameErr)

  const slug = norm(orgSlug.value)
  if (!slug) {
    setInvalid(orgSlug, orgSlugErr, 'slug 为必填。')
    ok = false
  } else if (!isValidSlug(slug)) {
    setInvalid(orgSlug, orgSlugErr, 'slug 仅允许 a-z / 0-9 / 连字符 -（建议小写）。')
    ok = false
  } else clearInvalid(orgSlug, orgSlugErr)

  const yr = parseEstablishYear(orgEstablishYear.value)
  if (yr && yr.error) {
    setInvalid(orgEstablishYear, orgEstablishYearErr, yr.error)
    ok = false
  } else clearInvalid(orgEstablishYear, orgEstablishYearErr)

  return ok
}

orgSubmit.addEventListener('click', async () => {
  if (!validateOrgForm()) return

  const token = getToken()

  const payload = {
    organization_short_name: norm(orgShortName.value),
    organization_full_name: norm(orgFullName.value) || null,
    establish_year: norm(orgEstablishYear.value) ? Number(norm(orgEstablishYear.value)) : null,
    organization_slug: norm(orgSlug.value),
  }

  // 录入中
  await openConfirm({ title: '录入中', body: '写入中…请稍候', okText: '确定', okEnabled: false })

  try {
    const res = await apiPostJson(API_ORG_CREATE, payload, token)

    // 成功：把“录入中”直接变为“录入成功”
    updateConfirm({
      title: '录入成功',
      body: `✅ 已写入 organization\n\n返回：${JSON.stringify(res ?? {}, null, 2)}`,
      okText: '确认返回',
      okEnabled: true,
    })

    // 等用户点确认
    await new Promise((r) => {
      const t = setInterval(() => {
        if (confirmOverlay.style.display === 'none') {
          clearInterval(t)
          r()
        }
      }, 60)
    })

    // 返回弹窗：保留 token，表单默认清空，方便连续录入
    orgReset.click()
    openModal(orgModal)
  } catch (e) {
    updateConfirm({
      title: '录入失败',
      body: `❌ ${e?.message || String(e)}`,
      okText: '确认返回',
      okEnabled: true,
    })
  }
})

/**
 * =========================
 * 下面三个按钮你已有实现的话保留；没实现也不影响
 * 这里先做占位，避免点击报错
 * =========================
 */
$('#btnOpenDomain').addEventListener('click', () => {
  alert('“录入安全领域”弹窗：你已有实现的话，把这里替换成 openModal(domainModal)。')
})
$('#btnOpenProduct').addEventListener('click', () => {
  alert('“录入安全产品”弹窗：你已有实现的话，把这里替换成 openModal(productModal)。')
})
$('#btnOpenOrgProduct').addEventListener('click', () => {
  alert('“录入企业产品”弹窗：后续实现。')
})
