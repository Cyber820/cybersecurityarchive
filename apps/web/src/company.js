// apps/web/src/company.js
import { mountGlobalSearch } from './ui/globalSearch.js';

const $ = (id) => document.getElementById(id);

function normalizeQ(raw) {
  let q = String(raw ?? '').trim();
  if (q.toLowerCase().endsWith('.html')) q = q.slice(0, -5);
  return q;
}

function getQFromPath() {
  const parts = (location.pathname || '').split('/').filter(Boolean);
  const idx = parts.indexOf('company');
  if (idx < 0) return '';
  const q = parts.slice(idx + 1).join('/');
  try { return decodeURIComponent(q); } catch { return q; }
}

function showModal(title = '开发中', body = '开发中') {
  $('modalTitle').textContent = title;
  $('modalBody').textContent = body;
  $('modalOverlay').style.display = 'flex';
}

function hideModal() {
  $('modalOverlay').style.display = 'none';
}

function renderBaseInfo(org) {
  const fullName = org?.organization_full_name || '';
  const establish = org?.establish_year ?? '';
  const ipo = org?.if_ipo === true ? '已上市' : '';

  const lines = [];
  lines.push(`企业全称：${fullName || '（无）'}`);
  lines.push(`成立时间：${String(establish || '（无）')}`);
  if (ipo) lines.push(`最近融资：${ipo}`);

  return lines.join('\n');
}

function renderTextOrEmpty(v) {
  const t = String(v ?? '').trim();
  return t ? t : '（无）';
}

function makeChip(label, onClick) {
  const d = document.createElement('div');
  d.className = 'chip-blue';
  d.textContent = label;
  d.tabIndex = 0;
  d.role = 'button';
  d.addEventListener('click', onClick);
  d.addEventListener('keydown', (e) => { if (e.key === 'Enter') onClick(); });
  return d;
}

async function loadCompany(qRaw) {
  const q = normalizeQ(qRaw);
  if (!q) return;

  // 纠正地址栏：如果用户输入了 .html
  const qPath = getQFromPath();
  const normalized = normalizeQ(qPath);
  if (normalized && normalized !== qPath) {
    history.replaceState(null, '', `/company/${encodeURIComponent(normalized)}`);
  }

  const url = `/api/company/${encodeURIComponent(q)}`;

  // loading 状态
  $('pageTitle').textContent = '加载中…';
  $('baseInfo').textContent = '加载中…';
  $('baseInfo').classList.add('empty');
  $('orgDesc').textContent = '加载中…';
  $('orgDesc').classList.add('empty');

  $('featuredProducts').innerHTML = '';
  $('otherProducts').innerHTML = '';
  $('featuredEmpty').style.display = 'none';
  $('otherEmpty').style.display = 'none';

  let res, data;
  try {
    res = await fetch(url);
    const txt = await res.text();
    try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  } catch (e) {
    $('pageTitle').textContent = q;
    $('baseInfo').textContent = `❌ 加载失败：网络错误\n${String(e?.message || e)}`;
    return;
  }

  if (!res.ok) {
    $('pageTitle').textContent = q;
    $('baseInfo').textContent = `❌ 加载失败：HTTP ${res.status}\n${JSON.stringify(data, null, 2)}`;
    return;
  }

  const org = data?.organization || null;
  const list = Array.isArray(data?.products) ? data.products : [];

  const title = org?.organization_short_name || org?.organization_full_name || q;
  $('pageTitle').textContent = title;

  $('baseInfo').textContent = renderBaseInfo(org);
  $('baseInfo').classList.remove('empty');

  $('orgDesc').textContent = renderTextOrEmpty(org?.organization_description);
  $('orgDesc').classList.remove('empty');

  // 产品分组：recommendation_score >= 6 视为“特色产品”
  const featured = [];
  const others = [];

  for (const row of list) {
    const score = row?.recommendation_score;
    const p = row?.product || null;

    const name = p?.security_product_name || `#${row?.security_product_id ?? 'unknown'}`;
    const slug = p?.security_product_slug || '';

    const label = score != null ? `${name}（${score}）` : name;
    const click = () => {
      // 这里按你的要求：先不跳产品页，点击弹窗“开发中”
      // 后续如果你要改成跳 /securityproduct/{slug}，把这里替换成 location.href 即可
      showModal('开发中', `「${name}」详情弹窗：开发中`);
    };

    const item = { label, click, score, slug, name };
    if (typeof score === 'number' && score >= 6) featured.push(item);
    else others.push(item);
  }

  if (!featured.length) {
    $('featuredEmpty').style.display = 'block';
  } else {
    for (const it of featured) $('featuredProducts').appendChild(makeChip(it.label, it.click));
  }

  if (!others.length) {
    $('otherEmpty').style.display = 'block';
  } else {
    for (const it of others) $('otherProducts').appendChild(makeChip(it.label, it.click));
  }
}

function init() {
  // 全站搜索挂载
  mountGlobalSearch('globalSearch');

  // modal
  $('modalClose').addEventListener('click', hideModal);
  $('modalOverlay').addEventListener('click', (e) => {
    if (e.target === $('modalOverlay')) hideModal();
  });

  const q = normalizeQ(getQFromPath());
  if (!q) {
    $('pageTitle').textContent = '（请从 /company/企业slug 进入，或用上方全站搜索）';
    $('baseInfo').textContent = '（无）';
    $('baseInfo').classList.remove('empty');
    $('orgDesc').textContent = '（无）';
    $('orgDesc').classList.remove('empty');
    $('featuredEmpty').style.display = 'block';
    $('otherEmpty').style.display = 'block';
    return;
  }

  loadCompany(q);
}

init();
