import { createHash } from 'node:crypto';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

const list = value => value == null ? [] : Array.isArray(value) ? value : [value];
export const plain = value => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
export function safeUrl(value) {
  try {
    const u = new URL(value);
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return null;
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/.test(key)) u.searchParams.delete(key);
    return u.href;
  } catch { return null; }
}
export function relevant(title) {
  return /\b(agent(?:s|ic)?|claude|codex|chatgpt|gemini|llm|mcp|n8n|openclaw)\b|智能体|大模型|人工智能/i.test(title);
}
export function classify(title) {
  const agent = /claude code/i.test(title) ? 'Claude Code' : /codex/i.test(title) ? 'Codex' : /claude/i.test(title) ? 'Claude' : /chatgpt/i.test(title) ? 'ChatGPT' : /gemini/i.test(title) ? 'Gemini' : '通用智能体';
  const category = /cod(e|ing|ex)|program|github|debug|mcp|sdk|cli|软件|代码/i.test(title) ? '软件开发' : /writ|video|image|music|创作|视频/i.test(title) ? '内容与创作' : /travel|flight|hotel|旅行/i.test(title) ? '旅行与出行' : /office|meeting|email|workflow|办公|工作流/i.test(title) ? '办公与效率' : '研究与学习';
  return {agent, category};
}
export function normalizeItem(raw, source, now = new Date()) {
  const sourceUrl = safeUrl(raw.url);
  const title = plain(raw.title).slice(0, 240);
  if (!sourceUrl || !title || !relevant(title)) return null;
  const date = new Date(raw.date);
  return {
    id: 'feed-' + createHash('sha256').update(sourceUrl).digest('hex').slice(0, 20),
    originalTitle: title, title, source: sourceUrl, sourceName: source.name,
    sourceId: source.id, discussion: safeUrl(raw.discussion),
    publishedAt: Number.isFinite(date.valueOf()) ? date.toISOString() : null,
    collectedAt: now.toISOString(), type: '采集线索', ...classify(title),
    description: `来自 ${source.name} 的公开条目。尚未核验实际效果，点击查看原文。`,
    detail: '自动采集仅使用公开标题、链接与发布时间，没有读取完整文章。该条目可能是工具发布、讨论或实践分享，需要阅读原文判断。',
    limit: '自动收录不代表推荐或成功验证；工具和场景标签由标题关键词推断。',
    translation: 'pending',
  };
}
export function parseFeed(xml, source) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('订阅源包含不支持的文档类型或实体声明');
  if (XMLValidator.validate(xml) !== true) throw new Error('订阅源不是有效的 XML');
  const doc = new XMLParser({ignoreAttributes:false, parseTagValue:false, trimValues:true}).parse(xml);
  const atom = !!doc.feed;
  if (!doc.feed && !doc.rss?.channel && !doc['rdf:RDF']) throw new Error('未识别的 RSS/Atom 格式');
  const rows = atom ? list(doc.feed.entry) : list(doc.rss?.channel?.item ?? doc['rdf:RDF']?.item);
  return rows.slice(0, source.limit ?? 50).map(row => {
    const links = list(row.link);
    const link = atom ? links.find(l => typeof l === 'object' && (!l['@_rel'] || l['@_rel'] === 'alternate'))?.['@_href'] : row.link;
    let url; try { url = new URL(link, source.url).href; } catch { url = ''; }
    return {title: typeof row.title === 'object' ? row.title['#text'] : row.title, url, date: row.published ?? row.updated ?? row.pubDate ?? row['dc:date']};
  });
}
export function mergeItems(previous, incoming, options = {}, now = new Date()) {
  const map = new Map(previous.map(item => [item.id, item]));
  for (const item of incoming) {
    if (!item) continue;
    const old = map.get(item.id);
    // 保留首次采集时间与已完成的中文翻译；原题变化后重新进入翻译队列。
    map.set(item.id, old && old.originalTitle === item.originalTitle
      ? {...old, publishedAt:item.publishedAt ?? old.publishedAt}
      : {...item, collectedAt:old?.collectedAt ?? item.collectedAt});
  }
  const cutoff = now.valueOf() - (options.maxAgeDays ?? 90) * 86400000;
  return [...map.values()].filter(x => new Date(x.publishedAt ?? x.collectedAt).valueOf() >= cutoff)
    .sort((a,b) => new Date(b.publishedAt ?? b.collectedAt) - new Date(a.publishedAt ?? a.collectedAt))
    .slice(0, options.maxItems ?? 300);
}
export function validateTranslations(value, items) {
  if (!Array.isArray(value?.items)) throw new Error('翻译结果缺少 items 数组');
  const ids = new Set(items.map(i => i.id));
  const result = new Map();
  for (const item of value.items) {
    if (!ids.has(item.id) || result.has(item.id) || typeof item.title !== 'string' || !/[\u3400-\u9fff]/.test(item.title) || item.title.length > 180 || item.title.length < 2) throw new Error('翻译结果的编号或中文标题无效');
    result.set(item.id, plain(item.title));
  }
  if (result.size !== ids.size) throw new Error('翻译结果不完整');
  return result;
}
