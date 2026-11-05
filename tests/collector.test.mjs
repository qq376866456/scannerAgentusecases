import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeItem,parseFeed,mergeItems,validateTranslations,safeUrl} from '../scripts/lib.mjs';

const source={id:'test',name:'测试来源',url:'https://example.org/feed.xml',limit:20};
const now=new Date('2026-11-05T00:00:00Z');
const item=(title='Build a coding agent',url='https://example.org/article')=>normalizeItem({title,url,date:now},source,now);
test('拒绝危险协议，并移除跟踪参数以去重',()=>{
  assert.equal(safeUrl('javascript:alert(1)'),null);
  assert.equal(safeUrl('https://user:secret@example.org/'),null);
  assert.equal(item(undefined,'https://example.org/article?utm_source=test#section').id,item().id);
  assert.equal(normalizeItem({title:'A garden walk',url:'https://example.org/'},source,now),null);
});
test('Atom 选择正文链接而非 self 链接，支持单条 entry',()=>{
  const rows=parseFeed('<feed><entry><title>Agent &amp; tools</title><link rel="self" href="/api/1"/><link rel="alternate" href="/post/1"/><updated>2026-11-04T00:00:00Z</updated></entry></feed>',source);
  assert.equal(rows[0].url,'https://example.org/post/1');
  assert.equal(rows[0].title,'Agent & tools');
});
test('RSS 支持 CDATA；拒绝错误 XML 与实体定义',()=>{
  assert.equal(parseFeed('<rss><channel><item><title><![CDATA[Claude code]]></title><link>https://example.org/a</link></item></channel></rss>',source)[0].title,'Claude code');
  assert.throws(()=>parseFeed('<rss><channel>',source));
  assert.throws(()=>parseFeed('<!DOCTYPE feed><feed/>',source));
});
test('增量合并保留旧条目、翻译与首次采集时间',()=>{
  const old={...item(),translation:'done',title:'编程智能体',collectedAt:'2026-11-01T00:00:00.000Z'};
  const other=item('Claude review','https://example.org/b');
  const merged=mergeItems([old,other],[item()],{},now);
  assert.equal(merged.length,2);assert.equal(merged.find(x=>x.id===old.id).title,'编程智能体');
  assert.equal(merged.find(x=>x.id===old.id).collectedAt,old.collectedAt);
  const changed=mergeItems([old],[item('New agent design')],{},now)[0];
  assert.equal(changed.translation,'pending');
});
test('过期清理与容量控制按时间执行',()=>{
  const old={...item('Claude old','https://example.org/old'),publishedAt:'2020-01-01T00:00:00Z'};
  assert.equal(mergeItems([old,item()],[item('New agent','https://example.org/new')],{maxItems:1,maxAgeDays:30},now).length,1);
  assert.equal(mergeItems([old],[],{},now).length,0);
});
test('翻译必须完整、编号匹配且包含中文',()=>{
  const input=[item()];const id=input[0].id;
  assert.equal(validateTranslations({items:[{id,title:'构建编程智能体'}]},input).get(id),'构建编程智能体');
  assert.throws(()=>validateTranslations({items:[]},input));
  assert.throws(()=>validateTranslations({items:[{id:'wrong',title:'中文'}]},input));
  assert.throws(()=>validateTranslations({items:[{id,title:'English only'}]},input));
});
