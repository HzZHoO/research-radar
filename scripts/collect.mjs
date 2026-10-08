import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import Parser from 'rss-parser';
import { load } from 'cheerio';
import { rank, canonicalId, normalize } from './rank.mjs';
import { loadConfig, makeSources, rankTopics } from './config.mjs';
import {stateDirectory,buildDirectory} from './profiles.mjs';
import {recipeSignals} from './recipe.mjs';
import {crossrefItems} from './crossref.mjs';
import {coverageChecks} from './coverage.mjs';
import {enrichmentPlan} from './enrichment.mjs';
import {paginateSource} from './pagination.mjs';

const parser = new Parser({customFields:{item:['published','updated','description','summary']}});
export const readJson = async (file, fallback) => {
  try { return JSON.parse(await fs.readFile(file,'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return fallback; throw error; }
};
const plain = text => load(String(text ?? '')).text().replace(/\s+/g,' ').trim();
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
const execFileAsync=promisify(execFile);
async function curlDownload(url) {
  const {stdout}=await execFileAsync(process.platform==='win32'?'curl.exe':'curl',[
    '--fail','--location','--silent','--show-error','--max-time','30','--max-filesize','12000000',
    '--user-agent','RSI-Feed/1.0 (+https://github.com/HzZHoO/rsi-feed)',url
  ],{maxBuffer:12000000,timeout:35000,windowsHide:true});
  return stdout;
}
async function download(url) {
  let last;
  for (let attempt=0;attempt<2;attempt++) {
    try {
      // Windows fetch and curl use different TLS stacks; system curl works with
      // common Windows network setups that reset Node's TLS connections.
      if(process.platform==='win32')return await curlDownload(url);
      const response=await fetch(url,{signal:AbortSignal.timeout(25000),headers:{'User-Agent':'RSI-Feed/1.0 (+https://github.com/HzZHoO/rsi-feed)',Accept:'application/atom+xml,application/rss+xml,application/xml,text/xml,*/*'}});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const content=await response.text();
      if (Buffer.byteLength(content)>12000000) throw new Error('Feed exceeds 12 MB');
      return content;
    } catch(error) { last=error; if(attempt===0) await sleep(3500); }
  }
  if(process.platform!=='win32')try{return await curlDownload(url);}catch{}
  throw last;
}
async function fetchSourceOnce(source) {
  if(source.format==='crossref'){
    const json=JSON.parse(await download(source.url));
    const items=crossrefItems(json);
    return {parsed:{items},effectiveUrl:source.url,warning:null,totalAvailable:json.message?.['total-results']};
  }
  let warning=null;
  let effectiveUrl=source.url;
  let xml;
  try { xml=await download(source.url); }
  catch(error) {
    if (!source.fallbackUrl) throw error;
    warning=`Primary unavailable (${error.message}); category RSS fallback used (narrower coverage).`;
    effectiveUrl=source.fallbackUrl;
    xml=await download(effectiveUrl);
  }
  const parsed=await parser.parseString(xml);
  // arXiv API can return an XML error entry even with HTTP 200.
  if (parsed.items.some(item=>/arxiv\.org\/api\/errors/.test(item.id||item.link||''))) throw new Error('arXiv API error entry');
  return {parsed,effectiveUrl,warning};
}
export async function collect() {
  const config=await loadConfig(process.env.RADAR_CONFIG||'config.json');
  const sources=makeSources(config);
  const now=new Date();
  const cutoff=now.getTime()-config.historyDays*86400000;
  const state=stateDirectory(),build=buildDirectory();
  const previous=await readJson(`${state}/history.json`,{articles:[]});
  const enrichment=await readJson(`${state}/enrichment-v2.json`,{});
  const articles=new Map(previous.articles.map(item=>[item.id,item]));
  const results=[];
  const statuses=[];
  // Blogs are independent. Serialize arXiv requests with a delay to respect its API.
  const tasks=sources.map((source,index)=>async()=> {
    try {
      const result=await paginateSource(source,cutoff,fetchSourceOnce);
      let enriched=0,enrichmentFailed=0;
      const descriptions=new Map();
      let enrichmentPending=0;
      if(source.enrichMissing){
        const recent=result.parsed.items.filter(item=>Date.parse(item.published||item.isoDate||item.pubDate)>=cutoff&&!item.summary&&!item.content&&!item.description);
        const keywords=config.topics.filter(t=>t.enabled).flatMap(t=>[...t.directPhrases,...t.relatedPhrases,...t.contextTerms]).map(normalize);
        // Apply cached bodies to every item, and spend the budget only on unseen
        // bodies. Otherwise the same top N items permanently starve the rest.
        for(const item of recent)if(enrichment[item.link]){descriptions.set(item.link,enrichment[item.link]);enriched++;}
        const plan=enrichmentPlan(recent,enrichment,keywords,source.enrichLimit||40);
        const candidates=plan.candidates;enrichmentPending=plan.pending;
        let cursor=0;
        async function worker(){
          while(cursor<candidates.length){
            const item=candidates[cursor++];if(!item.link)continue;
            try {
              const cached=enrichment[item.link];
              if(cached){descriptions.set(item.link,cached);enriched++;continue;}
              const html=await download(item.link);const $=load(html);
              const meta=$('meta[name="description"]').attr('content')||$('meta[property="og:description"]').attr('content')||'';
              // Read only the article body, avoiding shared navigation/footer text.
              const body=$('.blog-content').first().text()||$('main article').first().text();
              const text=plain(`${meta} ${body}`).slice(0,20000);
              enrichment[item.link]=text;descriptions.set(item.link,text);enriched++;
            }catch{enrichmentFailed++;}
          }
        }
        await Promise.allSettled(Array.from({length:4},worker));
      }
      let matched=0,dated=0,undated=0;
      const observed=[];
      for (const item of result.parsed.items) {
        const link=item.link || (typeof item.guid==='string'&&item.guid.startsWith('http')?item.guid:null);
        if(!link) continue;
        let url;
        try {url=new URL(link);if(!['https:','http:'].includes(url.protocol))continue;}catch{continue;}
        const rawDate=item.published||item.isoDate||item.pubDate;
        const timestamp=Date.parse(rawDate);
        if(!Number.isFinite(timestamp)){undated++;continue;}
        observed.push(timestamp);
        if(timestamp<cutoff||timestamp>now.getTime()+86400000)continue;
        dated++;
        const title=plain(item.title||'Untitled');
        const description=plain(descriptions.get(link)||item.summary||item['content:encoded']||item.content||item.description||'').slice(0,20000);
        const classification=rankTopics({title,description},config,rank);
        if(classification.tier!=='excluded')matched++;
        const id=canonicalId(link);
        const old=articles.get(id);
        const next={id,title,link,publishedOn:new Date(timestamp).toISOString(),updatedOn:item.updated||item.isoDate||null,
          description:description.slice(0,1200),rankingText:description,author:plain(item.creator||item.author||''),sourceId:source.id,sourceName:source.name,type:source.type,
          ...classification,firstSeen:old?.firstSeen||now.toISOString(),lastSeen:now.toISOString(),imageUrl:null,wordCount:null};
        // Prefer a direct classification, then keep latest version across duplicate sources.
        const existing=results.find(x=>x.id===id);
        if(!existing||next.score>existing.score||Date.parse(next.updatedOn)>Date.parse(existing.updatedOn)) {
          articles.set(id,next);if(existing)results.splice(results.indexOf(existing),1);results.push(next);
        }
      }
      statuses[index]={...source,status:result.warning||enrichmentFailed?'degraded':'ok',warning:result.warning||(enrichmentFailed?`${enrichmentFailed} article enrichment requests failed`:null),effectiveUrl:result.effectiveUrl,fetched:result.parsed.items.length,inWindow:dated,matched,undated,enriched,enrichmentFailed,enrichmentPending,totalAvailable:result.totalAvailable,pagesFetched:result.pagesFetched,coverageCapped:result.coverageCapped,
        earliest:observed.length?new Date(Math.min(...observed)).toISOString():null,latest:observed.length?new Date(Math.max(...observed)).toISOString():null};
      console.log(`${source.name}: ${result.parsed.items.length} fetched, ${matched} matches${result.warning?' [fallback]':''}`);
    }catch(error) {
      statuses[index]={...source,status:'failed',fetched:0,matched:0,error:error.message};
      console.error(`${source.name}: ${error.message}`);
    }
  });
  const blogTasks=tasks.filter((_,i)=>sources[i].type==='blog');
  const blogPromise=Promise.allSettled(blogTasks.map(task=>task()));
  for(let i=0;i<tasks.length;i++)if(sources[i].type==='paper'){await tasks[i]();await sleep(3500);}
  await blogPromise;
  if(statuses.every(x=>x.status==='failed'))throw new Error('All sources failed; previous successful output preserved.');
  const retained=[...articles.values()].filter(x=>Date.parse(x.publishedOn)>=cutoff&&sources.some(s=>s.id===x.sourceId));
  const catalog=retained.map(item=>({...item,...rankTopics({...item,description:item.rankingText||item.description},config,rank),fresh:!previous.articles.some(old=>old.id===item.id)}));
  const ranked=catalog
    .filter(item=>item.tier!=='excluded').sort((a,b)=>b.publishedOn.localeCompare(a.publishedOn)||b.score-a.score);
  const sourceResults=statuses.map(s=>({...s,retained:ranked.filter(x=>x.sourceId===s.id).length}));
  const data={siteTitle:config.siteTitle,topic:'研究雷达',topics:config.topics.filter(t=>t.enabled).map(t=>({id:t.id,name:t.name})),scheduleTimes:config.scheduleTimes,generatedAt:now.toISOString(),historyDays:config.historyDays,
    counts:{fetched:statuses.reduce((n,s)=>n+s.fetched,0),selected:ranked.length,direct:ranked.filter(x=>x.tier==='direct').length,
      related:ranked.filter(x=>x.tier==='related').length,blogs:ranked.filter(x=>x.type==='blog').length,new:ranked.filter(x=>x.fresh).length},
    coverageChecks:coverageChecks(ranked,config.coverageChecks,config.historyDays,now),
    sources:sourceResults,articles:ranked.map(({rankingText,...item})=>({...item,recipeSignals:recipeSignals({...item,rankingText})}))};
  await fs.mkdir(state,{recursive:true});await fs.mkdir(build,{recursive:true});
  await fs.writeFile(`${state}/history.json`,JSON.stringify({articles:catalog},null,2));
  await fs.writeFile(`${state}/enrichment-v2.json`,JSON.stringify(enrichment));
  await fs.writeFile(`${build}/radar.json`,JSON.stringify(data,null,2));
  return data;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  collect().then(data=>console.log(JSON.stringify(data.counts))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
