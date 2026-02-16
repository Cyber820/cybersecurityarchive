function f(t){if(!t)return;t.innerHTML=`
    <div class="gs">
      <div class="gs-title">全站搜索</div>
      <div class="gs-row">
        <input id="gsInput" class="gs-input" placeholder="全站搜索：企业 / 产品 / 领域（输入关键词后回车）" />
        <button id="gsBtn" class="gs-btn">搜索</button>
      </div>
      <div id="gsHint" class="gs-hint">输入关键词开始搜索。</div>
      <div id="gsResults" class="gs-results" style="display:none"></div>
    </div>
  `,m();const c=t.querySelector("#gsInput"),a=t.querySelector("#gsBtn"),r=t.querySelector("#gsHint"),n=t.querySelector("#gsResults"),o=async()=>{const s=String(c.value||"").trim();if(n.style.display="none",n.innerHTML="",!s){r.textContent="输入关键词开始搜索。";return}r.textContent="搜索中…";try{const i=await fetch(`/api/search?q=${encodeURIComponent(s)}`);if(!i.ok)throw new Error(`HTTP ${i.status}`);const d=await i.json(),l=Array.isArray(d.companies)?d.companies:[],g=Array.isArray(d.products)?d.products:[],u=Array.isArray(d.domains)?d.domains:[];if(!l.length&&!g.length&&!u.length){r.textContent="没有找到结果。";return}r.textContent="搜索结果：",n.style.display="",n.appendChild(p("企业/机构",l.map(e=>({label:e.organization_short_name||e.organization_full_name||e.organization_slug,href:`/company/${encodeURIComponent(e.organization_slug||e.organization_short_name||"")}`})))),n.appendChild(p("安全产品",g.map(e=>({label:e.security_product_name||e.security_product_slug,href:`/securityproduct/${encodeURIComponent(e.security_product_slug||"")}`})))),n.appendChild(p("安全领域",u.map(e=>({label:e.security_domain_name||e.cybersecurity_domain_slug,href:`/securitydomain/${encodeURIComponent(e.cybersecurity_domain_slug||"")}`}))))}catch(i){r.textContent=`搜索失败：${(i==null?void 0:i.message)||i}`}};a.addEventListener("click",o),c.addEventListener("keydown",s=>{s.key==="Enter"&&o()})}function p(t,c){const a=document.createElement("div");a.className="gs-group";const r=document.createElement("div");if(r.className="gs-group-title",r.textContent=t,a.appendChild(r),!c.length){const o=document.createElement("div");return o.className="gs-empty",o.textContent="（无）",a.appendChild(o),a}const n=document.createElement("div");n.className="gs-chip-row";for(const o of c.slice(0,8)){const s=document.createElement("a");s.className="gs-chip",s.textContent=o.label||"（未命名）",s.href=o.href||"#",n.appendChild(s)}return a.appendChild(n),a}function m(){if(document.getElementById("globalSearchStyles"))return;const t=document.createElement("style");t.id="globalSearchStyles",t.textContent=`
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
  `,document.head.appendChild(t)}export{f as m};
