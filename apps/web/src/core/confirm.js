// apps/web/src/core/confirm.js

/**
 * =========================
 * Confirm modal helper
 * loading -> result -> ack
 * =========================
 *
 * 依赖：
 * - DOM: #confirmOverlay, #confirmTitle, #confirmBody, #confirmOk
 * - openModal / closeModal 与你现有 dom.js 保持一致
 */

export function initConfirm({ $, openModal, closeModal }) {
  if (typeof $ !== 'function') throw new Error('initConfirm: missing $')
  if (typeof openModal !== 'function') throw new Error('initConfirm: missing openModal')
  if (typeof closeModal !== 'function') throw new Error('initConfirm: missing closeModal')

  const overlay = $('confirmOverlay')
  const titleEl = $('confirmTitle')
  const bodyEl = $('confirmBody')
  const okBtn = $('confirmOk')

  if (!overlay || !titleEl || !bodyEl || !okBtn) {
    throw new Error('initConfirm: confirm modal elements not found (check ids in admin.html)')
  }

  function createConfirm() {
    let resolver = null

    function open() { openModal(overlay) }
    function close() { closeModal(overlay) }

    function setLoading(title = '录入中', body = '请稍候…') {
      titleEl.textContent = title
      bodyEl.textContent = body
      okBtn.disabled = true
      open()
    }

    function setResult(ok, message) {
      titleEl.textContent = ok ? '完成' : '失败'
      bodyEl.textContent = message || ''
      okBtn.disabled = false
      open()
    }

    function waitAck() {
      return new Promise((resolve) => {
        resolver = resolve
        const onClick = () => {
          okBtn.removeEventListener('click', onClick)
          close()
          resolver && resolver(true)
          resolver = null
        }
        okBtn.addEventListener('click', onClick)
      })
    }

    return { setLoading, setResult, waitAck }
  }

  const confirm = createConfirm()

  async function showConfirmFlow({ titleLoading, bodyLoading, action }) {
    confirm.setLoading(titleLoading || '录入中', bodyLoading || '请稍候…')
    try {
      const msg = await action()
      confirm.setResult(true, msg || '✅ 成功')
    } catch (e) {
      confirm.setResult(false, `❌ 失败：${e?.message || String(e)}`)
    }
    await confirm.waitAck()
  }

  return { confirm, showConfirmFlow }
}
