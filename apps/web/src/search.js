// apps/web/src/search.js
import { mountGlobalSearch } from './ui/global-search.js';
import { mountSolutionSearch } from './ui/solution-search.js';

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

  // Tab 1：全站搜索（保留现有 UI 逻辑）
  mountGlobalSearch(document.getElementById('globalSearch'), {
    title: '全站搜索',
    placeholder: '全站搜索：企业 / 产品 / 领域（输入关键词后回车）',
  });

  // Tab 2：解决方案搜索（新）
  mountSolutionSearch(document.getElementById('solutionSearch'));
}

main();
