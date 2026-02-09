// apps/web/src/features/domain.js
import { createEntitySearch } from '../ui/entity-search.js'

export function mountDomainAdmin({
  $,
  openModal,
  closeModal,
  setInvalid,
  clearInvalid,
  norm,
  isSlug,
  apiFetch,
  getToken,
  showConfirmFlow,
}) {
  // Modal
  const domainModal = $('domainModal')
  const btnOpenDomain = $('btnOpenDomain')
  const domainClose = $('domainClose')

  // Fields
  const domainName = $('domainName')
  const domainNameErr = $('domainNameErr')

  const domainIsAlias = $('domainIsAlias')
  const domainIsAliasErr = $('domainIsAliasErr')

  const domainSlugRow = $('domainSlugRow')
  const domainSlug = $('domainSlug')
  const domainSlugErr = $('domainSlugErr')

  const domainDescRow = $('domainDescRow')
  const domainDesc = $('domainDesc')

  const domainAliasTargetRow = $('domainAliasTargetRow')
  const domainAliasTargetSearch = $('domainAliasTargetSearch')
  const domainAliasTargetStatus = $('domainAliasTargetStatus')
  const domainAliasTargetList = $('domainAliasTargetList')
  const domainAliasTargetPicked = $('domainAliasTargetPicked')
  const domainAliasTargetClear = $('domainAliasTargetClear')
  const domainAliasTargetErr = $('domainAliasTargetErr')

  // Actions
  const domainReset = $('domainReset')
  const domainSubmit = $('domainSubmit')

  // State
  let aliasTarget = null // { id, name, slug }

  function open() { openModal(domainModal) }
  function close() { closeModal(domainModal) }

  btnOpenDomain.addEventListener('click', () => {
    open()
    syncDomainModeUI()
    domainSearch.clear()
    domainSearch.focus()
  })
  domainClose.addEventListener('click', () => close())

  function isAliasMode() {
    const v = String(domainIsAlias.value || '').trim()
    return v === 'yes'
  }

  function syncDomainModeUI() {
    const alias = isAliasMode()

    // “否” -> slug + description
    domainSlugRow.style.display = alias ? 'none' : ''
    domainDescRow.style.display = alias ? 'none' : ''

    // “是” -> alias target selector
    domainAliasTargetRow.style.display = alias ? '' : 'none'

    // 清理错误展示（不影响输入值）
    clearInvalid(domainSlug, domainSlugErr)
    domainAliasTargetErr.textContent = ''
    domainAliasTargetErr.style.display = 'none'

    // picked 信息
    renderPickedTarget()
  }

  domainIsAlias.addEventListener('change', () => {
    syncDomainModeUI()
  })

  function renderPickedTarget() {
    if (!isAliasMode()) {
      domainAliasTargetPicked.textContent = ''
      domainAliasTargetClear.style.display = 'none'
      return
    }
    if (!aliasTarget) {
      domainAliasTargetPicked.textContent = '未选择（请在下方搜索并点击一个安全领域）'
      domainAliasTargetClear.style.display = 'none'
      return
    }
    const suffix = aliasTarget.slug ? `（slug: ${aliasTarget.slug}）` : ''
    domainAliasTargetPicked.textContent = `已选择：${aliasTarget.name} ${suffix} [ID=${aliasTarget.id}]`
    domainAliasTargetClear.style.display = ''
  }

  domainAliasTargetClear.addEventListener('click', () => {
    aliasTarget = null
    renderPickedTarget()
  })

  function clearErrors() {
    clearInvalid(domainName, domainNameErr)
    clearInvalid(domainIsAlias, domainIsAliasErr)
    clearInvalid(domainSlug, domainSlugErr)

    domainAliasTargetErr.textContent = ''
    domainAliasTargetErr.style.display = 'none'
  }

  function setAliasTargetErr(msg) {
    domainAliasTargetErr.textContent = msg
    domainAliasTargetErr.style.display = msg ? 'block' : 'none'
  }

  function validate() {
    clearErrors()

    let ok = true

    const name = norm(domainName.value)
    if (!name) {
      setInvalid(domainName, domainNameErr, '安全领域名称为必填。')
      ok = false
    }

    const isAliasVal = String(domainIsAlias.value || '').trim()
    if (!isAliasVal) {
      setInvalid(domainIsAlias, domainIsAliasErr, '请选择“是否是安全领域别名”。')
      ok = false
    }

    if (isAliasMode()) {
      if (!aliasTarget?.id) {
        setAliasTargetErr('别名模式下必须选择一个“归属的安全领域”。')
        ok = false
      }
    } else {
      const slug = norm(domainSlug.value)
      if (!slug) {
        setInvalid(domainSlug, domainSlugErr, '安全领域 slug 为必填。')
        ok = false
      } else if (!isSlug(slug)) {
        setInvalid(domainSlug, domainSlugErr, 'slug 仅允许 a-z / 0-9 / 连字符 -（建议小写）。')
        ok = false
      }
    }

    return ok
  }

  function resetForm() {
    clearErrors()
    domainName.value = ''
    domainIsAlias.value = 'no'
    domainSlug.value = ''
    domainDesc.value = ''
    aliasTarget = null
    syncDomainModeUI()
    domainSearch.clear()
  }

  domainReset.addEventListener('click', () => resetForm())

  // 内嵌搜索（用于 alias 选择“归属领域”）
  const domainSearch = createEntitySearch({
    inputEl: domainAliasTargetSearch,
    listEl: domainAliasTargetList,
    statusEl: domainAliasTargetStatus,
    searchFn: async (q) => {
      const token = getToken()
      // dropdowns/domains 返回 { items: [{id,name,slug}], ... }
      return await apiFetch(`/api/admin/dropdowns/domains?q=${encodeURIComponent(q)}`, { token })
    },
    renderItem: (it) => ({
      title: it.name || '（未命名领域）',
      subtitle: [
        it.slug ? `slug：${it.slug}` : null,
        it.id ? `ID：${it.id}` : null,
      ].filter(Boolean).join(' · ')
    }),
    onPick: async (it) => {
      aliasTarget = { id: it.id, name: it.name, slug: it.slug || '' }
      renderPickedTarget()
      // 选中后把列表收敛掉（保持体验“单选”）
      domainAliasTargetList.innerHTML = ''
      domainAliasTargetStatus.textContent = '已选择（如需更换可继续搜索并点击新的结果）'
      setAliasTargetErr('')
    }
  })

  domainSubmit.addEventListener('click', async () => {
    if (!validate()) return

    const token = getToken()
    const name = norm(domainName.value)

    domainSubmit.disabled = true
    domainReset.disabled = true

    await showConfirmFlow({
      titleLoading: '录入中',
      bodyLoading: isAliasMode() ? '写入安全领域别名中…' : '写入安全领域中…',
      action: async () => {
        let payload

        if (isAliasMode()) {
          payload = {
            is_alias: true,
            security_domain_alias_name: name,
            security_domain_id: Number(aliasTarget.id),
          }
        } else {
          payload = {
            security_domain_name: name,
            cybersecurity_domain_slug: norm(domainSlug.value),
            security_domain_description: norm(domainDesc.value) || null,
          }
        }

        const res = await apiFetch('/api/admin/domain', { method: 'POST', token, body: payload })

        // 兼容两种返回结构：{domain}/{alias} 或直接 row
        const domainId = res?.domain?.security_domain_id ?? res?.security_domain_id
        const aliasId = res?.alias?.security_domain_alias_id ?? res?.security_domain_alias_id

        close()
        resetForm()

        if (isAliasMode()) {
          return `✅ 写入别名成功：security_domain_alias_id = ${aliasId ?? '（未返回）'}`
        }
        return `✅ 写入领域成功：security_domain_id = ${domainId ?? '（未返回）'}`
      }
    })

    domainSubmit.disabled = false
    domainReset.disabled = false
  })

  // 初始化 UI（默认 no）
  syncDomainModeUI()
}
