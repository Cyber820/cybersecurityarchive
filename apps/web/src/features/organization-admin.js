// apps/web/src/features/organization-admin.js

/**
 * Organization Feature（企业/机构基础信息）
 *
 * 负责：
 * - 打开/关闭“添加企业/机构”弹窗
 * - 校验（必填、slug 规则、成立年份范围）
 * - POST /api/admin/organization
 */

export function mountOrganizationAdmin(ctx) {
  const {
    API,
    $, norm,
    openModal, closeModal,
    showConfirm, updateConfirm,
    apiPostJson,
    getToken,
    setInvalid, clearInvalid,
    isValidSlug,
    validateEstablishYear,
  } = ctx

  const btnOpen = $('#btnOpenOrg')
  const modal = $('#orgModal')
  const btnClose = $('#orgClose')
  const btnReset = $('#orgReset')
  const btnSubmit = $('#orgSubmit')

  const shortName = $('#orgShortName')
  const shortNameErr = $('#orgShortNameErr')
  const fullName = $('#orgFullName')
  const establishYear = $('#orgEstablishYear')
  const establishYearErr = $('#orgEstablishYearErr')
  const slug = $('#orgSlug')
  const slugErr = $('#orgSlugErr')

  if (!btnOpen || !modal || !btnClose || !btnReset || !btnSubmit || !shortName || !fullName || !establishYear || !slug) {
    console.warn('[organization-admin] missing DOM nodes, feature disabled')
    return
  }

  function resetForm() {
    shortName.value = ''
    fullName.value = ''
    establishYear.value = ''
    slug.value = ''

    clearInvalid(shortName, shortNameErr)
    clearInvalid(establishYear, establishYearErr)
    clearInvalid(slug, slugErr)
  }

  function validate() {
    let ok = true

    if (!norm(shortName.value)) {
      ok = false
      setInvalid(shortName, shortNameErr, '企业简称为必填。')
    } else {
      clearInvalid(shortName, shortNameErr)
    }

    const slugVal = norm(slug.value)
    if (!slugVal) {
      ok = false
      setInvalid(slug, slugErr, 'slug 为必填。')
    } else if (!isValidSlug(slugVal)) {
      ok = false
      setInvalid(slug, slugErr, 'slug 仅允许 a-z / 0-9 / 连字符 -（建议小写）。')
    } else {
      clearInvalid(slug, slugErr)
    }

    const yearCheck = validateEstablishYear(establishYear.value)
    if (yearCheck.error) {
      ok = false
      setInvalid(establishYear, establishYearErr, yearCheck.error)
    } else {
      clearInvalid(establishYear, establishYearErr)
    }

    return ok
  }

  async function submit() {
    if (!validate()) return

    const yearCheck = validateEstablishYear(establishYear.value)

    const payload = {
      organization_short_name: norm(shortName.value),
      organization_full_name: norm(fullName.value) || null,
      establish_year: yearCheck.value,
      organization_slug: norm(slug.value),
    }

    showConfirm({ title: '录入中', body: '写入企业/机构…', okEnabled: false })

    try {
      const token = getToken()
      const res = await apiPostJson(API.createOrganization, payload, token)
      updateConfirm({
        title: '录入成功',
        body: `✅ 企业/机构已写入\n${JSON.stringify(res, null, 2)}`,
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
