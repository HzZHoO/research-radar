import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {registry,profile} from './profiles.mjs';
import {buildHome} from './home.mjs';
const all=await registry(),selected=await profile();
const publicDir=path.resolve('public');
if(path.dirname(publicDir)!==process.cwd())throw Error('Unexpected build path');
await fs.mkdir('.site',{recursive:true});
// Move the former root RSI output into its dedicated page when restoring an old snapshot.
const legacyFiles=['index.html','radar.json','config.json','site.json','feed.atom','report.md','cache.json','radar.css','radar.js','settings.css','settings.html','settings.js','site.js','favicon.ico','.nojekyll'];
const rsi=all.radars.find(r=>r.id==='rsi');
if(rsi?.path&&await fs.access('.site/radar.json').then(()=>true,()=>false)){
  await fs.mkdir(path.join('.site',rsi.path),{recursive:true});
  for(const file of legacyFiles){
    const old=path.join('.site',file);
    if(await fs.access(old).then(()=>true,()=>false)){await fs.copyFile(old,path.join('.site',rsi.path,file));await fs.unlink(old);}
  }
}
for(const radar of all.radars){
  const target=path.join('.site',radar.path);
  const exists=await fs.access(path.join(target,'radar.json')).then(()=>true,()=>false);
  const manifest=await fs.readFile(path.join(target,'site.json'),'utf8').then(JSON.parse,()=>null);
  const needsMigration=manifest?.repository!==all.repository||manifest?.path!==radar.path;
  if(radar.id!==selected.id&&exists&&!needsMigration)continue;
  const cachedRebuild=radar.id!==selected.id&&exists;
  if(cachedRebuild){await fs.mkdir(`.build/${radar.id}`,{recursive:true});await fs.copyFile(path.join(target,'radar.json'),`.build/${radar.id}/radar.json`);}
  // Separate collectors/caches; a targeted update leaves the other output intact.
  await fs.rm(publicDir,{recursive:true,force:true});
  const state=radar.id==='rsi'?'.state':`.state/${radar.id}`;
  const env={...process.env,RADAR_PROFILE:radar.id,RADAR_CONFIG:radar.config,RADAR_STATE:state,RADAR_BUILD:`.build/${radar.id}`};
  const args=['scripts/build.mjs'];
  if(process.argv.includes('--offline')||cachedRebuild)args.push('--offline');
  await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,args,{env,stdio:'inherit'});
    child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(`Build failed for ${radar.id}`)));
  });
  await fs.mkdir(target,{recursive:true});await fs.cp(publicDir,target,{recursive:true});
}
// Refresh navigation for all pages even when adding a radar without recollecting others.
for(const radar of all.radars){
  await fs.writeFile(path.join('.site',radar.path,'site.json'),JSON.stringify({...radar,repository:all.repository,radars:all.radars.map(r=>({id:r.id,name:r.name,href:(radar.path?'../':'./')+(r.path?r.path+'/':'' )}))},null,2));
}
await buildHome(all,'.site');
await fs.rm(publicDir,{recursive:true,force:true});
await fs.cp('.site',publicDir,{recursive:true});
console.log(`Combined site ready; updated ${selected.name}.`);
