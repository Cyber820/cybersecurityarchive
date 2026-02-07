// apps/web/src/features/domain-admin.js 

/**
 * Domain Feature（录入安全领域）
 * - 只负责：打开/关闭弹窗、校验、POST /api/admin/domain
 * - 依赖：admin.js 注入的 helpers（modal、confirm、apiPostJson、token 等）
 */

export function mountDomainAdmin(ctx) {
  const {
    API,
    FIELD,
    $, norm,
    openModal, closeModal,
    showConfirm, updateConfirm,
    apiPostJson,
    getToken,
    setInvalid, clearInvalid,
  } = ctx

  const btnOpen = $('#btnOpenDomain')
  const modal = $('#domainModal')
  const btnClose = $('#domainClose')
  const btnReset = $('#domainReset')
  const btnSubmit = $('#domainSubmit')

  const name = $('#domainName')
  const nameErr = $('#domainNameErr')
  const slug = $('#domainSlug')
  const slugErr = $('#domainSlugErr')

  if (!btnOpen || !modal || !btnClose || !btnReset || !btnSubmit || !name || !slug) {
    console.warn('[domain-admin] missing DOM nodes, feature disabled')
    return
  }

  function resetForm() {
    name.value = ''
    slug.value = ''
    clearInvalid(name, nameErr)
    clearInvalid(slug, slugErr)
  }

  function validate() {
    let ok = true

    if (!norm(name.value)) {
      ok = false
      setInvalid(name, nameErr, '安全领域名称为必填。')
    } else {
      clearInvalid(name, nameErr)
    }

    const s = norm(slug.value)
    if (!s) {
      ok = false
      setInvalid(slug, slugErr, '安全领域 slug 为必填。')
    } else if (!/^[a-z0-9-]+$/.test(s)) {
      ok = false
      setInvalid(slug, slugErr, 'slug 仅允许 a-z / 0-9 / 连字符 -（建议小写）。')
    } else {
      clearInvalid(slug, slugErr)
    }

    return ok
  }

  async function submit() {
    if (!validate()) return

    const payload = {
      [FIELD.domainName]: norm(name.value),
      [FIELD.domainSlug]: norm(slug.value),
    }

    showConfirm({ title: '录入中', body: '写入安全领域…', okEnabled: false })

    try {
      const token = getToken()
      const res = await apiPostJson(API.createDomain, payload, token)
      updateConfirm({
        title: '录入成功',
        body: `✅ 安全领域已写入\n${JSON.stringify(res, null, 2)}`,
        okEnabled: true,
        okText: '确定',
      })
      resetForm()
      // 保持弹窗打开，方便连续录入
    } catch (e) {
      updateConfirm({
        title: '录入失败',
        body: `❌ ${e?.message || String(e)}`,
        okEnabled: true,
        okText: '确定',
      })
    }
  }

  btnOpen.addEventListener('click', () => openModal(modal))
  btnClose.addEventListener('click', () => closeModal(modal))
  btnReset.addEventListener('click', resetForm)
  btnSubmit.addEventListener('click', submit)
}
