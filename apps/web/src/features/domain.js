// apps/web/src/features/domain.js
import { createAliasSwitch } from '../ui/alias-switch.js'
import { createSingleSelectPicker } from '../ui/single-select-picker.js'

export function mountDomainAdmin(ctx) {
  const {
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
  } = ctx

  const btnOpen = $('btnOpenDomain')

  const modal = $('domainModal')
  const closeBtn = $('domainClose')

  const nameEl = $('domainName')
  const nameErr = $('domainNameErr')

  const isAliasEl = $('domainIsAlias')
  const isAliasErr = $('domainIsAliasErr')

  const slugRow = $('domainSlugRow')
  const slugEl = $('domainSlug')
  const slugErr = $('domainSlugErr')

  const descRow = $('domainDescRow')
  const descEl = $('domainDesc')

  // alias target picker elements
  const aliasTargetRow = $('domainAliasTargetRow')
  const pickedEl = $('domainAliasTargetPicked')
  const clearBtn = $('domainAliasTargetClear')
  const searchInput = $('domainAliasTargetSearch')
  const statusEl = $('domainAliasTargetStatus')
  const listEl = $('domainAliasTargetList')
  const targetErr = $('domainAliasTargetErr')

  const resetBtn = $('domainReset')
  const submitBtn = $('domainSubmit')

  closeBtn.addEventListener('click', () => closeModal(modal))

  function clearAllErrors() {
    clearInvalid(nameEl, nameErr)
    clearInvalid(isAliasEl, isAliasErr)
    clearInvalid(slugEl, slugErr)
    if (targetErr) {
      targetErr.textContent = ''
      targetErr.style.display = 'none'
    }
  }

  function resetForm() {
    nameEl.value = ''
    isAliasEl.value = 'no'
    slugEl.value = ''
    if (descEl) descEl.value = ''
    aliasPicker.clear()
    clearAllErrors()
    aliasSwitch.applyMode('no', { emit: false })
  }

  // 单选：选择“同等安全领域”
  const aliasPicker = createSingleSelectPicker({
    pickedEl,
    clearBtn,
    inputEl: searchInput,
    statusEl,
    listEl,
    errEl: targetErr,
    emptyText: '未选择（请在下方搜索并点击一个安全领域）',
    searchFn: async (q) => {
      const token = getToken()
      return await apiFetch(`/api/admin/dropdowns/domains?q=${encodeURIComponent(q)}`, { token })
    },
    renderItem: (it) => ({
      title: it.security_domain_name || it.domain_name || it.name || '（未命名领域）',
      subtitle: [
        it.cybersecurity_domain_slug ? `slug：${it.cybersecurity_domain_slug}` : null,
        it.security_domain_id ? `ID：${it.security_domain_id}` : null,
      ].filter(Boolean).join(' · ')
    }),
    getId: (it) => it.security_domain_id ?? it.id,
    getLabel: (it, rendered) => rendered?.title ?? String(it.security_domain_id ?? it.id ?? ''),
  })

  const aliasSwitch = createAliasSwitch({
    selectEl: isAliasEl,
    rowsWhenMain: [slugRow, descRow],
    rowsWhenAlias: [aliasTargetRow],
    onModeChange: (mode) => {
      clearAllErrors()
      if (mode === 'yes') {
        slugEl.value = ''
        if (descEl) descEl.value = ''
      } else {
        aliasPicker.clear()
      }
    }
  })

  function validate() {
    clearAllErrors()

    let ok = true
    const name = norm(nameEl.value)
    if (!name) {
      setInvalid(nameEl, nameErr, '安全领域名称为必填。')
      ok = false
    }

    const mode = aliasSwitch.getMode()
    if (mode === 'no') {
      const slug = norm(slugEl.value)
      if (!slug) {
        setInvalid(slugEl, slugErr, '安全领域 slug 为必填。')
        ok = false
      } else if (!isSlug(slug)) {
        setInvalid(slugEl, slugErr, 'slug 仅允许 a-z / 0-9 / 连字符 -（建议小写）。')
        ok = false
      }
    } else {
      if (!aliasPicker.validateRequired('请选择“同等安全领域”。')) ok = false
    }

    return ok
  }

  function collectPayload() {
    const name = norm(nameEl.value)
    const mode = aliasSwitch.getMode()
    const desc = norm(descEl?.value)

    if (mode === 'no') {
      const slug = norm(slugEl.value)
      return {
        mode: 'main',
        payload: {
          security_domain_name: name,
          cybersecurity_domain_slug: slug,
          security_domain_description: desc || null,
        }
      }
    }

    const sel = aliasPicker.getSelected()
    return {
      mode: 'alias',
      payload: {
        security_domain_alias_name: name,
        security_domain_id: sel?.id,
      }
    }
  }

  resetBtn.addEventListener('click', () => {
    resetForm()
  })

  submitBtn.addEventListener('click', async () => {
    if (!validate()) return

    const token = getToken()
    const { mode, payload } = collectPayload()

    submitBtn.disabled = true
    resetBtn.disabled = true

    await showConfirmFlow({
      titleLoading: mode === 'main' ? '添加中' : '添加别名中',
      bodyLoading: mode === 'main' ? '写入安全领域中…' : '写入安全领域别名中…',
      action: async () => {
        const url = mode === 'main' ? '/api/admin/domain' : '/api/admin/domain/alias'
        const res = await apiFetch(url, { method: 'POST', token, body: payload })
        closeModal(modal)
        resetForm()
        return `✅ 添加成功：${res?.id ?? res?.security_domain_id ?? res?.security_domain_alias_id ?? '（未返回）'}`
      }
    })

    submitBtn.disabled = false
    resetBtn.disabled = false
  })

  btnOpen.addEventListener('click', () => {
    resetForm()
    openModal(modal)
    nameEl.focus()
  })
}
