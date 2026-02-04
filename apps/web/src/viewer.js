const $ = (id) => document.getElementById(id);

function renderList(title, items, kind) {
  if (!items?.length) return '';
  const rows = items.map((x) => {
    if (kind === 'company') return `<li><a href="/api/company/${encodeURIComponent(x.organization_slug)}" target="_blank">${escapeHtml(x.company_short_name || x.company_full_name || x.organization_slug)}</a> <span style="color:#666">(${escapeHtml(x.organization_slug)})</span></li>`;
    if (kind === 'product') return `<li><a href="/api/product/${encodeURIComponent(x.security_product_slug)}" target="_blank">${escapeHtml(x.security_product_name || x.security_product_slug)}</a> <span style="color:#666">(${escapeHtml(x.security_product_slug)})</span></li>`;
    return `<li><a href="/api/domain/${encodeURIComponent(x.cybersecurity_domain_slug)}" target="_blank">${escapeHtml(x.security_domain_name || x.cybersecurity_domain_slug)}</a> <span style="color:#666">(${escapeHtml(x.cybersecurity_domain_slug)})</span></li>`;
  }).join('');
  return `<h4>${title}</h4><ul>${rows}</ul>`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

async function search() {
  const q = $('q').value.trim();
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
  const data = await res.json();
  const html = [
    renderList('Companies', data.companies, 'company'),
    renderList('Products', data.products, 'product'),
    renderList('Domains', data.domains, 'domain'),
  ].filter(Boolean).join('') || '<p style="color:#666">无结果</p>';
  $('result').innerHTML = html;
}

$('btnSearch').addEventListener('click', search);
$('q').addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });

// Default: show empty message
$('result').innerHTML = '<p style="color:#666">输入关键词并搜索。</p>';
