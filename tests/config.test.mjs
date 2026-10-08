import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateConfig,makeSources,rankTopics,isScheduledDue} from '../scripts/config.mjs';
import {rank} from '../scripts/rank.mjs';
const original=JSON.parse(fs.readFileSync('config.json','utf8'));
const memory={id:'memory',name:'Agent 记忆',enabled:true,directPhrases:['agent memory'],relatedPhrases:['episodic memory'],contextTerms:['agent'],excludePhrases:[],relatedMinScore:5};
test('two topics classify independently and share an article without duplication',()=>{
  const config=structuredClone(original);config.topics.push(memory);
  assert.deepEqual(rankTopics({title:'Agent Memory Consolidation',description:''},config,rank).topicIds,['memory']);
  assert.deepEqual(rankTopics({title:'Recursive Self-Improvement through Agent Memory',description:''},config,rank).topicIds,['rsi','memory']);
});
test('arXiv searches are generated from every enabled topic and selected categories',()=>{
  const config=structuredClone(original);config.topics.push(memory);config.arxiv.categories=['cs.AI'];
  const sources=makeSources(config);assert.equal(sources.filter(s=>s.id.startsWith('arxiv-')).length,4);
  assert.match(decodeURIComponent(sources.find(s=>s.id==='arxiv-memory-direct').url),/agent\+memory/);
  assert.match(decodeURIComponent(sources[0].url),/cat:cs.AI/);
  config.topics[0].enabled=false;assert.ok(makeSources(config).every(s=>!s.id.startsWith('arxiv-rsi-')));
});
test('disabled feeds and arXiv are omitted from actual fetching',()=>{
  const config=structuredClone(original);config.arxiv.enabled=false;config.sources[0].enabled=false;
  assert.equal(makeSources(config).length,config.sources.length-1);
});
test('changing configured Beijing times changes actual collection windows',()=>{
  const config={...original,scheduleTimes:['09:23','17:30']};
  assert.equal(isScheduledDue(config,new Date('2026-10-08T01:30:00Z')),true);
  assert.equal(isScheduledDue(config,new Date('2026-10-08T01:15:00Z')),false);
  assert.equal(isScheduledDue({...config,scheduleTimes:['10:23']},new Date('2026-10-08T01:30:00Z')),false);
  assert.equal(isScheduledDue({...config,scheduleTimes:['23:59']},new Date('2026-10-08T16:00:00Z')),true);
});
test('invalid settings cannot alter configuration or run schedules',()=>{
  for(const mutation of [c=>c.scheduleTimes=['24:00'],c=>c.historyDays=-2,c=>c.sources[0].url='http://127.0.0.1/private',c=>c.topics[0].id='../../x',c=>c.topics.forEach(t=>t.enabled=false)]){
    const c=structuredClone(original);mutation(c);assert.throws(()=>validateConfig(c));
  }
  assert.equal(validateConfig(original),original);
});
