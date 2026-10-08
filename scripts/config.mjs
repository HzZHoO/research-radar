import fs from 'node:fs/promises';
import net from 'node:net';

const publicUrl=value=> {
  const u=new URL(value);
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('信源地址必须是无凭据的 HTTP(S) URL');
  const hostname=u.hostname.toLowerCase().replace(/^\[|\]$/g,'');
  if(hostname==='localhost'||hostname.endsWith('.local')||net.isIP(hostname)||!hostname.includes('.'))throw Error('信源必须使用公共域名');
  return u.href;
};
export function validateConfig(config){
  if(config.version!==1)throw Error('不支持的配置版本');
  if(typeof config.siteTitle!=='string'||!config.siteTitle.trim()||config.siteTitle.length>80)throw Error('站点名称需要 1–80 个字符');
  if(config.timezone!=='Asia/Shanghai')throw Error('目前更新时间使用北京时间');
  if(!Number.isInteger(config.historyDays)||config.historyDays<1||config.historyDays>365)throw Error('回溯天数必须为 1–365');
  if(!Array.isArray(config.scheduleTimes)||config.scheduleTimes.length<1||config.scheduleTimes.length>8||config.scheduleTimes.some(t=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))throw Error('请设置 1–8 个 HH:mm 格式的更新时刻');
  if(!config.arxiv||typeof config.arxiv.enabled!=='boolean'||!Array.isArray(config.arxiv.categories)||config.arxiv.categories.length>10||config.arxiv.categories.some(c=>!/^([a-z-]+\.[A-Za-z]+|[a-z-]+)$/.test(c)))throw Error('arXiv 分类不合法');
  if(!Number.isInteger(config.arxiv.maxResults)||config.arxiv.maxResults<10||config.arxiv.maxResults>200)throw Error('arXiv 每组最多抓取 10–200 条');
  if(config.arxiv.maxPages!==undefined&&(!Number.isInteger(config.arxiv.maxPages)||config.arxiv.maxPages<1||config.arxiv.maxPages>10))throw Error('arXiv 最多翻页数必须为 1–10');
  if(!Array.isArray(config.topics)||config.topics.length<1||config.topics.length>10)throw Error('研究方向数量需要为 1–10');
  const ids=new Set();
  for(const topic of config.topics){
    if(!/^[a-z0-9-]{1,40}$/.test(topic.id)||ids.has(topic.id))throw Error('研究方向 ID 必须唯一且仅含小写字母、数字或连字符');
    ids.add(topic.id);
    if(typeof topic.name!=='string'||!topic.name.trim()||topic.name.length>100||typeof topic.enabled!=='boolean')throw Error('研究方向名称或启停状态不合法');
    for(const key of ['directPhrases','relatedPhrases','contextTerms','excludePhrases']){
      if(!Array.isArray(topic[key])||topic[key].length>40||topic[key].some(p=>typeof p!=='string'||!p.trim()||p.length>120))throw Error(`方向 ${topic.name} 的关键词不合法`);
    }
    if(topic.enabled&&!topic.directPhrases.length&&!topic.relatedPhrases.length)throw Error('启用的方向至少需要一个关键词');
    if(!Number.isFinite(topic.relatedMinScore)||topic.relatedMinScore<1||topic.relatedMinScore>100)throw Error('相关方法阈值必须为 1–100');
  }
  if(!config.topics.some(t=>t.enabled))throw Error('至少需要启用一个研究方向');
  if(!Array.isArray(config.sources)||config.sources.length>30)throw Error('最多配置 30 个博客或 RSS 信源');
  const sourceIds=new Set();
  for(const s of config.sources){
    if(!/^[a-z0-9-]{1,50}$/.test(s.id)||s.id.startsWith('arxiv-')||sourceIds.has(s.id))throw Error('信源 ID 必须唯一，且不能以 arxiv- 开头');
    sourceIds.add(s.id);publicUrl(s.url);
    if(s.format!==undefined&&!['rss','crossref'].includes(s.format))throw Error('信源获取方式不合法');
    if(s.format==='crossref'&&(new URL(s.url).hostname!=='api.crossref.org'||new URL(s.url).pathname!=='/works'))throw Error('Crossref 来源需要官方 works 检索地址');
    if(s.fallbackUrl)publicUrl(s.fallbackUrl);
    if(typeof s.name!=='string'||!s.name.trim()||s.name.length>100||!['paper','blog'].includes(s.type)||typeof s.enabled!=='boolean')throw Error('信源名称、类型或启停状态不合法');
    if(s.enrichLimit!==undefined&&(!Number.isInteger(s.enrichLimit)||s.enrichLimit<1||s.enrichLimit>60))throw Error('正文补充上限必须为 1–60');
    if(s.maxPages!==undefined&&(!Number.isInteger(s.maxPages)||s.maxPages<1||s.maxPages>10))throw Error('检索信源最多翻页数必须为 1–10');
  }
  if(!config.arxiv.enabled&&!config.sources.some(s=>s.enabled))throw Error('至少需要启用一个信源');
  if(config.coverageChecks!==undefined){
    if(!Array.isArray(config.coverageChecks)||config.coverageChecks.length>30)throw Error('最多设置 30 条覆盖检查');
    for(const check of config.coverageChecks){publicUrl(check.url);if(typeof check.title!=='string'||!check.title.trim()||!Number.isFinite(Date.parse(check.publishedOn)))throw Error('覆盖检查需要标题、公开链接和发布日期');}
  }
  return config;
}
export async function loadConfig(file='config.json'){return validateConfig(JSON.parse(await fs.readFile(file,'utf8')));}
export function isScheduledDue(config,date=new Date()){
  const hour=(date.getUTCHours()+8)%24;
  const slot=Math.floor((hour*60+date.getUTCMinutes())/15);
  return config.scheduleTimes.some(time=>{
    const [h,m]=time.split(':').map(Number);
    return Math.ceil((h*60+m)/15)%96===slot;
  });
}
export function makeSources(config){
  const sources=config.sources.filter(s=>s.enabled);
  if(!config.arxiv.enabled)return sources;
  const categories=config.arxiv.categories;
  const categoryQuery=categories.length?`(${categories.map(c=>`cat:${c}`).join(' OR ')}) AND `:'';
  const generated=[];
  for(const topic of config.topics.filter(t=>t.enabled)){
    for(const [kind,phrases] of [['direct',topic.directPhrases],['related',topic.relatedPhrases]]){
      const english=phrases.filter(p=>/[a-zA-Z]/.test(p));if(!english.length)continue;
      const query=categoryQuery+`(${english.map(p=>`all:"${p.replace(/["\\]/g,' ')}"`).join(' OR ')})`;
      const url=new URL('https://export.arxiv.org/api/query');
      url.search=new URLSearchParams({search_query:query,start:'0',max_results:String(config.arxiv.maxResults),sortBy:'submittedDate',sortOrder:'descending'});
      generated.push({id:`arxiv-${topic.id}-${kind}`,name:`arXiv · ${topic.name}${kind==='related'?' · 相关方法':''}`,type:'paper',url:url.href,maxPages:config.arxiv.maxPages||3,
        fallbackUrl:`https://rss.arxiv.org/rss/${categories.join('+')||'cs.AI'}`});
    }
  }
  return [...generated,...sources];
}
export function rankTopics(item,config,rank){
  const classifications=config.topics.filter(t=>t.enabled).map(topic=>({id:topic.id,name:topic.name,...rank(item,topic)})).filter(c=>c.tier!=='excluded');
  const direct=classifications.filter(c=>c.tier==='direct');
  return {classifications,topicIds:classifications.map(c=>c.id),topicNames:classifications.map(c=>c.name),
    tier:direct.length?'direct':classifications.length?'related':'excluded',score:Math.max(0,...classifications.map(c=>c.score)),
    matches:[...new Set(classifications.flatMap(c=>c.matches))]};
}
