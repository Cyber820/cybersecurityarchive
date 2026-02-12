// apps/web/src/features/domain-edit.js
import { createSingleSelectPicker } from '../ui/single-select-picker.js'

/**
 * 编辑安全领域（含 alias）
 * - 搜索（domain.slug/name + domain_alias.name） -> 列表
 * - 每行：编辑 / 删除
 * - 编辑：
 *   - domain：name/slug/description
 *   - alias：alias_name + domain_id（同等安全领域，单选）
 */
export function mountDomainEditAdmin(ctx) {
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

  const btnOpen = $('btnOpenDomainEdit')
  if (!btnOpen) return

  // ===== Search modal =====
  const searchModal = $('domainEditSearchModal')
  const searchClose = $('domainEditSearchClose')
  const searchInput = $('domainEditSearchInput')
  const searchStatus = $('domainEditSearchStatus')
  const searchList = $('domainEditSearchList')

  // ===== Main edit modal =====
  const mainModal = $('domainEditMainModal')
  const mainClose = $('domainEditMainClose')
  const mainCancel = $('domainEditMainCancel')
  const mainSubmit = $('domainEditMainSubmit')

  const mainName = $('domainEditMainName')
  const mainNameErr = $('domainEditMainNameErr')
  const mainSlug = $('domainEditMainSlug')
  const mainSlugErr = $('domainEditMainSlugErr')
  const mainDesc = $('domainEditMainDesc')

  // ===== Alias edit modal =====
  const aliasModal = $('domainEditAliasModal')
  const aliasClose = $('domainEditAliasClose')
  const aliasCancel = $('domainEditAliasCancel')
  const aliasSubmit = $('domainEditAliasSubmit')

  const aliasName = $('domainEditAliasName')
  const aliasNameErr = $('domainEditAliasNameErr')

  const aliasPicked = $('domainEditAliasTargetPicked')
  const aliasClear = $('domainEditAliasTargetClear')
  const aliasSearchInput = $('domainEditAliasTargetSearch')
  const aliasStatus = $('domainEditAliasTargetStatus')
  const aliasList = $('domainEditAliasTargetList')
  const aliasTargetErr = $('domainEditAliasTargetErr')

  if (searchClose) searchClose.addEventListener('click', () => closeModal(searchModal))
  if (mainClose) mainClose.addEventListener('click', () => closeModal(mainModal))
  if (mainCancel) mainCancel.addEventListener('click', () => closeModal(mainModal))
  if (aliasClose) aliasClose.addEventListener('click', () => closeModal(aliasModal))
  if (aliasCancel) aliasCancel.addEventListener('click', () => closeModal(aliasModal))

  // 单选：同等安全领域
  const aliasPicker = createSingleSelectPicker({
    pickedEl: aliasPicked,
    clearBtn: aliasClear,
    inputEl: aliasSearchInput,
    statusEl: aliasStatus,
    listEl: aliasList,
    errEl: aliasTargetErr,
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

  // ===== state =====
  let editingMainId = null
  let editingAliasId = null

  function clearSearchList() {
    if (searchList) searchList.innerHTML = ''
  }

  function setStatus(msg) {
    if (searchStatus) searchStatus.textContent = msg
  }

  function parseUnionId(id) {
    const s = String(id || '')
    if (s.startsWith('d:')) return { kind: 'domain', id: Number(s.slice(2)) }
    if (s.startsWith('da:')) return { kind: 'alias', id: Number(s.slice(3)) }
    return { kind: null, id: NaN }
  }

  function renderResultRow(item) {
    const row = document.createElement('div')
    row.className = 'es-item'
    row.style.display = 'flex'
    row.style.alignItems = 'center'
    row.style.justifyContent = 'space-between'
    row.style.gap = '10px'

    const left = document.createElement('div')
    left.style.flex = '1 1 auto'
    left.style.minWidth = '0'

    const title = document.createElement('div')
    title.className = 'es-title'
    title.textContent = item?.name || '（未命名）'

    const sub = document.createElement('div')
    sub.className = 'es-subtitle'

    if (item.kind === 'domain') {
      sub.textContent = [
        item.slug ? `slug：${item.slug}` : null,
        item.domain_id ? `ID：${item.domain_id}` : null
      ].filter(Boolean).join(' · ') || '—'
    } else {
      const { id: aliasId } = parseUnionId(item?.id)
      const targetName = item?.extra?.domain_name ? `→ ${item.extra.domain_name}` : null
      const targetSlug = item?.extra?.domain_slug ? `(${item.extra.domain_slug})` : null
      sub.textContent = [
        Number.isFinite(aliasId) ? `aliasId：${aliasId}` : null,
        targetName ? `alias ${targetName}${targetSlug ? ' ' + targetSlug : ''}` : 'alias',
        item.domain_id ? `domainId：${item.domain_id}` : null
      ].filter(Boolean).join(' · ')
    }

    left.appendChild(title)
    left.appendChild(sub)

    const actions = document.createElement('div')
    actions.style.display = 'flex'
    actions.style.gap = '8px'
    actions.style.flex = '0 0 auto'

    const btnEdit = document.createElement('button')
    btnEdit.className = 'btn'
    btnEdit.type = 'button'
    btnEdit.textContent = '编辑'

    const btnDel = document.createElement('button')
    btnDel.className = 'btn'
    btnDel.type = 'button'
    btnDel.textContent = '删除'

    actions.appendChild(btnEdit)
    actions.appendChild(btnDel)

    row.appendChild(left)
    row.appendChild(actions)

    btnEdit.addEventListener('click', async (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      await handleEdit(item)
    })

    btnDel.addEventListener('click', async (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      await handleDelete(item)
    })

    return row
  }

  function filterUnionItemsForSlugQuery(items, q) {
    const qq = String(q || '').trim()
    if (!qq) return items
    if (!isSlug(qq)) return items

    // 规则：若 slug 精确命中某个 domain.slug，则仅返回该 domain（不附带该 domain 的 alias 列表）
    const hitDomain = (items || []).find(it =>
      it?.kind === 'domain' && String(it?.slug || '').toLowerCase() === qq.toLowerCase()
    )
    if (!hitDomain) return items

    const hitSlug = String(hitDomain.slug || '').toLowerCase()
    return (items || []).filter(it => {
      if (!it) return false
      if (it.kind === 'domain') return true
      const targetSlug = String(it?.extra?.domain_slug || '').toLowerCase()
      // 过滤：指向命中 domain 的 alias
      if (targetSlug && targetSlug === hitSlug) return false
      return true
    })
  }

  async function doSearch(q) {
    const token = getToken()
    const qq = String(q || '').trim()

    if (!qq) {
      clearSearchList()
      setStatus('请输入关键字开始搜索。')
      return
    }

    setStatus('搜索中…')
    clearSearchList()

    try {
      const res = await apiFetch(`/api/admin/dropdowns/domain_union?q=${encodeURIComponent(qq)}`, { token })
      let items = res?.items || []

      items = filterUnionItemsForSlugQuery(items, qq)

      if (!items.length) {
        setStatus('无结果。')
        return
      }

      setStatus(`共 ${items.length} 条（最多显示 ${items.length} 条）`)
      for (const it of items) {
        const row = renderResultRow(it)
        searchList.appendChild(row)
      }
    } catch (e) {
      setStatus(`搜索失败：${e?.message || String(e)}`)
    }
  }

  let _timer = null
  function onSearchInput() {
    const q = norm(searchInput?.value)
    if (_timer) window.clearTimeout(_timer)
    _timer = window.setTimeout(() => doSearch(q), 250)
  }

  if (searchInput) searchInput.addEventListener('input', onSearchInput)

  function clearMainErrors() {
    clearInvalid(mainName, mainNameErr)
    clearInvalid(mainSlug, mainSlugErr)
  }

  function validateMain() {
    clearMainErrors()
    let ok = true
    const n = norm(mainName.value)
    const s = norm(mainSlug.value)
    if (!n) {
      setInvalid(mainName, mainNameErr, '安全领域名称为必填。')
      ok = false
    }
    if (!s) {
      setInvalid(mainSlug, mainSlugErr, 'slug 为必填。')
      ok = false
    } else if (!isSlug(s)) {
      setInvalid(mainSlug, mainSlugErr, 'slug 仅允许 a-z / 0-9 / 连字符 -（建议小写）。')
      ok = false
    }
    return ok
  }

  function clearAliasErrors() {
    clearInvalid(aliasName, aliasNameErr)
    if (aliasTargetErr) {
      aliasTargetErr.textContent = ''
      aliasTargetErr.style.display = 'none'
    }
  }

  function validateAlias() {
    clearAliasErrors()
    let ok = true
    const n = norm(aliasName.value)
    if (!n) {
      setInvalid(aliasName, aliasNameErr, '安全领域别名为必填。')
      ok = false
    }
    if (!aliasPicker.validateRequired('请选择“同等安全领域”。')) ok = false
    return ok
  }

  async function handleDelete(item) {
    const token = getToken()
    const { kind, id } = parseUnionId(item?.id)
    if (!kind || !Number.isFinite(id)) {
      await showConfirmFlow({
        titleLoading: '失败',
        bodyLoading: '参数错误。',
        action: async () => '❌ 参数错误：无法解析记录 ID'
      })
      return
    }

    await showConfirmFlow({
      titleLoading: '删除中',
      bodyLoading: '删除记录中…',
      action: async () => {
        const url = kind === 'domain'
          ? `/api/admin/domain/${id}`
          : `/api/admin/domain/alias/${id}`

        const res = await apiFetch(url, { method: 'DELETE', token })
        await doSearch(norm(searchInput?.value))

        if (kind === 'domain') {
          const d = res?.deleted || {}
          return `✅ 删除成功：security_domain_id=${d.security_domain_id} · security_domain_name=${d.security_domain_name || ''} · slug=${d.cybersecurity_domain_slug || ''}`
        }
        const a = res?.deleted || {}
        return `✅ 删除成功：security_domain_alias_id=${a.security_domain_alias_id} · security_domain_alias_name=${a.security_domain_alias_name || ''}`
      }
    })
  }

  async function handleEdit(item) {
    const token = getToken()
    const { kind, id } = parseUnionId(item?.id)
    if (!kind || !Number.isFinite(id)) return

    try {
      if (kind === 'domain') {
        const res = await apiFetch(`/api/admin/domain/${id}`, { token })
        const d = res?.domain || res
        editingMainId = d.security_domain_id
        mainName.value = d.security_domain_name || ''
        mainSlug.value = d.cybersecurity_domain_slug || ''
        if (mainDesc) mainDesc.value = d.security_domain_description || ''
        clearMainErrors()
        openModal(mainModal)
        mainName.focus()
        return
      }

      const res = await apiFetch(`/api/admin/domain/alias/${id}`, { token })
      const a = res?.alias || res
      editingAliasId = a.security_domain_alias_id
      aliasName.value = a.security_domain_alias_name || ''
      aliasPicker.clear()
      clearAliasErrors()

      // 预填 target（没有 name 时先用 ID 占位；用户也可改选）
      aliasPicker.setSelected({ id: a.security_domain_id, label: `ID：${a.security_domain_id}` })

      openModal(aliasModal)
      aliasName.focus()
    } catch (e) {
      await showConfirmFlow({
        titleLoading: '失败',
        bodyLoading: '读取失败',
        action: async () => { throw e }
      })
    }
  }

  async function submitMain() {
    if (!validateMain()) return
    const token = getToken()
    const id = Number(editingMainId)
    if (!Number.isFinite(id)) return

    const payload = {
      security_domain_name: norm(mainName.value),
      cybersecurity_domain_slug: norm(mainSlug.value),
      security_domain_description: (mainDesc ? norm(mainDesc.value) : '') || null
    }

    await showConfirmFlow({
      titleLoading: '更新中',
      bodyLoading: '更新安全领域中…',
      action: async () => {
        await apiFetch(`/api/admin/domain/${id}`, { method: 'PATCH', token, body: payload })
        closeModal(mainModal)
        await doSearch(norm(searchInput?.value))
        return '✅ 更新成功'
      }
    })
  }

  async function submitAlias() {
    if (!validateAlias()) return
    const token = getToken()
    const aliasId = Number(editingAliasId)
    if (!Number.isFinite(aliasId)) return

    const sel = aliasPicker.getSelected()
    const domainId = Number(sel?.id)
    if (!Number.isFinite(domainId)) {
      if (aliasTargetErr) {
        aliasTargetErr.textContent = '请选择“同等安全领域”。'
        aliasTargetErr.style.display = 'block'
      }
      return
    }

    const payload = {
      security_domain_alias_name: norm(aliasName.value),
      security_domain_id: domainId,
    }

    await showConfirmFlow({
      titleLoading: '更新中',
      bodyLoading: '更新安全领域别名中…',
      action: async () => {
        await apiFetch(`/api/admin/domain/alias/${aliasId}`, { method: 'PATCH', token, body: payload })
        closeModal(aliasModal)
        await doSearch(norm(searchInput?.value))
        return '✅ 更新成功'
      }
    })
  }

  if (mainSubmit) mainSubmit.addEventListener('click', (ev) => {
    ev.preventDefault()
    submitMain()
  })
  if (aliasSubmit) aliasSubmit.addEventListener('click', (ev) => {
    ev.preventDefault()
    submitAlias()
  })

  btnOpen.addEventListener('click', (ev) => {
    ev.preventDefault()
    if (searchInput) searchInput.value = ''
    clearSearchList()
    setStatus('请输入关键字开始搜索。')
    openModal(searchModal)
    searchInput && searchInput.focus()
  })
}
