// apps/web/src/features/product-admin.js
import { createMultiSelectGrid } from '../ui/multiselect-grid.js'

/**
 * mountProductAdmin
 * - 负责“录入安全产品”弹窗的 UI 事件绑定 + 校验 + 调 API
 * - “对应安全领域”多选：复用 ui/multiselect-grid.js 的 createMultiSelectGrid()
 *
 * 依赖：
 * - admin.html 里需要存在这些 id：
 *   - #btnOpenProduct
 *   - #productModal（以及内部表单控件：#productName #productSlug #productClose #productReset #productSubmit）
 *   - 一个用于挂载领域多选组件的容器：#productDomainMount（你如果当前 id 不一样，改下方常量即可）
 * - admin.js 需要提供：
 *   - openModal(modalEl), closeModal(modalEl)
 *   - showConfirm(), updateConfirm()
 *   - apiGetJson(url, token), apiPostJson(url, payload, token)
 *   - getToken()
 */
export function mountProductAdmin(ctx) {
  const {
    API,
    FIELD,
    openModal,
    closeModal,
    showConfirm,
    updateConfirm,
    apiGetJson,
    apiPostJson,
    getToken,
    $,
    norm,
    isValidSlug,
    setInvalid,
    clearInvalid,
  } = ctx

  // ====== DOM ======
  const btnOpen = $('#btnOpenProduct')
  const modal = $('#productModal')
  const btnClose = $('#productClose')
  const btnReset = $('#productReset')
  const btnSubmit = $('#productSubmit')

  const nameInput = $('#productName')
  const nameErr = $('#productNameErr')
  const slugInput = $('#productSlug')
  const slugErr = $('#productSlugErr')

  // 领域多选组件挂载点（你要确保 admin.html 里有这个容器）
  const domainMount = $('#productDomainMount')

  if (!btnOpen || !modal) {
    // 页面还没放这个弹窗就直接 return，避免 build 但 runtime 报错
    return
  }

  // ====== Domain MultiSelect（用 multiselect-grid.js） ======
  if (!domainMount) {
    throw new Error('product-admin.js: missing #productDomainMount in admin.html')
  }

  // 组件实例
  const msDomains = createMultiSelectGrid({
    title: '对应安全领域（可多选）',
    placeholder: '搜索安全领域…',
    hint: '点击 ▾ 展开；勾选后点“确认”才生效；× 清空已选。',
    options: [],

    // 重要：你明确“不显示 slug”，multiselect-grid 内部只显示 name
    // 但搜索仍然可以选择是否包含 slug：
    // - 如果你连搜索也不希望匹配 slug，就改成： (o) => `${o?.name ?? ''}`
    searchText: (o) => `${o?.name ?? ''}`.trim(),
  })

  domainMount.innerHTML = ''
  domainMount.appendChild(msDomains.element)

  // ====== helpers ======
  async function loadDomainsForDropdown() {
    const token = getToken()
    // 后端 dropdowns/domains 建议返回：
    // [{ security_domain_id, security_domain_name, cybersecurity_domain_slug }]
    const rows = await apiGetJson(API.listDomains, token)

    // 兼容两种返回形态：直接数组 or {data:[]}
    const data = Array.isArray(rows) ? rows : (rows?.data || [])

    // 只给 multiselect-grid 传 id/name（不显示 slug）
    const opts = data.map(d => ({
      id: d.security_domain_id,
      name: d.security_domain_name,
      // slug 不展示；这里也不参与 searchText（我们 searchText 已限定只匹配 name）
      slug: d.cybersecurity_domain_slug ?? null,
    }))

    msDomains.setOptions(opts)
  }

  function validate() {
    let ok = true

    const name = norm(nameInput?.value)
    const slug = norm(slugInput?.value)

    if (!name) {
      setInvalid(nameInput, nameErr, '安全产品名称为必填。')
      ok = false
    } else {
      clearInvalid(nameInput, nameErr)
    }

    if (!slug) {
      setInvalid(slugInput, slugErr, 'slug 为必填。')
      ok = false
    } else if (!isValidSlug(slug)) {
      setInvalid(slugInput, slugErr, 'slug 仅允许 a-z / 0-9 / 连字符 -（建议小写）。')
      ok = false
    } else {
      clearInvalid(slugInput, slugErr)
    }

    // 至少选 1 个领域（如果你允许为空就删掉这一段）
    const domainIds = msDomains.getValues()
    if (!domainIds.length) {
      // 这里不给红框（multiselect-grid 是自绘），用 confirm 提示更直观
      ok = false
      showConfirm({ title: '校验失败', body: '请选择至少 1 个安全领域。', okText: '确定', okEnabled: true })
    }

    return ok
  }

  function resetForm() {
    if (nameInput) nameInput.value = ''
    if (slugInput) slugInput.value = ''
    clearInvalid(nameInput, nameErr)
    clearInvalid(slugInput, slugErr)
    msDomains.clear()
  }

  async function submit() {
    if (!validate()) return

    const token = getToken()

    const payload = {
      [FIELD.productName]: norm(nameInput.value),
      [FIELD.productSlug]: norm(slugInput.value),

      // 关联表：产品-领域（后端 product route 需要支持接收 domain_ids 并写入 cybersecurity_product_domain）
      [FIELD.productDomainIds]: msDomains.getValues().map(x => Number(x)),
    }

    showConfirm({ title: '录入中', body: '写入安全产品…', okText: '确定', okEnabled: false })

    try {
      await apiPostJson(API.createProduct, payload, token)
      updateConfirm({ title: '录入成功', body: '✅ 安全产品写入成功。', okText: '确定', okEnabled: true })
      // 成功后不自动关闭弹窗：让用户点“确定”再继续
      resetForm()
    } catch (e) {
      updateConfirm({ title: '录入失败', body: `❌ ${e?.message || String(e)}`, okText: '确定', okEnabled: true })
    }
  }

  // ====== events ======
  btnOpen.addEventListener('click', async () => {
    try {
      await loadDomainsForDropdown()
      openModal(modal)
    } catch (e) {
      showConfirm({ title: '加载失败', body: `❌ 领域列表加载失败：${e?.message || String(e)}`, okText: '确定', okEnabled: true })
    }
  })

  btnClose?.addEventListener('click', () => closeModal(modal))
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal) })

  btnReset?.addEventListener('click', resetForm)
  btnSubmit?.addEventListener('click', submit)
}
