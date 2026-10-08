import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import Handlebars from 'handlebars';
import {load} from 'cheerio';
import {crossrefItems} from '../scripts/crossref.mjs';
import {canonicalId,rank} from '../scripts/rank.mjs';
import {rankTopics} from '../scripts/config.mjs';
import {coverageChecks} from '../scripts/coverage.mjs';
import {enrichmentPlan} from '../scripts/enrichment.mjs';
const rsi=JSON.parse(fs.readFileSync('config.json','utf8')),post=JSON.parse(fs.readFileSync('radars/post-train-recipe.json','utf8'));
const preprint=crossrefItems(JSON.parse(fs.readFileSync('tests/fixtures/preprints-survey.json','utf8')))[0];
const nemotron=JSON.parse(fs.readFileSync('tests/fixtures/nemotron.json','utf8'));
const last={title:'The Last AI Built by Humans: Toward Genuine Recursive Self-Improvement',link:'https://arxiv.org/abs/2609.11873v3',publishedOn:'2026-09-10T17:44:23Z',description:'Recursive self-improvement enables persistent changes to AI systems.'};
test('Crossref discovers the non-arXiv survey with real metadata, correct date and canonical version dedup',()=>{
  assert.equal(preprint.title,'Recursive Self-Improvement in AI: A Survey');assert.equal(preprint.published,'2026-09-30T00:00:00Z');
  assert.equal(rankTopics({title:preprint.title,description:load(preprint.summary).text()},rsi,rank).tier,'direct');
  for(const link of [preprint.link,'https://www.preprints.org/manuscript/202609.2680','https://doi.org/10.20944/preprints202609.2680.v2'])assert.equal(canonicalId(link),'preprints:202609.2680');
});
test('all three known references have meaningful discovery classifications and coverage diagnostics',()=>{
  const articles=[last,{...preprint,publishedOn:preprint.published},nemotron].map(a=>({...a,id:canonicalId(a.link)}));
  assert.equal(rankTopics(last,rsi,rank).tier,'direct');assert.equal(rankTopics(nemotron,post,rank).tier,'direct');
  const checks=[...rsi.coverageChecks,...post.coverageChecks];const now=new Date('2026-10-08T08:00:00Z');
  assert.ok(coverageChecks(articles,checks,120,now).every(c=>c.status==='found'));
  assert.equal(coverageChecks([],rsi.coverageChecks,120,now)[0].status,'missing');
  assert.equal(coverageChecks([],rsi.coverageChecks,7,now)[0].status,'outside-history');
});
test('all three references are findable by URL/title across the date window, with an explicit hidden-filter reset',async()=>{
  const articles=[last,{...preprint,publishedOn:preprint.published,description:load(preprint.summary).text()},nemotron].map(a=>({...a,id:canonicalId(a.link),type:a===nemotron?'blog':'paper',sourceId:'source',tier:'direct',score:12,isDirect:true,topicIds:['rsi'],topicNames:['RSI'],matches:['recursive self improvement']}));
  const html=Handlebars.compile(fs.readFileSync('includes/index.hbs','utf8'))({articles,siteTitle:'Coverage test'});
  const dom=new JSDOM(html,{url:'https://example.org/?search='+encodeURIComponent(last.link),runScripts:'outside-only'});const w=dom.window;
  w.eval("Date.now=()=>Date.parse('2026-10-08T08:00:00Z')");
  w.fetch=async()=>({ok:true,json:async()=>({articles,topics:[{id:'rsi',name:'RSI'}],sources:[{id:'source',name:'Source',status:'ok'}],counts:{},generatedAt:'2026-10-08T08:00:00Z',historyDays:120,coverageChecks:coverageChecks(articles,[...rsi.coverageChecks,...post.coverageChecks],120,new Date('2026-10-08T08:00:00Z'))})});
  w.eval(fs.readFileSync('static/radar.js','utf8'));await new Promise(r=>setTimeout(r,0));
  const search=w.document.querySelector('#search'),days=w.document.querySelector('#days');
  assert.equal(days.value,'30');days.value='7';
  for(const query of [last.title,preprint.title,nemotron.link,nemotron.link+'?utm_source=test']){
    search.value=query;search.dispatchEvent(new w.Event('input'));assert.equal([...w.document.querySelectorAll('.card')].filter(c=>!c.hidden).length,1);
    assert.match(w.document.querySelector('#filter-status').textContent,/忽略时间窗口/);
  }
  w.document.querySelector('#type').value='paper';search.dispatchEvent(new w.Event('input'));assert.match(w.document.querySelector('#empty').textContent,/其他筛选隐藏/);
  w.document.querySelector('#reset-filters').click();assert.equal([...w.document.querySelectorAll('.card')].filter(c=>!c.hidden).length,1);
  assert.equal(w.document.querySelectorAll('#coverage a').length,3);dom.window.close();
});
test('body enrichment advances beyond its old cap and gives new opaque titles a chance',()=>{
  const items=Array.from({length:100},(_,i)=>({title:`Opaque result ${i}`,link:`https://example.org/${i}`}));const cache={};
  for(let run=0;run<3;run++){const plan=enrichmentPlan(items,cache,['recipe'],40);for(const item of plan.candidates)cache[item.link]='body';}
  assert.equal(Object.keys(cache).length,100);assert.equal(enrichmentPlan(items,cache,['recipe'],40).pending,0);
  const fresh={title:'Two Gold-Level Results',link:'https://example.org/new'};
  assert.ok(enrichmentPlan([fresh,...items],cache,['recipe'],40).candidates.includes(fresh));
});
