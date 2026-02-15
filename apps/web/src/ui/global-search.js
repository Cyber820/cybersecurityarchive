// apps/web/src/ui/global-search.js

export function mountGlobalSearch(mountEl) {
  if (!mountEl) return;
  mountEl.innerHTML = `
    <div class="gs">
      <div class="gs-title">全站搜索</div>
      <div class="gs-row">
        <input id="gsInput" class="gs-input" placeholder="全站搜索：企业 / 产品 / 领域（输入关键词后回车）" />
        <button id="gsBtn" class="gs-btn">搜索</button>
      </div>
      <div id="gsHint" class="gs-hint">输入关键词开始搜索。</div>
      <div id="gsResults" class="gs-results" style="display:none"></div>
    </div>
  `;

  injectSearchStyles();

  const $input = mountEl.querySelector('#gsInput');
  const $btn = mountEl.querySelector('#gsBtn');
  const $hint = mountEl.querySelector('#gsHint');
  const $results = mountEl.querySelector('#gsResults');

  const run = async () => {
    const q = String($input.value || '').trim();
    $results.style.display = 'none';
    $results.innerHTML = '';
    if (!q) {
      $hint.textContent = '输入关键词开始搜索。';
      return;
    }
    $hint.textContent = '搜索中…';

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const companies = Array.isArray(data.companies) ? data.companies : [];
      const products = Array.isArray(data.products) ? data.products : [];
      const domains = Array.isArray(data.domains) ? data.domains : [];

      if (!companies.length && !products.length && !domains.length) {
        $hint.textContent = '没有找到结果。';
        return;
      }

      $hint.textContent = '搜索结果：';
      $results.style.display = '';

      $results.appendChild(renderGroup('企业/机构', companies.map((c) => ({
        label: c.organization_short_name || c.organization_full_name || c.organization_slug,
        href: `/company/${encodeURIComponent(c.organization_slug || c.organization_short_name || '')}`,
      }))));
      $results.appendChild(renderGroup('安全产品', products.map((p) => ({
        label: p.security_product_name || p.security_product_slug,
        href: `/securityproduct/${encodeURIComponent(p.security_product_slug || '')}`,
      }))));
      $results.appendChild(renderGroup('安全领域', domains.map((d) => ({
        label: d.security_domain_name || d.cybersecurity_domain_slug,
        href: `/securitydomain/${encodeURIComponent(d.cybersecurity_domain_slug || '')}`,
      }))));
    } catch (e) {
      $hint.textContent = `搜索失败：${e?.message || e}`;
    }
  };

  $btn.addEventListener('click', run);
  $input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') run();
  });
}

function renderGroup(title, items) {
  const wrap = document.createElement('div');
  wrap.className = 'gs-group';
  const h = document.createElement('div');
  h.className = 'gs-group-title';
  h.textContent = title;
  wrap.appendChild(h);

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'gs-empty';
    empty.textContent = '（无）';
    wrap.appendChild(empty);
    return wrap;
  }

  const row = document.createElement('div');
  row.className = 'gs-chip-row';
  for (const it of items.slice(0, 8)) {
    const a = document.createElement('a');
    a.className = 'gs-chip';
    a.textContent = it.label || '（未命名）';
    a.href = it.href || '#';
    row.appendChild(a);
  }
  wrap.appendChild(row);
  return wrap;
}

function injectSearchStyles() {
  if (document.getElementById('globalSearchStyles')) return;
  const style = document.createElement('style');
  style.id = 'globalSearchStyles';
  style.textContent = `
    .gs-title{font-size:18px;font-weight:700;margin:2px 0 10px;}
    .gs-row{display:flex;gap:10px;align-items:center;}
    .gs-input{flex:1;min-width:0;border:1px solid var(--border,#e6e8ef);border-radius:999px;padding:12px 14px;font-size:14px;outline:none;}
    .gs-input:focus{border-color:rgba(124,58,237,0.45);box-shadow:0 0 0 3px rgba(124,58,237,0.12);}
    .gs-btn{border:1px solid var(--border,#e6e8ef);background:#fff;border-radius:999px;padding:10px 14px;cursor:pointer;}
    .gs-btn:hover{background:#f8fafc;}
    .gs-hint{margin-top:10px;color:var(--muted,#6b7280);}
    .gs-results{margin-top:10px;border-top:1px dashed var(--border,#e6e8ef);padding-top:10px;}
    .gs-group{margin-top:10px;}
    .gs-group-title{font-size:13px;color:var(--muted,#6b7280);margin:0 0 8px;}
    .gs-chip-row{display:flex;flex-wrap:wrap;gap:8px;}
    .gs-chip{display:inline-flex;align-items:center;padding:7px 10px;border-radius:999px;text-decoration:none;background:#eef2ff;border:1px solid rgba(99,102,241,0.22);color:#1f2937;}
    .gs-chip:hover{background:#e0e7ff;}
    .gs-empty{color:var(--muted,#6b7280);}
  `;
  document.head.appendChild(style);
}
