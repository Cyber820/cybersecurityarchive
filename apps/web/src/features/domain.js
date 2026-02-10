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

  const req = (id) => {
    const el = $(id)
    if (!el) console.warn(`[domain] missing element #${id}`)
    return el
  }

  const btnOpen = req('btnOpenDomain')

  const modal = req('domainModal')
  const closeBtn = req('domainClose')

  const nameEl = req('domainName')
  const nameErr = req('domainNameErr')

  const isAliasEl = req('domainIsAlias')
  const isAliasErr = req('domainIsAliasErr')

  const slugRow = req('domainSlugRow')
  const slugEl = req('domainSlug')
  const slugErr = req('domainSlugErr')

  const descRow = req('domainDescRow')
  const descEl = req('domainDesc')

  // alias target picker elements
  const aliasTargetRow = req('domainAliasTargetRow')
  const pickedEl = req('domainAliasTargetPicked')
  const clearBtn = req('domainAliasTargetClear')
  const searchInput = req('domainAliasTargetSearch')
  const statusEl = req('domainAliasTargetStatus')
  const listEl = req('domainAliasTargetList')
  const targetErr = req('domainAliasTargetErr')

  const resetBtn = req('domainReset')
  const submitBtn = req('domainSubmit')

  if (
    !btnOpen || !modal || !closeBtn ||
    !nameEl || !nameErr ||
    !isAliasEl || !isAliasErr ||
    !slugRow || !slugEl || !slugErr ||
    !descRow || !descEl ||
    !aliasTargetRow || !pickedEl || !clearBtn || !searchInput || !statusEl || !listEl || !targetErr ||
    !resetBtn || !submitBtn
  ) {
    console.warn('[domain] mountDomainAdmin skipped due to missing DOM nodes.')
    return
  }

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

  function setTargetErr(msg) {
    if (!targetErr) return
    targetErr.textContent = msg || ''
    targetErr.style.display = msg ? '' : 'none'
  }

  const targetPicker = createSingleSelectPicker({
    pickedEl,
    clearBtn,
    inputEl: searchInput,
    statusEl,
    listEl,
    errEl: targetErr,
    emptyText: '未选择（请在下方搜索并点击一个安全领域）',
    searchFn: async (q) => {
      const token = getToken()
      const res = await apiFetch(`/api/admin/dropdowns/domain_union?q=${encodeURIComponent(q)}`, { token })
      return res?.items || []
    },
    renderItem: (it) => {
      const isAlias = it.type === 'alias'
      return {
        title: it.name || '（未命名）',
        subtitle: isAlias ? 'alias' : (it.slug ? `slug：${it.slug}` : ''),
      }
    },
    getId: (it) => it.id,
    getLabel: (it) => it?.name || String(it?.id),
  })

  const aliasSwitch = createAliasSwitch({
    selectEl: isAliasEl,
    rows: {
      main: [slugRow, descRow],
      alias: [aliasTargetRow],
    },
    onChange: () => {
      clearAllErrors()
      if (isAliasEl.value === 'yes') {
        // alias mode: hide slug/desc, show picker
        if (slugEl) slugEl.value = ''
        if (descEl) descEl.value = ''
      } else {
        // main mode: clear target selection
        targetPicker.clear()
      }
    }
  })

  function validate() {
    clearAllErrors()
    setTargetErr('')

    const name = norm(nameEl.value)
    const isAlias = isAliasEl.value === 'yes'
    const slug = norm(slugEl.value)

    let ok = true

    if (!name) {
      setInvalid(nameEl, nameErr, '安全领域名称为必填。')
      ok = false
    }

    if (isAlias) {
      const picked = targetPicker.getSelected()
      if (!picked) {
        setTargetErr('请选择同等安全领域（归属领域）。')
        ok = false
      }
    } else {
      if (!slug) {
        setInvalid(slugEl, slugErr, 'slug 为必填。')
        ok = false
      } else if (!isSlug(slug)) {
        setInvalid(slugEl, slugErr, 'slug 仅允许 a-z / 0-9 / 连字符 -（建议小写）。')
        ok = false
      }
    }

    return ok
  }

  function resetForm() {
    nameEl.value = ''
    isAliasEl.value = 'no'
    if (slugEl) slugEl.value = ''
    if (descEl) descEl.value = ''
    targetPicker.clear()
    aliasSwitch.sync()
    clearAllErrors()
    setTargetErr('')
  }

  btnOpen.addEventListener('click', () => {
    resetForm()
    openModal(modal)
  })

  resetBtn.addEventListener('click', () => resetForm())

  submitBtn.addEventListener('click', async () => {
    if (!validate()) return

    const token = getToken()
    const name = norm(nameEl.value)
    const isAlias = isAliasEl.value === 'yes'

    submitBtn.disabled = true
    resetBtn.disabled = true

    await showConfirmFlow({
      titleLoading: '添加中',
      bodyLoading: isAlias ? '写入安全领域别名中…' : '写入安全领域中…',
      action: async () => {
        if (isAlias) {
          const picked = targetPicker.getSelected()
          const payload = {
            security_domain_alias_name: name,
            security_domain_id: picked.id,
          }
          const res = await apiFetch('/api/admin/domain-alias', { method: 'POST', token, body: payload })
          closeModal(modal)
          resetForm()
          return `✅ 添加成功：security_domain_alias_id = ${res?.security_domain_alias?.security_domain_alias_id ?? res?.security_domain_alias_id ?? '（未返回）'}`
        } else {
          const desc = norm(descEl?.value)
          const payload = {
            security_domain_name: name,
            cybersecurity_domain_slug: norm(slugEl.value),
            security_domain_description: desc ? desc : null,
          }
          const res = await apiFetch('/api/admin/domain', { method: 'POST', token, body: payload })
          closeModal(modal)
          resetForm()
          return `✅ 添加成功：security_domain_id = ${res?.security_domain?.security_domain_id ?? res?.security_domain_id ?? '（未返回）'}`
        }
      }
    })

    submitBtn.disabled = false
    resetBtn.disabled = false
  })
}
