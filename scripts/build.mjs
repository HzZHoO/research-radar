import fs from 'node:fs/promises';
import http from 'node:http';
import { spawn } from 'node:child_process';
import yaml from 'js-yaml';
import { collect,readJson } from './collect.mjs';
import { loadConfig } from './config.mjs';
import {profile,registry,buildDirectory} from './profiles.mjs';

const escapeXml=s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
const data=process.argv.includes('--offline')?await readJson(`${buildDirectory()}/radar.json`):await collect();
const selected=await profile();const all=await registry();
const config=yaml.load(await fs.readFile('osmosfeed.yaml','utf8'));
const radarConfig=await loadConfig(process.env.RADAR_CONFIG||'config.json');
// Feed collection and ranking happen above. osmosfeed renders its supported local
// enriched cache; empty local feeds avoid re-fetching every external article.
const server=http.createServer((req,res)=> {
  const id=req.url?.split('/').pop();const source=data.sources.find(s=>s.id===id);
  if(!source){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':'application/rss+xml'});
  res.end(`<?xml version="1.0"?><rss version="2.0"><channel><title>${escapeXml(source.name)}</title><link>${escapeXml(source.url)}</link><description>Filtered RSI source</description></channel></rss>`);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const generatedSources=data.sources.map(s=>({title:s.name,feedUrl:`${base}/feed/${s.id}`,siteUrl:s.url,
  articles:data.articles.filter(a=>a.sourceId===s.id).map(a=>({...a,isDirect:a.tier==='direct'}))}));
await fs.mkdir('public',{recursive:true});await fs.mkdir('.build',{recursive:true});
await fs.writeFile('public/cache.json',JSON.stringify({cliVersion:'1.15.1',sources:generatedSources}));
const original=await fs.readFile('osmosfeed.yaml','utf8');
try {
    await fs.writeFile('osmosfeed.yaml',yaml.dump({...config,siteTitle:radarConfig.siteTitle,timezone:radarConfig.timezone,cacheMaxDays:data.historyDays,sources:generatedSources.map(s=>({href:s.feedUrl})),cacheUrl:null}));
  const exitCode=await new Promise((resolve,reject)=> {
    const child=spawn(process.execPath,['node_modules/@osmoscraft/osmosfeed/main.js'],{stdio:'inherit'});
    child.on('error',reject);child.on('exit',resolve);
  });
  if(exitCode!==0)throw new Error(`osmosfeed exited ${exitCode}`);
  await fs.writeFile('public/radar.json',JSON.stringify(data,null,2));
  await fs.writeFile('public/config.json',JSON.stringify(radarConfig,null,2));
  await fs.writeFile('public/site.json',JSON.stringify({...selected,radars:all.radars.map(r=>({id:r.id,name:r.name,href:(selected.path?'../':'./')+(r.path?r.path+'/':'' )}))},null,2));
  await fs.writeFile('public/.nojekyll','');
  const report=['# 研究雷达抓取报告',`\n方向：${data.topics?.map(t=>t.name).join('、')||data.topic}；生成时间：${data.generatedAt}；回溯：${data.historyDays} 天。\n`,
    '| 来源 | 状态 | 抓取数 | 本次命中 | 保留数 |','|---|---|---:|---:|---:|',
    ...data.sources.map(s=>`| ${s.name} | ${s.status}${s.error?': '+s.error:''} | ${s.fetched} | ${s.matched} | ${s.retained} |`),
    `\n直接相关 ${data.counts.direct} 篇；相关方法 ${data.counts.related} 篇；其中博客 ${data.counts.blogs} 篇。\n`,
    '## 已知文章覆盖检查',...(data.coverageChecks||[]).map(c=>`- ${c.status==='found'?'已收集':c.status==='outside-history'?'超出历史范围':'遗漏'}：[${c.title}](${c.url})`),
    '\n## 覆盖限制',...data.sources.filter(s=>s.coverageCapped||s.enrichmentPending).map(s=>`- ${s.name}：${s.coverageCapped?'达到检索条数上限。':''}${s.enrichmentPending?` ${s.enrichmentPending} 篇正文待后续补抓。`:''}`),
    ...data.articles.slice(0,15).map(a=>`- [${a.title}](${a.link}) — ${a.publishedOn.slice(0,10)} / ${a.tier} / 命中：${a.matches.join(', ')}`),
    '\n博客仅覆盖 RSS 保留的文章；没有命中不意味着该网站没有相关历史文章。分数表示词语相关性，不表示论文质量。'];
  await fs.writeFile('public/report.md',report.join('\n'));
  console.log('Built public/index.html, radar.json, feed.atom and report.md');
}finally {
  await fs.writeFile('osmosfeed.yaml',original);
  await new Promise(resolve=>server.close(resolve));
}
