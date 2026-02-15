<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Company</title>
  <style>
    body{ margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; background:#f7f7f9; color:#111; }
    .wrap{ max-width: 980px; margin: 22px auto; padding: 0 14px; }
    h1{ font-size: 22px; margin: 0 0 14px; font-weight: 900; }
    .card{ background:#fff; border:1px solid rgba(0,0,0,0.14); border-radius:14px; padding:14px; margin-top: 14px; }
    .label{ font-weight:900; font-size: 13px; margin-bottom: 8px; }
    .hint{ color: rgba(0,0,0,0.62); font-size: 12px; margin-top: 6px; }
    .kv{ white-space: pre-wrap; word-break: break-word; font-size: 13px; line-height: 1.6; }
    .empty{ color: rgba(0,0,0,0.52); font-size: 13px; }

    /* ===== global search basic styles ===== */
    .gs-row{ display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
    .gs-input{
      flex:1; min-width: 240px;
      border:1px solid rgba(0,0,0,0.22);
      border-radius:12px;
      padding:10px 10px;
      font-size:13px;
      background:#fff;
      color:#111;
      box-sizing:border-box;
    }
    .gs-btn{
      border:1px solid rgba(0,0,0,0.22);
      background:#fff;
      border-radius:999px;
      padding:10px 14px;
      font-size:13px;
      cursor:pointer;
    }
    .gs-hint{ color: rgba(0,0,0,0.62); font-size: 12px; margin-top: 8px; }
    .gs-list{ margin-top: 10px; display:grid; gap: 12px; }
    .gs-group{ border:1px dashed rgba(0,0,0,0.18); border-radius:12px; padding:10px; }
    .gs-group-title{ font-weight:900; font-size: 12px; margin-bottom: 8px; color: rgba(0,0,0,0.75); }
    .gs-item{
      border:1px solid rgba(0,0,0,0.12);
      border-radius:10px;
      padding:8px 10px;
      font-size: 12px;
      cursor:pointer;
      background:#fff;
      margin: 6px 0;
    }
    .gs-item:hover{ border-color: rgba(0,0,0,0.25); }
    .gs-empty{ color: rgba(0,0,0,0.50); font-size: 12px; }

    /* ===== 两列豆腐块 ===== */
    .grid2{ display:grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    @media (max-width: 820px){ .grid2{ grid-template-columns: 1fr; } }

    /* ===== 产品 chips（蓝底）===== */
    .chips{ display:flex; flex-wrap:wrap; gap:10px; }
    .chip-blue{
      display:inline-flex;
      align-items:center;
      padding: 8px 10px;
      border-radius: 999px;
      border: 1px solid rgba(40, 120, 255, 0.28);
      background: rgba(40, 120, 255, 0.12);
      color: rgba(20, 70, 160, 1);
      font-size: 12px;
      cursor:pointer;
      user-select:none;
    }
    .chip-blue:hover{
      border-color: rgba(40, 120, 255, 0.45);
      background: rgba(40, 120, 255, 0.16);
    }

    /* ===== modal ===== */
    .modal-overlay{
      position:fixed; inset:0;
      background: rgba(0,0,0,0.35);
      display:none;
      align-items:center;
      justify-content:center;
      z-index: 99999;
      padding: 16px;
    }
    .modal{
      width: min(520px, 100%);
      background:#fff;
      border:1px solid rgba(0,0,0,0.18);
      border-radius: 14px;
      padding: 14px;
      box-sizing: border-box;
    }
    .modal-title{ font-weight: 900; font-size: 14px; margin: 0 0 10px; }
    .modal-body{ font-size: 13px; color: rgba(0,0,0,0.75); line-height: 1.6; }
    .modal-actions{ display:flex; justify-content:flex-end; margin-top: 12px; }
    .modal-btn{
      border:1px solid rgba(0,0,0,0.22);
      background:#fff;
      border-radius: 999px;
      padding: 8px 12px;
      font-size: 12px;
      cursor:pointer;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <!-- 1) 标题：直接显示企业/机构名称 -->
    <h1 id="pageTitle">—</h1>

    <!-- 2) 复用全局搜索框 -->
    <div class="card">
      <div class="label">全站搜索</div>
      <div id="globalSearch"></div>
    </div>

    <!-- 3) 基础信息 + 4) 企业简介：同行两列 -->
    <div class="grid2">
      <div class="card">
        <div class="label">基础信息</div>
        <div id="baseInfo" class="kv empty">加载中…</div>
      </div>

      <div class="card">
        <div class="label">企业简介</div>
        <div id="orgDesc" class="kv empty">加载中…</div>
      </div>
    </div>

    <!-- 5) 专长领域（占位） -->
    <div class="card">
      <div class="label">专长领域（占位）</div>
      <div class="empty">（后续：领域/产品反推、人工标注、画像等）</div>
    </div>

    <!-- 6) 特色产品 -->
    <div class="card">
      <div class="label">特色产品</div>
      <div class="hint">（recommendation_score ≥ 6）</div>
      <div id="featuredProducts" class="chips"></div>
      <div id="featuredEmpty" class="empty" style="display:none;">（无）</div>
    </div>

    <!-- 7) 其他产品 -->
    <div class="card">
      <div class="label">其他产品</div>
      <div id="otherProducts" class="chips"></div>
      <div id="otherEmpty" class="empty" style="display:none;">（无）</div>
    </div>

    <!-- 8) 融资信息（占位） -->
    <div class="card">
      <div class="label">融资信息（占位）</div>
      <div class="empty">（后续：融资数据源接入）</div>
    </div>

    <!-- 9) 荣誉与资质（占位） -->
    <div class="card">
      <div class="label">荣誉与资质（占位）</div>
      <div class="empty">（后续：荣誉/资质数据源接入）</div>
    </div>

    <!-- 10) 报告与书籍（占位） -->
    <div class="card">
      <div class="label">报告与书籍（占位）</div>
      <div class="empty">（后续：报告索引、引用、下载等）</div>
    </div>

    <!-- 11) 社会活动（占位） -->
    <div class="card">
      <div class="label">社会活动（占位）</div>
      <div class="empty">（后续：新闻/事件、CSR 等）</div>
    </div>
  </div>

  <!-- modal -->
  <div id="modalOverlay" class="modal-overlay" role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal-title" id="modalTitle">开发中</div>
      <div class="modal-body" id="modalBody">开发中</div>
      <div class="modal-actions">
        <button class="modal-btn" id="modalClose" type="button">关闭</button>
      </div>
    </div>
  </div>

  <script type="module" src="/src/company.js"></script>
</body>
</html>
