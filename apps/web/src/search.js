// apps/web/src/search.js
import { mountGlobalSearch } from './ui/global-search.js';

function $(id) {
  return document.getElementById(id);
}

function setTab(active) {
  const tabSearch = $('tabSearch');
  const tabSolution = $('tabSolution');
  const panelSearch = $('panelSearch');
  const panelSolution = $('panelSolution');

  const isSearch = active === 'search';

  tabSearch.setAttribute('aria-selected', isSearch ? 'true' : 'false');
  tabSolution.setAttribute('aria-selected', isSearch ? 'false' : 'true');

  panelSearch.dataset.active = isSearch ? 'true' : 'false';
  panelSolution.dataset.active = isSearch ? 'false' : 'true';
}

function main() {
  const tabSearch = $('tabSearch');
  const tabSolution = $('tabSolution');

  tabSearch?.addEventListener('click', () => setTab('search'));
  tabSolution?.addEventListener('click', () => setTab('solution'));

  // 默认：搜索
  setTab('search');

  // 挂载全局搜索：统一列表渲染
  const mountEl = $('globalSearch');
  mountGlobalSearch(mountEl, {
    renderMode: 'list',
    title: '全局搜索',
    placeholder: '搜索企业（简称/全称）、安全产品/领域（名称/别称）…',
    autoFocus: true,
  });
}

main();
