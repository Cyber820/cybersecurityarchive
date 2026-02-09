// apps/web/src/features/product.js
import { createMultiSelectGrid } from '../ui/multiselect-grid.js'
import { createEntitySearch } from '../ui/entity-search.js'

export function mountProductAdmin({
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
  const productModal = $('productModal')
  const btnOpenProduct = $('btnOpenProduct')
  const productClose = $('productClose')

  // Fields
  const productName = $('productName')
  const productNameErr = $('productNameErr')

  const productIsAlias = $('productIsAlias')
  const productIsAliasErr = $('productIsAliasErr')

  const productSlugRow = $('productSlugRow')
  const productSlug = $('productSlug')
  const productSlugErr = $('productSlugErr')

  const productDomainsRow = $('productDomainsRow')
  const productDomainsHost = $('productDomains')
  const productDomainsErr = $('productDomainsErr')

  const productDescRow = $('productDescRow')
  const productDesc = $('productDesc')

  // Alias target selector
  const productAliasTargetRow = $('productAliasTargetRow')
  const productAliasTargetSearch = $('productAliasTargetSearch')
  const productAliasTargetStatus = $('productAliasTargetStatus')
  const productAliasTargetList = $('productAliasTargetList')
  const productAliasTargetPicked = $('productAliasTargetPicked')
  const productAliasTargetClear = $('productAliasTargetClear')
  const productAliasTargetErr = $('productAliasTargetErr')

  // Actions
  const productReset = $('productReset')
  const productSubmit = $('productSubmit')

  // State
  let aliasTarget = null // { id, name, slug }
  let domainGrid = null

  function isAliasMode() {
    const v = String(productIsAlias.value || '').trim()
    return v === 'yes'
  }

  function setDomainsErr(msg) {
    productDomainsErr.textContent = msg
    productDomainsErr.style.display = msg ? 'block' : 'none'
  }

  function setAliasTargetErr(msg) {
    productAliasTargetErr.textContent = msg
    productAliasTargetErr.style.display = msg ? 'block' : 'none'
  }

  function clearErrors() {
    clearInvalid(productName, productNameErr)
    clearInvalid(productIsAlias, productIsAliasErr)
    clearInvalid(productSlug, productSlugErr)

    setDomainsErr('')
    setAliasTargetErr('')
  }

  function renderPickedTarget() {
    if (!isAliasMode()) {
      productAliasTargetPicked.textContent = ''
      productAliasTargetClear.style.display = 'none'
      return
    }
    if (!aliasTarget) {
      productAliasTargetPicked.textContent = '未选择（请在下方搜索并点击一个安全产品）'
      productAliasTargetClear.style.display = 'none'
      return
    }
    const suffix = aliasTarget.slug ? `（slug: ${aliasTarget.slug}）` : ''
    productAliasTargetPicked.textContent = `已选择：${aliasTarget.name} ${suffix} [ID=${aliasTarget.id}]`
    productAliasTargetClear.style.display = ''
  }

  async function refreshDomainGrid() {
    const token = getToken()
    const res = await apiFetch('/api/admin/dropdowns/domains', { token })

    // dropdowns/domains 返回 items: [{id,name,slug}]
    const options = (res?.items || []).map(x => ({
      id: x.id,
      name: x.name,
      slug: x.slug ?? null,
      description: null,
    }))

    if (!domainGrid) {
      domainGrid = createMultiSelectGrid({
        title: '安全领域',
        required: true,
        placeholder: '搜索领域名称（也支持输入 slug 搜索，但不显示 slug）…',
        columns: 3,
        options,
        searchText: (o) => `${o?.name ?? ''} ${o?.slug ?? ''}`.trim(),
      })
      productDomainsHost.innerHTML = ''
      productDomainsHost.appendChild(domainGrid.element)
    } else {
      domainGrid.setOptions(options)
    }
  }

  function syncProductModeUI() {
    const alias = isAliasMode()

    // 非别名：slug + domains + description
    productSlugRow.style.display = alias ? 'none' : ''
    productDomainsRow.style.display = alias ? 'none' : ''
    productDescRow.style.display = alias ? 'none' : ''

    // 别名：target selector（单选）
    productAliasTargetRow.style.display = alias ? '' : 'none'

    // 清理非当前模式下的错误显示（不清空输入）
    clearInvalid(productSlug, productSlugErr)
    setDomainsErr('')
    setAliasTargetErr('')

    renderPickedTarget()
  }

  // Alias target search (single select)
  const productSearch = createEntitySearch({
    inputEl: productAliasTargetSearch,
    listEl: productAliasTargetList,
    statusEl: productAliasTargetStatus,
    searchFn: async (q) => {
      const token = getToken()
      return await apiFetch(`/api/admin/dropdowns/products?q=${encodeURIComponent(q)}`, { token })
    },
    renderItem: (it) => ({
      title: it.name || '（未命名产品）',
      subtitle: [
        it.slug ? `slug：${it.slug}` : null,
        it.id ? `ID：${it.id}` : null,
      ].filter(Boolean).join(' · ')
    }),
    onPick: async (it) => {
      aliasTarget = { id: it.id, name: it.name, slug: it.slug || '' }
      renderPickedTarget()
      productAliasTargetList.innerHTML = ''
      productAliasTargetStatus.textContent = '已选择（如需更换可继续搜索并点击新的结果）'
      setAliasTargetErr('')
    }
  })

  productAliasTargetClear.addEventListener('click', () => {
    aliasTarget = null
    renderPickedTarget()
  })

  productIsAlias.addEventListener('change', async () => {
    syncProductModeUI()
    if (!isAliasMode()) {
      // 回到非别名时，确保 domains grid 已准备好（保持体验一致）
      try { await refreshDomainGrid() } catch (e) { console.error(e) }
    }
  })

  function validate() {
    clearErrors()
    let ok = true

    const name = norm(productName.value)
    if (!name) {
      setInvalid(productName, productNameErr, '安全产品名称为必填。')
      ok = false
    }

    const isAliasVal = String(productIsAlias.value || '').trim()
    if (!isAliasVal) {
      setInvalid(productIsAlias, productIsAliasErr, '请选择“是否是安全产品别名”。')
      ok = false
    }

    if (isAliasMode()) {
      if (!aliasTarget?.id) {
        setAliasTargetErr('别名模式下必须选择一个“归属的安全产品”。')
        ok = false
      }
      return ok
    }

    // non-alias
    const slug = norm(productSlug.value)
    if (!slug) {
      setInvalid(productSlug, productSlugErr, '安全产品 slug 为必填。')
      ok = false
    } else if (!isSlug(slug)) {
      setInvalid(productSlug, productSlugErr, 'slug 仅允许 a-z / 0-9 / 连字符 -（建议小写）。')
      ok = false
    }

    const selectedRaw = domainGrid?.getValues?.() || []
    const selected = selectedRaw.map(x => Number(x)).filter(n => Number.isFinite(n))
    if (selected.length === 0) {
      setDomainsErr('至少选择一个安全领域。')
      ok = false
    }

    return ok
  }

  async function collectPayload() {
    const name = norm(productName.value)

    if (isAliasMode()) {
      return {
        is_alias: true,
        security_product_alias_name: name,
        security_product_id: Number(aliasTarget.id),
      }
    }

    await refreshDomainGrid()
    const selectedRaw = domainGrid?.getValues?.() || []
    const selected = selectedRaw.map(x => Number(x)).filter(n => Number.isFinite(n))

    return {
      security_product_name: name,
      security_product_slug: norm(productSlug.value),
      security_product_description: norm(productDesc.value) || null,
      domains: selected,
    }
  }

  async function resetForm() {
    clearErrors()
    productName.value = ''
    productIsAlias.value = 'no'
    productSlug.value = ''
    productDesc.value = ''
    aliasTarget = null

    // domains
    if (domainGrid?.clear) domainGrid.clear()

    // search
    productSearch.clear()
    productAliasTargetList.innerHTML = ''
    productAliasTargetStatus.textContent = '输入关键字开始搜索。'

    syncProductModeUI()

    // 确保非别名默认打开时 grid 可用
    try { await refreshDomainGrid() } catch (e) { console.error(e) }
  }

  btnOpenProduct.addEventListener('click', async () => {
    openModal(productModal)
    syncProductModeUI()
    if (!isAliasMode()) {
      try { await refreshDomainGrid() } catch (e) { console.error(e) }
    } else {
      productSearch.clear()
      productSearch.focus()
    }
  })
  productClose.addEventListener('click', () => closeModal(productModal))

  productReset.addEventListener('click', async () => {
    await resetForm()
  })

  productSubmit.addEventListener('click', async () => {
    // 非别名时 grid 需要先准备好，否则 validate 时拿不到 selected
    if (!isAliasMode()) {
      try { await refreshDomainGrid() } catch (e) { console.error(e) }
    }

    if (!validate()) return

    const token = getToken()
    const payload = await collectPayload()

    productSubmit.disabled = true
    productReset.disabled = true

    await showConfirmFlow({
      titleLoading: '录入中',
      bodyLoading: isAliasMode() ? '写入安全产品别名中…' : '写入安全产品中…',
      action: async () => {
        const res = await apiFetch('/api/admin/product', { method: 'POST', token, body: payload })

        const pid = res?.product?.security_product_id ?? res?.security_product_id
        const aid = res?.alias?.security_product_alias_id ?? res?.security_product_alias_id

        closeModal(productModal)
        await resetForm()

        if (isAliasMode()) {
          return `✅ 写入别名成功：security_product_alias_id = ${aid ?? '（未返回）'}`
        }
        return `✅ 写入产品成功：security_product_id = ${pid ?? '（未返回）'}`
      }
    })

    productSubmit.disabled = false
    productReset.disabled = false
  })

  // init
  syncProductModeUI()
  // 默认 no：预热 domains grid
  refreshDomainGrid().catch(() => {})
}
