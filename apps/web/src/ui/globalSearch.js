// apps/web/src/ui/globalSearch.js
const esc = (s) =>
  String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return node;
}

/**
 * mountGlobalSearch
 * @param {HTMLElement|string} host - DOM 节点或其 id
 * @param {object} [opts]
 * @param {(url:string)=>void} [opts.onNavigate] - 默认 location.href = url
 */
export function mountGlobalSearch(host, opts = {}) {
  const root = typeof host === 'string' ? document.getElementById(host) : host;
  if (!root) throw new Error('[globalSearch] host not found');

  const onNavigate = typeof opts.onNavigate === 'function'
    ? opts.onNavigate
    : (url) => { location.href = url; };

  root.innerHTML = '';

  const input = el('input', {
    class: 'gs-input',
    placeholder: '全站搜索：企业 / 产品 / 领域（输入关键词后回车）',
    autocomplete: 'off',
  });

  const btn = el('button', { class: 'gs-btn', type: 'button' }, ['搜索']);
  const status = el('div', { class: 'gs-hint' }, ['输入关键词开始搜索。']);
  const list = el('div', { class: 'gs-list' });

  const wrap = el('div', { class: 'gs-wrap' }, [
    el('div', { class: 'gs-row' }, [input, btn]),
    status,
    list,
  ]);

  root.appendChild(wrap);

  async function run() {
    const q = input.value.trim();
    list.innerHTML = '';
    if (!q) {
      status.textContent = '请输入关键词开始搜索。';
      return;
    }

    status.textContent = '搜索中…';
    let data = null;

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const txt = await res.text();
      try { data = JSON.parse(txt); } catch { data = { raw: txt }; }

      if (!res.ok) {
        status.textContent = `❌ 搜索失败：HTTP ${res.status}`;
        list.textContent = JSON.stringify(data, null, 2);
        return;
      }
    } catch (e) {
      status.textContent = '❌ 搜索失败：网络错误';
      list.textContent = String(e?.message || e);
      return;
    }

    const companies = data?.companies || [];
    const products = data?.products || [];
    const domains = data?.domains || [];

    status.textContent = `✅ 结果：企业 ${companies.length} / 产品 ${products.length} / 领域 ${domains.length}`;

    function renderGroup(title, items, toUrl) {
      const group = el('div', { class: 'gs-group' }, [
        el('div', { class: 'gs-group-title' }, [title]),
      ]);

      if (!items.length) {
        group.appendChild(el('div', { class: 'gs-empty' }, ['（无）']));
        return group;
      }

      for (const it of items) {
        const label = it.organization_slug
          ? `${it.organization_short_name || it.organization_full_name || '(未命名)'}  ·  ${it.organization_slug}`
          : it.security_product_slug
            ? `${it.security_product_name || '(未命名)'}  ·  ${it.security_product_slug}`
            : it.cybersecurity_domain_slug
              ? `${it.security_domain_name || '(未命名)'}  ·  ${it.cybersecurity_domain_slug}`
              : JSON.stringify(it);

        const url = toUrl(it);
        const row = el('div', { class: 'gs-item', role: 'button', tabindex: '0', html: esc(label) });
        row.addEventListener('click', () => onNavigate(url));
        row.addEventListener('keydown', (e) => { if (e.key === 'Enter') onNavigate(url); });
        group.appendChild(row);
      }
      return group;
    }

    list.appendChild(renderGroup(
      '企业 / 机构',
      companies,
      (it) => `/company/${encodeURIComponent(it.organization_slug || it.organization_short_name || it.organization_full_name || '')}`
    ));
    list.appendChild(renderGroup(
      '安全产品',
      products,
      (it) => `/securityproduct/${encodeURIComponent(it.security_product_slug || it.security_product_name || '')}`
    ));
    list.appendChild(renderGroup(
      '网安领域',
      domains,
      (it) => `/securitydomain/${encodeURIComponent(it.cybersecurity_domain_slug || it.security_domain_name || '')}`
    ));
  }

  btn.addEventListener('click', run);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });

  return { run, input };
}
