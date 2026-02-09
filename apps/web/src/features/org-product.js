// apps/web/src/features/org-product.js
import { createEntitySearch } from '../ui/entity-search.js'

export function mountOrgProductAdmin({
  $,
  openModal,
  closeModal,
  setInvalid,
  clearInvalid,
  norm,
  apiFetch,
  getToken,
  showConfirmFlow,
}) {
  const modal = $('orgProductModal')
  const btnOpen = $('btnOpenOrgProduct')
  const closeBtn = $('orgProductClose')

  // organization selector (single)
  const orgPicked = $('orgProductOrgPicked')
  const orgClear = $('orgProductOrgClear')
  const orgSearchInput = $('orgProductOrgSearch')
  const orgSearchStatus = $('orgProductOrgStatus')
  const orgSearchList = $('orgProductOrgList')
  const orgErr = $('orgProductOrgErr')

  // product selector (single, union)
  const prodPicked = $('orgProductProdPicked')
  const prodClear = $('orgProductProdClear')
  const prodSearchInput = $('orgProductProdSearch')
  const prodSearchStatus = $('orgProductProdStatus')
  const prodSearchList = $('orgProductProdList')
  const prodErr = $('orgProductProdErr')

  // years
  const releaseYear = $('orgProductReleaseYear')
  const releaseYearErr = $('orgProductReleaseYearErr')
  const endYear = $('orgProductEndYear')
  const endYearErr = $('orgProductEndYearErr')

  // actions
  const resetBtn = $('orgProductReset')
  const submitBtn = $('orgProductSubmit')

  const nowYear = new Date().getFullYear()

  let pickedOrg = null // { organization_id, display_name, slug? }
  let pickedProduct = null // { product_id, kind, name, extra? }

  function setText(el, s) { el.textContent = s || '' }
  function showErr(el, msg) {
    el.textContent = msg || ''
    el.style.display = msg ? 'block' : 'none'
  }

  function clearErrors() {
    showErr(orgErr, '')
    showErr(prodErr, '')

    clearInvalid(releaseYear, releaseYearErr)
    clearInvalid(endYear, endYearErr)
  }

  function renderPickedOrg() {
    if (!pickedOrg) {
      setText(orgPicked, '未选择（请在下方搜索并点击一个企业/机构）')
      orgClear.style.display = 'none'
      return
    }
    const suffix = pickedOrg.organization_slug ? `（slug: ${pickedOrg.organization_slug}）` : ''
    setText(orgPicked, `已选择：${pickedOrg.display_name} ${suffix} [ID=${pickedOrg.organization_id}]`)
    orgClear.style.display = ''
  }

  function renderPickedProduct() {
    if (!pickedProduct) {
      setText(prodPicked, '未选择（请在下方搜索并点击一个安全产品/别名）')
      prodClear.style.display = 'none'
      return
    }

    if (pickedProduct.kind === 'alias') {
      const ex = pickedProduct.extra || {}
      const exText = ex.product_name
        ? ` → 归属产品：${ex.product_name}${ex.product_slug ? `（slug: ${ex.product_slug}）` : ''}`
        : ''
      setText(prodPicked, `已选择：${pickedProduct.name} [别名] ${exText} [product_id=${pickedProduct.product_id}]`)
    } else {
      const slug = pickedProduct.slug ? `（slug: ${pickedProduct.slug}）` : ''
      setText(prodPicked, `已选择：${pickedProduct.name} ${slug} [product_id=${pickedProduct.product_id}]`)
    }
    prodClear.style.display = ''
  }

  function validateYear(inputEl, errEl) {
    const v = norm(inputEl.value)
    if (!v) return null

    const n = Number(v)
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      setInvalid(inputEl, errEl, '必须为整数年份。')
      return '__invalid__'
    }
    if (n < 1990 || n > nowYear) {
      setInvalid(inputEl, errEl, `年份范围：1990 ~ ${nowYear}。`)
      return '__invalid__'
    }
    return n
  }

  function validate() {
    clearErrors()
    let ok = true

    if (!pickedOrg?.organization_id) {
      showErr(orgErr, '企业名称为必填，请先选择一个企业/机构。')
      ok = false
    }

    if (!pickedProduct?.product_id) {
      showErr(prodErr, '产品名称为必填，请先选择一个安全产品/别名。')
      ok = false
    }

    const ry = validateYear(releaseYear, releaseYearErr)
    if (ry === '__invalid__') ok = false

    const ey = validateYear(endYear, endYearErr)
    if (ey === '__invalid__') ok = false

    return ok
  }

  function buildPayload() {
    const ry = norm(releaseYear.value) ? Number(norm(releaseYear.value)) : null
    const ey = norm(endYear.value) ? Number(norm(endYear.value)) : null

    return {
      organization_id: Number(pickedOrg.organization_id),
      security_product_id: Number(pickedProduct.product_id), // ✅ 注意：写归一后的主产品ID
      product_release_year: ry,
      product_end_year: ey
    }
  }

  async function resetForm() {
    clearErrors()

    pickedOrg = null
    pickedProduct = null

    releaseYear.value = ''
    endYear.value = ''

    orgSearch.clear()
    prodSearch.clear()

    orgSearchList.innerHTML = ''
    prodSearchList.innerHTML = ''

    orgSearchStatus.textContent = '输入关键字开始搜索。'
    prodSearchStatus.textContent = '输入关键字开始搜索。'

    renderPickedOrg()
    renderPickedProduct()
  }

  // --- search controls ---

  const orgSearch = createEntitySearch({
    inputEl: orgSearchInput,
    listEl: orgSearchList,
    statusEl: orgSearchStatus,
    searchFn: async (q) => {
      const token = getToken()
      return await apiFetch(`/api/admin/organization/search?q=${encodeURIComponent(q)}`, { token })
    },
    renderItem: (it) => ({
      title: it.display_name || it.organization_short_name || '（未命名）',
      subtitle: [
        it.organization_full_name ? `全称：${it.organization_full_name}` : null,
        it.organization_short_name ? `简称：${it.organization_short_name}` : null,
        it.organization_slug ? `slug：${it.organization_slug}` : null,
        it.establish_year ? `成立：${it.establish_year}` : null,
      ].filter(Boolean).join(' · ')
    }),
    onPick: async (it) => {
      pickedOrg = {
        organization_id: it.organization_id,
        display_name: it.display_name || it.organization_short_name || '',
        organization_slug: it.organization_slug || ''
      }
      showErr(orgErr, '')
      renderPickedOrg()
      orgSearchStatus.textContent = '已选择（可继续搜索并点击新的结果进行更换）'
      orgSearchList.innerHTML = ''
    }
  })

  const prodSearch = createEntitySearch({
    inputEl: prodSearchInput,
    listEl: prodSearchList,
    statusEl: prodSearchStatus,
    searchFn: async (q) => {
      const token = getToken()
      return await apiFetch(`/api/admin/dropdowns/product_union?q=${encodeURIComponent(q)}`, { token })
    },
    renderItem: (it) => {
      const kind = it.kind === 'alias' ? '别名' : '产品'
      const extra = it.kind === 'alias'
        ? (it.extra?.product_name ? `→ ${it.extra.product_name}` : '')
        : (it.slug ? `slug：${it.slug}` : '')
      return {
        title: `${it.name || '（未命名）'}（${kind}）`,
        subtitle: [
          `product_id：${it.product_id}`,
          extra || null,
        ].filter(Boolean).join(' · ')
      }
    },
    onPick: async (it) => {
      pickedProduct = {
        product_id: it.product_id, // ✅ 归一主ID
        kind: it.kind,
        name: it.name,
        slug: it.slug || null,
        extra: it.extra || null
      }
      showErr(prodErr, '')
      renderPickedProduct()
      prodSearchStatus.textContent = '已选择（可继续搜索并点击新的结果进行更换）'
      prodSearchList.innerHTML = ''
    }
  })

  orgClear.addEventListener('click', () => {
    pickedOrg = null
    renderPickedOrg()
  })
  prodClear.addEventListener('click', () => {
    pickedProduct = null
    renderPickedProduct()
  })

  // --- open/close/reset/submit ---

  btnOpen.addEventListener('click', async () => {
    openModal(modal)
    await resetForm()
  })

  closeBtn.addEventListener('click', () => closeModal(modal))

  resetBtn.addEventListener('click', async () => {
    await resetForm()
  })

  submitBtn.addEventListener('click', async () => {
    if (!validate()) return

    const token = getToken()
    const payload = buildPayload()

    submitBtn.disabled = true
    resetBtn.disabled = true

    await showConfirmFlow({
      titleLoading: '录入中',
      bodyLoading: '写入企业产品关系中…',
      action: async () => {
        const res = await apiFetch('/api/admin/org_product', { method: 'POST', token, body: payload })
        await resetForm()
        closeModal(modal)
        const id = res?.organization_product?.organization_product_id ?? res?.organization_product_id ?? '（未返回）'
        return `✅ 写入成功：organization_product_id = ${id}`
      }
    })

    submitBtn.disabled = false
    resetBtn.disabled = false
  })

  // init display
  renderPickedOrg()
  renderPickedProduct()
}
