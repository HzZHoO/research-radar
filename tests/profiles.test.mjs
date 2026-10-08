import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {JSDOM} from 'jsdom';
import {profile,registry} from '../scripts/profiles.mjs';
import {validateConfig,rankTopics} from '../scripts/config.mjs';
import {rank} from '../scripts/rank.mjs';
import {recipeSignals} from '../scripts/recipe.mjs';
import {applyConfig} from '../scripts/apply-config.mjs';
const recipe=JSON.parse(fs.readFileSync('radars/post-train-recipe.json','utf8'));
test('each radar owns its config, URL and updater; unknown IDs fail',async()=>{
  const rsi=await profile('rsi'),post=await profile('post-train-recipe');
  assert.equal(rsi.config,'config.json');assert.equal(post.config,'radars/post-train-recipe.json');
  assert.notEqual(rsi.workflow,post.workflow);assert.notEqual(rsi.path,post.path);
  assert.equal((await registry()).radars.length,2);await assert.rejects(profile('../../other'));
  validateConfig(recipe);
});
test('recipe discovery covers implementation, data cleaning and thinking, excludes inference product news',()=>{
  for(const item of [
    {title:'A fully open post-training recipe',description:'We release training code and hyperparameters.'},
    {title:'Synthetic data curation and deduplication for LLM post-training',description:'Dataset filtering and data quality.'},
    {title:'Reasoning traces for cold-start training',description:'A reasoning dataset with chain of thought.'}
  ])assert.notEqual(rankTopics(item,recipe,rank).tier,'excluded');
  assert.equal(rankTopics({title:'New GPU offers faster inference',description:'Deploy your LLM with lower latency'},recipe,rank).tier,'excluded');
  assert.equal(rankTopics({title:'Reinforcement learning in robotics',description:'Robot motion control in simulation'},recipe,rank).tier,'excluded');
  assert.deepEqual(recipeSignals({title:'Open-source training recipe',description:'Dataset cleaning, learning rate and reasoning traces'}).map(s=>s.id),['code','params','data','thinking']);
});
test('applying a post-training envelope leaves RSI config byte-identical',async()=>{
  const originalCwd=process.cwd(),oldInput=process.env.RADAR_CONFIG_JSON,oldOutput=process.env.GITHUB_OUTPUT;
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'radar-profiles-'));
  fs.copyFileSync('radars.json',path.join(temp,'radars.json'));fs.copyFileSync('config.json',path.join(temp,'config.json'));fs.mkdirSync(path.join(temp,'radars'));
  fs.writeFileSync(path.join(temp,'radars/post-train-recipe.json'),JSON.stringify(recipe));
  const before=fs.readFileSync(path.join(temp,'config.json'),'utf8');
  try{
    process.chdir(temp);delete process.env.GITHUB_OUTPUT;
    const changed={...recipe,scheduleTimes:['08:15']};process.env.RADAR_CONFIG_JSON=JSON.stringify({radar:'post-train-recipe',config:changed});
    await applyConfig();assert.equal(fs.readFileSync('config.json','utf8'),before);
    assert.deepEqual(JSON.parse(fs.readFileSync('radars/post-train-recipe.json','utf8')).scheduleTimes,['08:15']);
    process.env.RADAR_CONFIG_JSON=JSON.stringify({radar:'../../x',config:changed});await assert.rejects(applyConfig());
  }finally{
    process.chdir(originalCwd);if(oldInput===undefined)delete process.env.RADAR_CONFIG_JSON;else process.env.RADAR_CONFIG_JSON=oldInput;
    if(oldOutput===undefined)delete process.env.GITHUB_OUTPUT;else process.env.GITHUB_OUTPUT=oldOutput;
    fs.rmSync(temp,{recursive:true,force:true});
  }
});
test('browser drafts are isolated by page and copied payload targets the current radar',async()=>{
  const script=fs.readFileSync('static/settings.js','utf8'),html=fs.readFileSync('static/settings.html','utf8');
  for(const id of ['rsi','post-train-recipe']){
    const prefix=id==='rsi'?'/research-radar/rsi/':'/research-radar/post-train-recipe/';
    const dom=new JSDOM(html,{url:`https://hzzhoo.github.io${prefix}settings.html`,runScripts:'outside-only'}),w=dom.window;
    const config=id==='rsi'?JSON.parse(fs.readFileSync('config.json','utf8')):recipe;
    w.fetch=async url=>({ok:true,json:async()=>url==='site.json'?{id,repository:'HzZHoO/research-radar'}:structuredClone(config)});w.structuredClone=structuredClone;
    let copied;Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async value=>{copied=JSON.parse(value);}}});
    w.localStorage.setItem('research-radar-draft-v2:/other/',JSON.stringify({...config,siteTitle:'Wrong radar draft'}));
    w.eval(script);await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(w.document.querySelector('#site-title').value,config.siteTitle);
    w.document.querySelector('#schedule').value='08:15';w.document.querySelector('#schedule').dispatchEvent(new w.Event('input',{bubbles:true}));
    assert.ok(w.localStorage.getItem(`research-radar-draft-v2:${prefix}`));
    w.document.querySelector('#apply').click();await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(copied.radar,id);assert.deepEqual(copied.config.scheduleTimes,['08:15']);dom.window.close();
  }
});
