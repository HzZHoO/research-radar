(() => {
  const cards=[...document.querySelectorAll('.card')];
  let tier='all',readIds=new Set();
  const readKey=`research-read-v2:${location.pathname.replace(/[^/]*$/, '')}`;
  try{readIds=new Set(JSON.parse(localStorage.getItem(readKey)||(!location.pathname.includes('/post-train-recipe/')?localStorage.getItem('rsi-read-v1'):null)||'[]'));}catch{}
  const type=document.querySelector('#type'),sort=document.querySelector('#sort'),search=document.querySelector('#search'),hide=document.querySelector('#hide-read'),days=document.querySelector('#days'),topic=document.querySelector('#topic'),source=document.querySelector('#source');
  const recipe=document.querySelector('#recipe');
  let classifications=new Map();
  let articleData=new Map();
  function update(){
    let visible=0;
    for(const card of cards){
      const read=readIds.has(card.dataset.id);card.classList.toggle('is-read',read);
      card.querySelector('.read-button').textContent=read?'恢复未读':'标为已读';
      const classification=topic.value==='all'?null:classifications.get(card.dataset.id)?.find(c=>c.id===topic.value);
      const effectiveTier=classification?.tier||card.dataset.tier;
      const effectiveScore=classification?.score??Number(card.dataset.score);
      card.dataset.displayScore=effectiveScore;
      const badge=card.querySelector('.tier');badge.textContent=effectiveTier==='direct'?'直接相关':'相关方法';badge.classList.toggle('direct',effectiveTier==='direct');badge.classList.toggle('related',effectiveTier==='related');
      card.querySelector('details summary').textContent=`命中原因 · ${effectiveScore} 分`;
      const matches=classification?.matches||articleData.get(card.dataset.id)?.matches;
      if(matches){const list=card.querySelector('.matches');list.replaceChildren();for(const match of matches){const span=document.createElement('span');span.textContent=match;list.append(span);}}
      card.hidden=(recipe.value!=='all'&&!card.dataset.recipe.split(' ').includes(recipe.value))||(topic.value!=='all'&&!card.dataset.topics.split(' ').includes(topic.value))||(source.value!=='all'&&card.dataset.source!==source.value)||(tier!=='all'&&effectiveTier!==tier)||(type.value!=='all'&&card.dataset.type!==type.value)||(days.value!=='all'&&Date.parse(card.dataset.date)<Date.now()-Number(days.value)*86400000)||(hide.checked&&read)||!card.textContent.toLowerCase().includes(search.value.trim().toLowerCase());
      if(!card.hidden)visible++;
    }
    cards.sort((a,b)=>sort.value==='score'?Number(b.dataset.displayScore)-Number(a.dataset.displayScore)||b.dataset.date.localeCompare(a.dataset.date):b.dataset.date.localeCompare(a.dataset.date)||Number(b.dataset.displayScore)-Number(a.dataset.displayScore));
    for(const card of cards)document.querySelector('#articles').append(card);
    document.querySelector('#shown').textContent=`${visible} / ${cards.length} 篇`;
    document.querySelector('#empty').hidden=visible>0;
  }
  for(const button of document.querySelectorAll('.tabs button'))button.addEventListener('click',()=>{
    tier=button.dataset.tier;for(const b of document.querySelectorAll('.tabs button')){b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));}update();
  });
  for(const element of [type,sort,search,hide,days,topic,source,recipe])element.addEventListener('input',update);
  for(const card of cards)card.querySelector('.read-button').addEventListener('click',()=>{
    const id=card.dataset.id;if(readIds.has(id))readIds.delete(id);else readIds.add(id);
    try{localStorage.setItem(readKey,JSON.stringify([...readIds]));}catch{}update();
  });
  update();
  const el=(tag,text,cls)=>{const node=document.createElement(tag);node.textContent=text;if(cls)node.className=cls;return node;};
  fetch('radar.json').then(r=>{if(!r.ok)throw Error('统计不可用');return r.json();}).then(data=> {
    classifications=new Map(data.articles.map(a=>[a.id,a.classifications]));
    articleData=new Map(data.articles.map(a=>[a.id,a]));
    for(const t of data.topics||[]){const option=el('option',t.name);option.value=t.id;topic.append(option);}
    for(const s of data.sources){const option=el('option',s.name);option.value=s.id;source.append(option);}
    update();
    const stats=document.querySelector('#stats');stats.replaceChildren();
    for(const [label,value] of [['直接相关',data.counts.direct],['相关方法',data.counts.related],['其中博客',data.counts.blogs],['本次新发现',data.counts.new]]){
      const node=el('div','','stat');node.append(el('strong',String(value)),el('span',label));stats.append(node);
    }
    const timestamp=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'short'}).format(new Date(data.generatedAt));
    stats.append(el('div',`更新：${timestamp}（北京时间） · 每天 ${(data.scheduleTimes||[]).join(' / ')} 更新 · 回溯 ${data.historyDays} 天 · ${data.counts.fetched} 条来源记录经过筛选与去重`,'update'));
    const table=el('table',''),thead=el('thead',''),tr=el('tr','');
    for(const title of ['来源','状态','抓取 / 命中','订阅覆盖日期'])tr.append(el('th',title));thead.append(tr);table.append(thead);
    const body=el('tbody','');
    for(const source of data.sources){
      const row=el('tr','');row.append(el('td',source.name));
      const status=source.status==='ok'?'正常':source.status==='degraded'?'备用来源':'抓取失败';
      const cell=el('td',status,source.status==='ok'?'good':'error');cell.title=source.error||source.warning||'';row.append(cell);
      row.append(el('td',`${source.fetched} / ${source.matched}`));
      row.append(el('td',source.earliest?`${source.earliest.slice(0,10)} → ${source.latest.slice(0,10)}`:'—'));body.append(row);
    }
    table.append(body);document.querySelector('#health').replaceChildren(table);
  }).catch(error=>{document.querySelector('#stats').textContent=error.message;document.querySelector('#health').textContent='无法读取来源状态，请查看抓取报告。';});
})();
