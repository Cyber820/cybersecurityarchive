const $ = (id) => document.getElementById(id);

function tokenHeader() {
  const t = $('token').value.trim();
  return { 'X-Admin-Token': t };
}

function jsonOut(obj) {
  $('out').textContent = JSON.stringify(obj, null, 2);
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...tokenHeader()
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.error || 'Request failed'), { status: res.status, data });
  return data;
}

$('btnCreateOrg').addEventListener('click', async () => {
  try {
    const body = {
      company_short_name: $('org_short').value.trim(),
      company_full_name: $('org_full').value.trim(),
      establish_year: $('org_year').value ? Number($('org_year').value) : null,
      organization_slug: $('org_slug').value.trim()
    };
    jsonOut(await postJson('/api/admin/organization', body));
  } catch (e) { jsonOut({ error: e.message, status: e.status, detail: e.data }); }
});

$('btnCreateProd').addEventListener('click', async () => {
  try {
    const body = {
      security_product_name: $('prod_name').value.trim(),
      security_product_slug: $('prod_slug').value.trim()
    };
    jsonOut(await postJson('/api/admin/product', body));
  } catch (e) { jsonOut({ error: e.message, status: e.status, detail: e.data }); }
});

$('btnCreateDom').addEventListener('click', async () => {
  try {
    const body = {
      security_domain_name: $('dom_name').value.trim(),
      cybersecurity_domain_slug: $('dom_slug').value.trim()
    };
    jsonOut(await postJson('/api/admin/domain', body));
  } catch (e) { jsonOut({ error: e.message, status: e.status, detail: e.data }); }
});

$('btnCreateOP').addEventListener('click', async () => {
  try {
    const body = {
      organization_id: Number($('op_org_id').value),
      security_product_id: Number($('op_prod_id').value),
      product_release_year: $('op_start').value ? Number($('op_start').value) : null,
      product_end_year: $('op_end').value ? Number($('op_end').value) : null
    };
    jsonOut(await postJson('/api/admin/organization-product', body));
  } catch (e) { jsonOut({ error: e.message, status: e.status, detail: e.data }); }
});

$('btnCreatePD').addEventListener('click', async () => {
  try {
    const body = {
      security_product_id: Number($('pd_prod_id').value),
      security_domain_id: Number($('pd_dom_id').value)
    };
    jsonOut(await postJson('/api/admin/product-domain', body));
  } catch (e) { jsonOut({ error: e.message, status: e.status, detail: e.data }); }
});

jsonOut({ ok: true, hint: 'Fill token then submit.' });
