import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';

const root = new URL('../dist/', import.meta.url);
const html = fs.readFileSync(new URL('index.html', root), 'utf8');
const feed = Array.from({length: 9}, (_, i) => ({
  id: `network-${i}`, title: i === 0 ? 'Codex 自动整理代码' : `Claude 研究资料 ${i}`,
  originalTitle: i === 0 ? 'Codex code organizer' : `Claude research ${i}`,
  category: i === 0 ? '软件开发' : '研究与学习', agent: i === 0 ? 'Codex' : 'Claude',
  source: `https://example.com/article/${i}`, sourceName: i === 0 ? 'Hacker News' : '公开 RSS',
  publishedAt: '2026-11-05T00:00:00Z', collectedAt: '2026-11-05T01:00:00Z',
  description: '公开来源线索', translation: 'done'
}));

function setup(t, storage = {}) {
  const dom = new JSDOM(html, {url: 'https://example.com/scannerAgentusecases/', runScripts: 'outside-only'});
  const w = dom.window, d = w.document, errors = [], scrolls = [];
  w.addEventListener('error', e => errors.push(e.error));
  // 模拟浏览器原生能力；测试覆盖页面事件及 DOM 结果，不代表真实布局或剪贴板授权验证。
  w.HTMLElement.prototype.scrollIntoView = function () { scrolls.push(this.id); };
  w.scrollTo = () => {};
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  let copied = '';
  Object.defineProperty(w.navigator, 'clipboard', {value: {writeText: async text => { copied = text; }}});
  for (const [key, value] of Object.entries(storage)) w.localStorage.setItem(key, value);
  for (const script of d.querySelectorAll('script[src]')) {
    const path = new URL(script.src).pathname.split('/scannerAgentusecases/')[1];
    if (path === 'data/feed.js') w.AGENT_FEED = {items: feed, lastCollectedAt: '2026-11-05T01:00:00Z', status: 'ok'};
    else new vm.Script(fs.readFileSync(new URL(path, root), 'utf8'), {filename: path}).runInContext(dom.getInternalVMContext());
  }
  const $ = selector => d.querySelector(selector);
  const click = selector => { assert.ok($(selector), `缺少控件：${selector}`); $(selector).click(); };
  const input = (selector, value, event = 'input') => { $(selector).value=value; $(selector).dispatchEvent(new w.Event(event, {bubbles: true})); };
  const count = selector => d.querySelectorAll(selector).length;
  t.after(() => { dom.window.close(); assert.deepEqual(errors, [], '页面不能产生运行错误'); });
  return {w, d, $, click, input, count, scrolls, copied: () => copied};
}

test('场景与工具筛选同时更新网络线索和编辑案例，并定位到结果区', t => {
  const ui = setup(t);
  assert.equal(ui.$('#total-count').textContent, '27');
  ui.click('[data-category="软件开发"]');
  assert.equal(ui.count('#feed-grid article'), 1);
  assert.equal(ui.count('#case-grid article'), 4);
  assert.equal(ui.$('[data-category="软件开发"]').getAttribute('aria-pressed'), 'true');
  assert.equal(ui.scrolls.at(-1), 'results-start');
  assert.match(ui.$('#results-summary').textContent, /1 条网络线索 · 4 个编辑案例/);
  ui.click('[data-agent="Codex"]');
  assert.equal(ui.count('#feed-grid article'), 1);
  assert.equal(ui.count('#case-grid article'), 2);
  ui.click('[data-category="旅行与出行"]');
  assert.equal(ui.count('#feed-grid article'), 0);
  assert.equal(ui.count('#case-grid article'), 0);
  assert.equal(ui.$('#feed-empty').hidden, false);
  assert.equal(ui.$('#empty').hidden, false);
  ui.click('#all-filter');
  assert.equal(ui.count('#feed-grid article'), 6);
  assert.equal(ui.count('#case-grid article'), 9);
});

test('主搜索覆盖网络原标题，清除筛选与全部重置恢复两组内容', t => {
  const ui = setup(t);
  ui.input('#search', 'code organizer');
  assert.equal(ui.count('#feed-grid article'), 1);
  assert.equal(ui.count('#case-grid article'), 0);
  ui.click('[data-clear="query"]');
  assert.equal(ui.$('#search').value, '');
  ui.input('#feed-search', '不存在');
  assert.equal(ui.count('#feed-grid article'), 0);
  ui.click('#all-filter');
  assert.equal(ui.$('#feed-search').value, '');
  assert.equal(ui.count('#feed-grid article'), 6);
  ui.click('[data-query="旅行"]');
  assert.equal(ui.count('#case-grid article'), 2);
});

test('网络与编辑收藏共用收藏页，持久保存并可从详情取消', t => {
  const ui = setup(t);
  ui.click('[data-save="network-0"]');
  ui.click('[data-save="restaurant"]');
  assert.equal(ui.$('#saved-count').textContent, '2');
  const storage = {'agent-zh-saved': ui.w.localStorage.getItem('agent-zh-saved')};
  const reload = setup(t, storage);
  reload.click('#saved-nav');
  assert.equal(reload.count('#feed-grid article'), 1);
  assert.equal(reload.count('#case-grid article'), 1);
  reload.click('[data-feed-id="network-0"]');
  assert.equal(reload.$('#feed-detail').open, true);
  assert.match(reload.$('#feed-detail-content .source-link').href, /example.com\/article\/0/);
  reload.click('#feed-detail-save');
  assert.equal(reload.$('#feed-detail-save').getAttribute('aria-pressed'), 'false');
  assert.equal(reload.count('#feed-grid article'), 0);
  assert.equal(reload.$('#saved-count').textContent, '1');
  reload.click('#feed-detail .close');
  assert.equal(reload.$('#feed-detail').open, false);
});

test('网络来源过滤、加载更多、折叠后筛选自动展开', t => {
  const ui = setup(t);
  ui.click('#feed-more');
  assert.equal(ui.count('#feed-grid article'), 9);
  assert.equal(ui.$('#feed-more').hidden, true);
  ui.input('#feed-source', '公开 RSS', 'change');
  assert.equal(ui.count('#feed-grid article'), 6);
  assert.match(ui.$('#feed-count').textContent, /^8 \/ 9/);
  ui.click('#feed-toggle');
  assert.equal(ui.$('#feed-body').hidden, true);
  ui.click('[data-agent="Claude"]');
  assert.equal(ui.$('#feed-body').hidden, false);
  assert.equal(ui.$('#feed-toggle').getAttribute('aria-expanded'), 'true');
  ui.click('#all-filter');
  assert.equal(ui.$('#feed-source').value, '');
});

test('编辑详情、提示词复制、关于、深色模式与排序按钮可用', async t => {
  const ui = setup(t);
  ui.click('#case-grid [data-open="restaurant"]');
  assert.equal(ui.$('#detail').open, true);
  await ui.$('#copy-prompt').onclick();
  assert.match(ui.copied(), /帮我寻找/);
  assert.equal(ui.$('#copy-prompt').textContent, '已复制 ✓');
  ui.click('#detail .close');
  ui.click('#about');
  assert.equal(ui.$('#about-dialog').open, true);
  ui.click('#about-dialog .close');
  ui.click('#theme');
  assert.equal(ui.d.body.classList.contains('dark'), true);
  assert.equal(ui.w.localStorage.getItem('agent-zh-dark'), 'true');
  ui.click('#sort-new');
  assert.equal(ui.$('#case-grid .card-title').dataset.open, 'brief');
  ui.click('#sort-pick');
  assert.equal(ui.$('#case-grid .card-title').dataset.open, 'restaurant');
  ui.click('#load-more');
  assert.equal(ui.count('#case-grid article'), 18);
});

test('新增个人灵感可搜索、刷新保留、收藏和删除', t => {
  const ui = setup(t);
  ui.click('#submit');
  ui.input('#idea-form [name="title"]', '回归测试灵感');
  ui.input('#idea-form [name="description"]', '用于验证本地保存');
  ui.input('#idea-form [name="prompt"]', '请整理我的笔记');
  ui.$('#idea-form').dispatchEvent(new ui.w.Event('submit', {bubbles: true, cancelable: true}));
  assert.equal(ui.$('#submit-dialog').open, false);
  assert.equal(ui.$('#case-grid .card-title').textContent, '回归测试灵感');
  const reload=setup(t, {'agent-zh-custom': ui.w.localStorage.getItem('agent-zh-custom')});
  reload.input('#search', '回归测试灵感');
  assert.equal(reload.count('#case-grid article'), 1);
  reload.click('#case-grid .save-btn');
  reload.click('#case-grid .card-title');
  reload.click('#delete-idea');
  assert.equal(reload.count('#case-grid article'), 0);
  assert.equal(reload.$('#saved-count').textContent, '0');
  assert.equal(reload.w.localStorage.getItem('agent-zh-custom'), '[]');
});

test('随机选择可以打开网络详情，斜杠快捷键定位主搜索', t => {
  const ui = setup(t);
  ui.w.Math.random=()=>0.999;
  ui.click('#random');
  assert.equal(ui.$('#feed-detail').open, true);
  ui.click('#feed-detail .close');
  ui.d.dispatchEvent(new ui.w.KeyboardEvent('keydown', {key: '/', bubbles: true, cancelable: true}));
  assert.equal(ui.d.activeElement.id, 'search');
});
