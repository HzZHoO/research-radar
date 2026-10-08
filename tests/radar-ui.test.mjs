import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import Handlebars from 'handlebars';
test('topic filtering shows that topic’s tier and score rather than the aggregate',async()=>{
  const article={id:'shared',title:'Shared paper',link:'https://example.org/paper',sourceId:'source',type:'paper',tier:'direct',isDirect:true,score:12,description:'Example',publishedOn:new Date().toISOString(),topicIds:['rsi','memory'],topicNames:['RSI','Memory'],matches:['self improvement','episodic memory'],classifications:[{id:'rsi',tier:'direct',score:12,matches:['self improvement']},{id:'memory',tier:'related',score:5,matches:['episodic memory']}]};
  const html=Handlebars.compile(fs.readFileSync('includes/index.hbs','utf8'))({articles:[article],siteTitle:'Research radar'});
  const dom=new JSDOM(html,{url:'https://example.org/',runScripts:'outside-only'});const w=dom.window;
  w.fetch=async()=>({ok:true,json:async()=>({articles:[article],topics:[{id:'rsi',name:'RSI'},{id:'memory',name:'Memory'}],sources:[],counts:{},generatedAt:new Date().toISOString(),historyDays:120,scheduleTimes:[]})});
  w.eval(fs.readFileSync('static/radar.js','utf8'));await new Promise(resolve=>setTimeout(resolve,0));
  const topic=w.document.querySelector('#topic');topic.value='memory';topic.dispatchEvent(new w.Event('input'));
  assert.equal(w.document.querySelector('.tier').textContent,'相关方法');assert.match(w.document.querySelector('.card details summary').textContent,/5 分/);
  assert.equal(w.document.querySelector('.matches').textContent,'episodic memory');
  topic.value='all';topic.dispatchEvent(new w.Event('input'));assert.equal(w.document.querySelector('.tier').textContent,'直接相关');
  dom.window.close();
});
