// apps/web/src/ui/solution-search.js

export function mountSolutionSearch(mountEl) {
  if (!mountEl) return;

  injectSolutionStyles();

  mountEl.innerHTML = `
    <div class="ss">
      <div class="ss-title">解决方案搜索</div>

      <div class="ss-card">
        <div class="ss-label">选择安全产品（多选）</div>

        <div class="ss-tokenbox" id="ssTokenBox">
          <div class="ss-chips" id="ssChips"></div>
          <input id="ssInput" class="ss-input" placeholder="输入关键词搜索安全产品…" />
        </div>

        <div class="ss-suggest" id="ssSuggest" style="display:none"></div>

        <div class="ss-actions">
          <button id="ssSearchBtn" class="ss-btn ss-btn-primary" type="button">搜索匹配企业</button>
          <button id="ssClearBtn" class="ss-btn" type="button">清空条件</button>
          <button id="ssAdvBtn" class="ss-btn" type="button">高级搜索</button>
        </div>

        <div id="ssAdvPanel" class="ss-adv" style="display:none">
          <div class="ss-adv-muted">高级搜索（预留）：未来加入特色领域 / 其他筛选条件。</div>
        </div>

        <div id="ssHint" class="ss-hint">请选择 1 个或多个安全产品，然后点击“搜索匹配企业”。</div>
      </div>

      <div class="ss-card" style="margin-top:12px;">
        <div class="ss-label">搜索结果</div>
        <div id="ssResultHint" class="ss-hint">尚未搜索。</div>
        <div id="ssResults" class="ss-results" style="margin-top:10px;"></div>
      </div>
    </div>

    <div id="ssToast" class="ss-toast" style="display:none">后续产品荣誉功能开发中</div>
  `;

  const $tokenBox = mountEl.querySelector('#ssTokenBox');
  const $chips = mountEl.querySelector('#ssChips');
  const $input = mountEl.querySelector('#ssInput');
  const $suggest = mountEl.querySelector('#ssSuggest');
  const $hint = mountEl.querySelector('#ssHint');

  const $searchBtn = mountEl.querySelector('#ssSearchBtn');
  const $clearBtn = mountEl.querySelector('#ssClearBtn');
  const $advBtn = mountEl.querySelector('#ssAdvBtn');
  const $advPanel = mountEl.querySelector('#ssAdvPanel');

  const $resultHint = mountEl.querySelector('#ssResultHint');
  const $results = mountEl.querySelector('#ssResults');

  const $toast = mountEl.querySelector('#ssToast');

  // selected products: Map<product_id, {id,name,slug}>
  const selected = new Map();

  function showToast(msg) {
    if (!$toast) return;
    $toast.textContent = msg || '后续产品荣誉功能开发中';
    $toast.style.display = 'block';
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      $toast.style.display = 'none';
    }, 1600);
  }

  function renderChips() {
    $chips.innerHTML = '';
    if (!selected.size) {
      // keep empty; input placeholder guides
      return;
    }
    for (const it of selected.values()) {
      const chip = document.createElement('div');
      chip.className = 'ss-chip';
      chip.innerHTML = `
        <span class="ss-chip-text">${escapeHtml(it.name || '（未命名产品）')}</span>
        <button class="ss-chip-x" type="button" aria-label="删除">×</button>
      `;
      chip.querySelector('.ss-chip-x')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        selected.delete(it.id);
        renderChips();
        // 不触发搜索
        $resultHint.textContent = selected.size ? '条件已变更，请点击“搜索匹配企业”。' : '尚未搜索。';
        $results.innerHTML = '';
      });
      $chips.appendChild(chip);
    }
  }

  function setSuggestOpen(open) {
    $suggest.style.display = open ? 'block' : 'none';
    if (!open) $suggest.innerHTML = '';
  }

  async function fetchSuggestions(q) {
    const res = await fetch(`/api/solution/products?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    return items;
  }

  function renderSuggestions(items) {
    $suggest.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'ss-suggest-empty';
      empty.textContent = '无结果。';
      $suggest.appendChild(empty);
      return;
    }

    for (const it of items.slice(0, 10)) {
      const row = document.createElement('div');
      row.className = 'ss-suggest-item';

      const title = document.createElement('div');
      title.className = 'ss-suggest-title';
      title.textContent = it.name || '（未命名）';

      const sub = document.createElement('div');
      sub.className = 'ss-suggest-sub';
      sub.textContent = it.is_alias && it.main_name
        ? `别称 · 又称：${it.main_name}`
        : '主产品';

      row.appendChild(title);
      row.appendChild(sub);

      row.addEventListener('click', () => {
        // 选择后：按“主产品 ID”加入
        if (!it.id) return;
        if (!selected.has(it.id)) {
          selected.set(it.id, { id: it.id, name: it.main_name || it.name, slug: it.slug || '' });
          renderChips();
        }
        $input.value = '';
        setSuggestOpen(false);
        $input.focus();

        // 不触发搜索
        $resultHint.textContent = '条件已变更，请点击“搜索匹配企业”。';
        $results.innerHTML = '';
      });

      $suggest.appendChild(row);
    }
  }

  // 输入：防抖建议列表
  let t = null;
  $input.addEventListener('input', () => {
    clearTimeout(t);
    const q = String($input.value || '').trim();
    if (!q) {
      setSuggestOpen(false);
      return;
    }
    t = setTimeout(async () => {
      try {
        setSuggestOpen(true);
        $suggest.innerHTML = `<div class="ss-suggest-empty">搜索中…</div>`;
        const items = await fetchSuggestions(q);
        renderSuggestions(items);
      } catch (e) {
        $suggest.innerHTML = `<div class="ss-suggest-empty">搜索失败：${escapeHtml(e?.message || String(e))}</div>`;
      }
    }, 220);
  });

  // 点击空白关闭建议
  document.addEventListener('click', (ev) => {
    if (!mountEl.contains(ev.target)) return;
    // 点在 tokenBox 或 suggest 内不关
    if ($tokenBox.contains(ev.target) || $suggest.contains(ev.target)) return;
    setSuggestOpen(false);
  });

  // Enter：如果建议列表开着，不直接搜索（避免误触发）
  $input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      // 不做“回车即搜索”，避免与你的“必须点按钮”冲突
      setSuggestOpen(false);
    }
  });

  // 高级搜索：仅折叠占位
  $advBtn.addEventListener('click', () => {
    const open = $advPanel.style.display !== 'none';
    $advPanel.style.display = open ? 'none' : 'block';
  });

  // 清空条件
  $clearBtn.addEventListener('click', () => {
    selected.clear();
    renderChips();
    $input.value = '';
    setSuggestOpen(false);

    $resultHint.textContent = '尚未搜索。';
    $results.innerHTML = '';
  });

  // 搜索匹配企业（唯一触发点）
  $searchBtn.addEventListener('click', async () => {
    const ids = Array.from(selected.keys()).filter((x) => Number.isInteger(x) || /^\d+$/.test(String(x)))
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x));

    if (!ids.length) {
      $hint.textContent = '请至少选择 1 个安全产品。';
      return;
    }
    $hint.textContent = '搜索中…';
    $resultHint.textContent = '搜索中…';
    $results.innerHTML = '';

    $searchBtn.disabled = true;
    $clearBtn.disabled = true;

    try {
      const res = await fetch('/api/solution/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_ids: ids }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];

      $hint.textContent = '搜索完成。';

      if (!items.length) {
        $resultHint.textContent = '没有匹配企业。';
        return;
      }

      $resultHint.textContent = `匹配企业：${items.length} 家`;
      renderResults(items);
    } catch (e) {
      $hint.textContent = '搜索失败。';
      $resultHint.textContent = `搜索失败：${e?.message || String(e)}`;
    } finally {
      $searchBtn.disabled = false;
      $clearBtn.disabled = false;
    }
  });

  function renderResults(items) {
    $results.innerHTML = '';

    for (const it of items) {
      const org = it.organization || {};
      const orgName = org.organization_short_name || org.organization_full_name || org.organization_slug || '（未命名企业）';
      const orgHref = `/company/${encodeURIComponent(org.organization_slug || org.organization_short_name || '')}`;

      const card = document.createElement('div');
      card.className = 'ss-orgcard';

      const head = document.createElement('a');
      head.className = 'ss-orgname';
      head.href = orgHref;
      head.textContent = orgName;

      const chips = document.createElement('div');
      chips.className = 'ss-prodchips';

      const prods = Array.isArray(it.products) ? it.products : [];
      for (const p of prods) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `ss-prodchip ss-tier-${p.tier || 'normal'}`;
        chip.textContent = p.name || '（未命名产品）';
        chip.addEventListener('click', () => {
          // ✅ 按你的要求：只提示，不跳转
          showToast('后续产品荣誉功能开发中');
        });
        chips.appendChild(chip);
      }

      card.appendChild(head);
      card.appendChild(chips);
      $results.appendChild(card);
    }
  }

  // init
  renderChips();
  $input.focus();
}

function injectSolutionStyles() {
  if (document.getElementById('solutionSearchStyles')) return;
  const style = document.createElement('style');
  style.id = 'solutionSearchStyles';
  style.textContent = `
    .ss-title{font-size:18px;font-weight:800;margin:2px 0 10px;}
    .ss-card{background:#fff;border:1px solid rgba(0,0,0,0.14);border-radius:14px;padding:14px;}
    .ss-label{font-weight:800;font-size:13px;margin-bottom:8px;}
    .ss-hint{color:rgba(0,0,0,0.62);font-size:12px;margin-top:8px;white-space:pre-wrap;}

    .ss-tokenbox{
      border:1px solid rgba(0,0,0,0.22);
      border-radius:14px;
      padding:10px 10px;
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      align-items:center;
      background:#fff;
    }
    .ss-chips{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
    .ss-input{
      border:0;
      outline:none;
      font-size:13px;
      min-width: 220px;
      flex:1 1 220px;
      padding:6px 4px;
      background:transparent;
    }
    .ss-chip{
      display:inline-flex;
      align-items:center;
      gap:8px;
      border:1px solid rgba(0,0,0,0.18);
      border-radius:999px;
      padding:6px 10px;
      background:#fff;
    }
    .ss-chip-text{font-size:12px;}
    .ss-chip-x{
      appearance:none;
      border:0;
      background:transparent;
      cursor:pointer;
      font-size:14px;
      line-height:1;
      padding:0 2px;
      color:rgba(0,0,0,0.55);
    }
    .ss-chip-x:hover{color:#111;}

    .ss-suggest{
      margin-top:10px;
      border:1px solid rgba(0,0,0,0.14);
      border-radius:12px;
      overflow:hidden;
      background:#fff;
    }
    .ss-suggest-item{
      padding:10px 12px;
      border-bottom:1px solid rgba(0,0,0,0.08);
      cursor:pointer;
    }
    .ss-suggest-item:last-child{border-bottom:0;}
    .ss-suggest-item:hover{background:rgba(0,0,0,0.02);}
    .ss-suggest-title{font-weight:800;font-size:13px;}
    .ss-suggest-sub{margin-top:4px;font-size:12px;color:rgba(0,0,0,0.62);}
    .ss-suggest-empty{padding:10px 12px;font-size:12px;color:rgba(0,0,0,0.62);}

    .ss-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;}
    .ss-btn{
      appearance:none;
      border: 1px solid rgba(0,0,0,0.22);
      background:#fff;
      color:#111;
      border-radius: 999px;
      padding: 10px 14px;
      font-size: 13px;
      cursor:pointer;
    }
    .ss-btn:disabled{opacity:.6;cursor:not-allowed;}
    .ss-btn-primary{background:#111;color:#fff;border-color:#111;}
    .ss-btn-primary:hover{opacity:.92;}

    .ss-adv{margin-top:10px;border-top:1px dashed rgba(0,0,0,0.14);padding-top:10px;}
    .ss-adv-muted{font-size:12px;color:rgba(0,0,0,0.62);}

    .ss-results{display:flex;flex-direction:column;gap:10px;}
    .ss-orgcard{
      border:1px solid rgba(0,0,0,0.12);
      border-radius:12px;
      padding:10px 12px;
      background:#fff;
    }
    .ss-orgname{
      display:inline-block;
      font-weight:900;
      font-size:14px;
      color:#111;
      text-decoration:none;
    }
    .ss-orgname:hover{text-decoration:underline;}
    .ss-prodchips{margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;}

    /* ✅ 不显示分数；只用 tier 做风格映射 */
    .ss-prodchip{
      appearance:none;
      border-radius:999px;
      padding:7px 10px;
      font-size:12px;
      cursor:pointer;
      border:1px solid rgba(0,0,0,0.18);
      background:#fff; /* normal */
      color:#111;
    }
    .ss-prodchip:hover{border-color:rgba(0,0,0,0.30);}

    /* 0-5：尽量和页面底色一致 => 这里不做明显变化（仍然白底细边） */
    .ss-tier-normal{background:#fff;}

    /* 6-7：中性（稍微显眼） */
    .ss-tier-mid{background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.22);}

    /* 8-10：强调（后续你要与 company/product 统一色彩时，改这一个块即可） */
    .ss-tier-high{background: rgba(99,102,241,0.10); border-color: rgba(99,102,241,0.30);}

    .ss-toast{
      position: fixed;
      left: 50%;
      bottom: 22px;
      transform: translateX(-50%);
      background:#111;
      color:#fff;
      padding:10px 14px;
      border-radius:999px;
      font-size:12px;
      z-index: 99999;
      opacity: 0.95;
    }
  `;
  document.head.appendChild(style);
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
