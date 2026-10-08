import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {JSDOM} from 'jsdom';
import {buildHome} from '../scripts/home.mjs';
import {registry} from '../scripts/profiles.mjs';
test('home lists every registered radar with correct reading/settings URLs and escaped text',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'radar-home-'));
  try{
    const all=await registry();all.radars.push({id:'memory',name:'Memory <script>',description:'<img src=x onerror=alert(1)>',path:'memory',config:'config.json'});
    for(const radar of all.radars){await fs.mkdir(path.join(dir,radar.path));await fs.writeFile(path.join(dir,radar.path,'radar.json'),JSON.stringify({counts:{selected:12,blogs:3},sources:[{}],generatedAt:'2026-10-08T08:00:00Z',coverageChecks:[]}));}
    await buildHome(all,dir);
    const dom=new JSDOM(await fs.readFile(path.join(dir,'index.html'),'utf8'),{url:'https://hzzhoo.github.io/research-radar/'});
    assert.equal(dom.window.document.querySelectorAll('.radar-entry').length,3);
    assert.equal(dom.window.document.querySelectorAll('script,img').length,0);
    for(const [index,radar]of all.radars.entries()){
      const card=dom.window.document.querySelectorAll('.radar-entry')[index];
      assert.equal(card.querySelector('.enter').href,`https://hzzhoo.github.io/research-radar/${radar.path}/`);
      assert.equal(card.querySelector('.radar-actions a:last-child').href,`https://hzzhoo.github.io/research-radar/${radar.path}/settings.html`);
    }
    assert.match(dom.window.document.title,/Research Radar/);dom.window.close();
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('each reader links back to the radar list and to the sibling radar',async()=>{
  const all=await registry();
  for(const radar of all.radars){
    const dom=new JSDOM('<nav data-radar-nav></nav>',{url:`https://hzzhoo.github.io/research-radar/${radar.path}/`,runScripts:'outside-only'});
    dom.window.fetch=async()=>({ok:true,json:async()=>({...radar,repository:all.repository,radars:all.radars.map(r=>({id:r.id,name:r.name,href:'../'+r.path+'/'}))})});
    dom.window.eval(await fs.readFile('static/site.js','utf8'));await new Promise(r=>setTimeout(r,0));
    assert.equal(dom.window.document.querySelector('nav a').href,'https://hzzhoo.github.io/research-radar/');
    assert.equal(dom.window.document.querySelectorAll('nav a').length,3);dom.window.close();
  }
});
