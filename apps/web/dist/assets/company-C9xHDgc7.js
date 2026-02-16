import"./modulepreload-polyfill-B5Qt9EMX.js";import{m as x}from"./global-search-DWEeHIbM.js";_();x(document.getElementById("globalSearch"));const p=v("/company");p?h(p):(n("#pageTitle","企业/机构"),n("#baseInfo","（缺少企业标识）"),n("#description","（缺少企业标识）"));const d=document.getElementById("devModal"),u=document.getElementById("devModalClose");d&&u&&(u.addEventListener("click",()=>d.style.display="none"),d.addEventListener("click",t=>{t.target===d&&(d.style.display="none")}));function y(){d&&(d.style.display="")}async function h(t){m("#featuredProducts"),m("#otherProducts"),n("#baseInfo","（加载中）"),n("#description","（加载中）");try{const e=await fetch(`/api/company/${encodeURIComponent(t)}`);if(!e.ok){const s=await k(e);throw new Error(`HTTP ${e.status}: ${s||e.statusText}`)}const o=await e.json(),r=o.company||{},c=r.organization_short_name||r.organization_full_name||r.organization_slug||t;n("#pageTitle",c);const a=[];a.push(`企业全称：${r.organization_full_name||"（无）"}`),a.push(`成立时间：${r.establish_year??"（无）"}`),r.if_ipo===!0&&a.push("最近融资：已上市"),n("#baseInfo",a.join(`
`));const l=r.organization_description||"";n("#description",l.trim()?l:"（无）");const i=Array.isArray(o.products)?o.products:[],g=i.filter(s=>(s.recommendation_score??0)>=6),b=i.filter(s=>(s.recommendation_score??0)<6);f("#featuredProducts",g,{color:"blue",clickMode:"modal"}),f("#otherProducts",b,{color:"gray",clickMode:"modal"})}catch(e){n("#baseInfo","（无）"),n("#description","（无）");const o=document.createElement("div");o.className="error",o.textContent=`加载失败：${(e==null?void 0:e.message)||e}`,document.querySelector("main").insertAdjacentElement("afterbegin",o)}}function f(t,e,{color:o,clickMode:r}){const c=document.querySelector(t);if(c){if(c.innerHTML="",!e.length){c.innerHTML='<div class="muted">（无）</div>';return}for(const a of e){const l=a.security_product_name||a.security_product_slug||String(a.security_product_id||""),i=document.createElement("button");i.type="button",i.className=`chip ${o==="blue"?"chip-blue":"chip-gray"}`,i.textContent=l,i.addEventListener("click",()=>{y()}),c.appendChild(i)}}}function v(t){const e=window.location.pathname||"",o=e.indexOf(t);if(o===-1)return"";const r=e.slice(o+t.length).replace(/^\/+/,"");return decodeURIComponent(r||"").trim()}function n(t,e){const o=document.querySelector(t);o&&(o.textContent=e)}function m(t){const e=document.querySelector(t);e&&(e.innerHTML="")}async function k(t){try{return await t.text()}catch{return""}}function _(){if(document.getElementById("baseStyles"))return;const t=document.createElement("style");t.id="baseStyles",t.textContent=`
    :root{--bg:#f6f7fb;--card:#fff;--border:#e6e8ef;--text:#111;--muted:#6b7280;--purple:#6d28d9;--purple2:#7c3aed;--blue:#2563eb;--blue2:#3b82f6;}
    body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; background:var(--bg); color:var(--text);}
    .page{max-width:980px;margin:32px auto;padding:0 16px 48px;}
    .page-title{font-size:34px;letter-spacing:0.2px;margin:0 0 18px;}
    .card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px 18px;margin:14px 0;}
    .card-title{font-size:18px;margin:0 0 10px;}
    .kv{line-height:1.7;white-space:pre-wrap;}
    .muted{color:var(--muted);}
    .grid-2{display:grid;grid-template-columns:1fr;gap:14px;}
    @media (min-width:860px){.grid-2{grid-template-columns:1fr 1fr;}}
    .chip-row{display:flex;flex-wrap:wrap;gap:10px;}
    .chip{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;text-decoration:none;border:1px solid transparent;cursor:pointer;background:#fff;}
    .chip-blue{background:rgba(59,130,246,0.12);border-color:rgba(59,130,246,0.22);color:#0a2c6a;}
    .chip-blue:hover{background:rgba(59,130,246,0.18);}
    .chip-gray{background:rgba(148,163,184,0.12);border-color:rgba(148,163,184,0.22);color:#1f2937;}
    .chip-gray:hover{background:rgba(148,163,184,0.18);}
    .error{background:#fff5f5;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:10px 12px;margin:0 0 14px;}
    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;}
    .modal{width:min(520px,100%);background:#fff;border:1px solid rgba(0,0,0,0.15);border-radius:14px;padding:14px;}
    .modal-title{font-size:16px;font-weight:700;margin-bottom:8px;}
    .modal-body{color:var(--muted);line-height:1.6;}
    .modal-actions{display:flex;justify-content:flex-end;margin-top:12px;}
    .btn{border:1px solid var(--border);background:#fff;border-radius:10px;padding:8px 12px;cursor:pointer;}
    .btn:hover{background:#f8fafc;}
  `,document.head.appendChild(t)}
