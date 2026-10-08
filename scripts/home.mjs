import fs from 'node:fs/promises';
import path from 'node:path';
import {loadConfig} from './config.mjs';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=value=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export async function buildHome(registry,directory){
  const cards=[];
  for(const radar of registry.radars){
    const config=await loadConfig(radar.config);
    const data=JSON.parse(await fs.readFile(path.join(directory,radar.path,'radar.json'),'utf8'));
    const href=radar.path+'/';
    const checks=data.coverageChecks||[];
    const missing=checks.filter(c=>c.status==='missing').length;
    cards.push(`<article class="radar-entry"><div class="eyebrow">${escape(radar.id.toUpperCase())}</div><h2><a href="${escape(href)}">${escape(radar.name)} <span aria-hidden="true">↗</span></a></h2><p class="radar-description">${escape(radar.description||config.siteTitle)}</p><div class="topic-tags">${config.topics.filter(t=>t.enabled).map(t=>`<span>${escape(t.name)}</span>`).join('')}</div><dl><div><dt>候选内容</dt><dd>${data.counts.selected}</dd></div><div><dt>博客与项目更新</dt><dd>${data.counts.blogs}</dd></div><div><dt>信源</dt><dd>${data.sources.length}</dd></div></dl><p class="radar-meta">每天 ${escape(config.scheduleTimes.join(' / '))} 更新 · 北京时间<br>最近抓取：${escape(date(data.generatedAt))}</p>${checks.length?`<p class="radar-meta ${missing?'attention':''}">覆盖检查：${checks.filter(c=>c.status==='found').length} / ${checks.length} 已收集${missing?` · ${missing} 条待检查`:''}</p>`:''}<nav class="radar-actions"><a class="enter" href="${escape(href)}">进入雷达 →</a><a href="${escape(href)}settings.html">配置此雷达</a></nav></article>`);
  }
  const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Research Radar · 研究雷达</title><link rel="stylesheet" href="radar.css"><link rel="stylesheet" href="home.css"></head><body><main><header><div class="eyebrow">RESEARCH RADAR</div><h1>研究雷达<span class="dot">.</span></h1><p class="intro">选择你关注的研究方向，进入对应的阅读队列。每个雷达独立配置关键词、信源和更新时间。</p><div class="home-heading"><span>${registry.radars.length} 个研究雷达</span><a href="https://github.com/${escape(registry.repository)}" target="_blank" rel="noopener noreferrer">GitHub 仓库 ↗</a></div></header><section class="radar-grid" aria-label="研究雷达列表">${cards.join('')}</section><footer>无模型、无 API 密钥 · 论文、技术博客与开源项目更新</footer></main></body></html>`;
  await fs.writeFile(path.join(directory,'index.html'),html);
  for(const file of ['radar.css','home.css'])await fs.copyFile(path.join('static',file),path.join(directory,file));
  await fs.writeFile(path.join(directory,'.nojekyll'),'');
}
