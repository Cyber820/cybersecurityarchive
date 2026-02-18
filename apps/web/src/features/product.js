// apps/web/src/features/product.js
import { createAliasSwitch } from '../ui/alias-switch.js'
import { createSingleSelectPicker } from '../ui/single-select-picker.js'
import { createMultiSelectPicker } from '../ui/multi-select-picker.js'

export function mountProductAdmin(ctx) {
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

  const btnOpen = $('btnOpenProduct')
  const modal = $('productModal')
  const closeBtn = $('productClose')

  const nameEl = $('productName')
  const nameErr = $('productNameErr')

  const isAliasEl = $('productIsAlias')
  const isAliasErr = $('productIsAliasErr')

  const slugRow = $('productSlugRow')
  const slugEl = $('productSlug')
  const slugErr = $('productSlugErr')

  const domainsRow = $('productDomainsRow')
  const domainsHost = $('productDomains')
  const domainsErr = $('productDomainsErr')

  const descRow = $('productDescRow')
  const descEl = $('productDesc')

  const aliasTargetRow = $('productAliasTargetRow')
  const pickedEl = $('productAliasTargetPicked')
  const clearBtn = $('productAliasTargetClear')
  const searchInput = $('productAliasTargetSearch')
  const statusEl = $('productAliasTargetStatus')
  const listEl = $('productAliasTargetList')
  const targetErr = $('productAliasTargetErr')

  const resetBtn = $('productReset')
  const submitBtn = $('productSubmit')

  // ---- 基础 DOM 防御：缺节点就直接不挂载，避免整页炸 ----
  const required = [
    ['btnOpenProduct', btnOpen],
    ['productModal', modal],
    ['productClose', closeBtn],
    ['productName', nameEl],
    ['productNameErr', nameErr],
    ['productIsAlias', isAliasEl],
    ['productIsAliasErr', isAliasErr],
    ['productSlugRow', slugRow],
    ['productSlug', slugEl],
    ['productSlugErr', slugErr],
    ['productDomainsRow', domainsRow],
    ['productDomains', domainsHost],
    ['productDomainsErr', domainsErr],
    ['productReset', resetBtn],
    ['productSubmit', submitBtn],
  ]
  for (const [id, el] of required) {
    if (!el) {
      console.warn(`[product] missing element #${id}`)
      return
    }
  }

  closeBtn.addEventListener('click', () => closeModal(modal))

  function showErr(errEl, msg) {
    if (!errEl) return
    errEl.textContent = msg || ''
    errEl.style.display = msg ? 'block' : 'none'
  }

  function clearAllErrors() {
    clearInvalid(nameEl, nameErr)
    clearInvalid(isAliasEl, isAliasErr)
    clearInvalid(slugEl, slugErr)
    showErr(domainsErr, '')
    showErr(targetErr, '')
  }

  // 多选：对应安全领域
  const domainMulti = createMultiSelectPicker({
    hostEl: domainsHost,
    errEl: domainsErr,
    emptyText: '未选择（请点击展开并搜索勾选）',
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

  // 单选：归属安全产品（别名模式）
  const aliasPicker = createSingleSelectPicker({
    pickedEl,
    clearBtn,
    inputEl: searchInput,
    statusEl,
    listEl,
    errEl: targetErr,
    emptyText: '未选择（请在下方搜索并点击一个安全产品）',
    searchFn: async (q) => {
      const token = getToken()
      return await apiFetch(`/api/admin/dropdowns/products?q=${encodeURIComponent(q)}`, { token })
    },
    renderItem: (it) => ({
      title: it.security_product_name || it.product_name || it.name || '（未命名产品）',
      subtitle: [
        it.security_product_slug ? `slug：${it.security_product_slug}` : null,
        it.security_product_id ? `ID：${it.security_product_id}` : null,
      ].filter(Boolean).join(' · ')
    }),
    getId: (it) => it.security_product_id ?? it.id,
    getLabel: (it, rendered) => rendered?.title ?? String(it.security_product_id ?? it.id ?? ''),
  })

  const aliasSwitch = createAliasSwitch({
    selectEl: isAliasEl,
    rowsWhenMain: [slugRow, domainsRow, descRow],
    rowsWhenAlias: [aliasTargetRow],
    onModeChange: (mode) => {
      clearAllErrors()
      if (mode === 'yes') {
        // 切 alias：清空 main 字段
        slugEl.value = ''
        domainMulti.clear()
        if (descEl) descEl.value = ''
      } else {
        // 切 main：清空 alias 选择
        aliasPicker.clear()
      }
    }
  })

  function resetForm() {
    nameEl.value = ''
    isAliasEl.value = 'no'
    slugEl.value = ''
    domainMulti.clear()
    if (descEl) descEl.value = ''
    aliasPicker.clear()
    clearAllErrors()

    aliasSwitch.applyMode('no', { emit: false })
  }

  function validate() {
    clearAllErrors()

    let ok = true
    const name = norm(nameEl.value)
    if (!name) {
      setInvalid(nameEl, nameErr, '安全产品名称为必填。')
      ok = false
    }

    const mode = aliasSwitch.getMode()
    if (mode === 'no') {
      const slug = norm(slugEl.value)
      if (!slug) {
        setInvalid(slugEl, slugErr, '安全产品 slug 为必填。')
        ok = false
      } else if (!isSlug(slug)) {
        setInvalid(slugEl, slugErr, 'slug 仅允许 a-z / 0-9 / 连字符 -（建议小写）。')
        ok = false
      }

      const domainIds = domainMulti.getConfirmedIds()
      if (!domainIds || !domainIds.length) {
        showErr(domainsErr, '请至少选择 1 个安全领域。')
        ok = false
      }
    } else {
      if (!aliasPicker.validateRequired('请选择“归属安全产品”。')) ok = false
    }

    return ok
  }

  function collectPayload() {
    const name = norm(nameEl.value)
    const mode = aliasSwitch.getMode()
    const desc = norm(descEl?.value)

    if (mode === 'no') {
      const slug = norm(slugEl.value)
      const domainIds = domainMulti.getConfirmedIds()
      return {
        mode: 'main',
        payload: {
          security_product_name: name,
          security_product_slug: slug,
          security_product_description: desc || null,
          domains: domainIds,
        }
      }
    }

    const sel = aliasPicker.getSelected()
    return {
      mode: 'alias',
      payload: {
        security_product_alias_name: name,
        security_product_id: sel?.id,
      }
    }
  }

  function pickCreatedId(res, mode) {
    // 兼容不同返回风格（本项目后端：main => {product, domains_bound}; alias => {alias}）
    if (!res) return null

    if (mode === 'main') {
      return (
        res?.product?.security_product_id ??
        res?.product?.id ??
        res?.security_product_id ??
        res?.id ??
        null
      )
    }

    // alias
    return (
      res?.alias?.security_product_alias_id ??
      res?.alias?.id ??
      res?.security_product_alias_id ??
      res?.id ??
      null
    )
  }

  resetBtn.addEventListener('click', () => resetForm())

  submitBtn.addEventListener('click', async () => {
    if (!validate()) return

    const token = getToken()
    const { mode, payload } = collectPayload()

    submitBtn.disabled = true
    resetBtn.disabled = true

    await showConfirmFlow({
      titleLoading: mode === 'main' ? '添加中' : '添加别名中',
      bodyLoading: mode === 'main' ? '写入安全产品中…' : '写入安全产品别名中…',
      action: async () => {
        const url = mode === 'main' ? '/api/admin/product' : '/api/admin/product/alias'
        const res = await apiFetch(url, { method: 'POST', token, body: payload })
        closeModal(modal)
        resetForm()

        const createdId = pickCreatedId(res, mode)
        return `✅ 添加成功：${createdId ?? '（未返回）'}`
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
