(() => {
  const data = window.AGENT_FEED;
  const validUrl = value => { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; } };
  const items = Array.isArray(data?.items) ? data.items.filter(x => x && typeof x.title === 'string' && typeof x.id === 'string' && typeof x.sourceName === 'string' && validUrl(x.source)) : [];
  let limit = 6;
  const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('zh-CN', {timeZone:'Asia/Shanghai', hour12:false}) : '时间未提供';
  $('#feed-count').textContent = `${items.length} 条线索`;
  if (data?.lastCollectedAt) {
    const stale = Date.now() - Date.parse(data.lastCollectedAt) > 36*3600*1000;
    $('#feed-status').textContent = `上次采集：${date(data.lastCollectedAt)}（北京时间）${data.status==='partial'?' · 部分来源未成功，已保留历史数据':''}${stale?' · 数据超过 36 小时未更新':''}`;
  }
  for (const name of [...new Set(items.map(x=>x.sourceName))]) {const option=document.createElement('option'); option.value=name;option.textContent=name;$('#feed-source').appendChild(option);}
  function showItem(id) {
    const item=items.find(x=>x.id===id);if(!item)return;
    $('#feed-detail-content').innerHTML=`<span class="modal-eyebrow">网络线索 · 尚未核验</span><h2>${escapeHTML(item.title)}</h2>${item.translation==='done'?`<p>原标题：${escapeHTML(item.originalTitle)}</p>`:''}<p>${escapeHTML(item.detail||'该条目来自公开订阅源。请阅读原文判断实际适用性。')}</p><p>来源：${escapeHTML(item.sourceName)}<br>原文发布时间：${date(item.publishedAt)}<br>首次采集时间：${date(item.collectedAt)}</p><p>${escapeHTML(item.limit||'尚未核验实际效果。')}</p><a class="source-link" href="${escapeHTML(validUrl(item.source))}" target="_blank" rel="noopener noreferrer">阅读原文 ↗</a>${validUrl(item.discussion)?` &nbsp; <a class="source-link" href="${escapeHTML(validUrl(item.discussion))}" target="_blank" rel="noopener noreferrer">查看讨论 ↗</a>`:''}<p class="detail-notice">${item.translation==='done'?'中文标题为翻译整理，原文为准。':'标题保留原文，尚未完成中文翻译。'}网络线索不会自动生成未经验证的成功描述或操作提示词。</p>`;
    $('#feed-detail').showModal();
  }
  function renderFeed() {
    const q=$('#feed-search').value.trim().toLowerCase(), source=$('#feed-source').value;
    const matches=items.filter(x=>(!source||x.sourceName===source)&&(!q||[x.title,x.originalTitle,x.agent,x.category].join(' ').toLowerCase().includes(q)));
    $('#feed-grid').innerHTML=matches.slice(0,limit).map(x=>`<article class="case-card feed-card"><div class="card-top"><span class="agent-icon">↗</span><span>${escapeHTML(x.sourceName)}</span></div><button class="card-title" data-feed-id="${escapeHTML(x.id)}">${escapeHTML(x.title)}</button><p class="card-description">${escapeHTML(x.description||'公开来源线索，点击查看原文。')}</p><div class="card-tags"><span class="tag evidence">采集线索</span><span class="tag">${x.translation==='done'?'中文译题':'原文标题'}</span></div><div class="card-bottom"><span>${x.publishedAt?date(x.publishedAt).split(' ')[0]:'日期待确认'}</span><button data-feed-id="${escapeHTML(x.id)}">查看来源 ↗</button></div></article>`).join('');
    $('#feed-more').hidden=matches.length<=limit;$('#feed-empty').hidden=matches.length>0;
  }
  $('#feed-search').oninput=()=>{limit=6;renderFeed()};$('#feed-source').onchange=()=>{limit=6;renderFeed()};$('#feed-more').onclick=()=>{limit+=6;renderFeed()};
  $('#feed-toggle').onclick=()=>{const hidden=!$('#feed-body').hidden;$('#feed-body').hidden=hidden;$('#feed-toggle').textContent=hidden?'展开线索 ↓':'收起线索 ↑';$('#feed-toggle').setAttribute('aria-expanded',String(!hidden))};
  $('#feed-grid').onclick=e=>{const button=e.target.closest('[data-feed-id]');if(button)showItem(button.dataset.feedId)};
  renderFeed();
})();
