import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {registry,profile} from './profiles.mjs';
const all=await registry(),selected=await profile();
const publicDir=path.resolve('public');
if(path.dirname(publicDir)!==process.cwd())throw Error('Unexpected build path');
await fs.mkdir('.site',{recursive:true});
for(const radar of all.radars){
  const target=path.join('.site',radar.path);
  const exists=await fs.access(path.join(target,'radar.json')).then(()=>true,()=>false);
  if(radar.id!==selected.id&&exists)continue;
  // Separate collectors/caches; a targeted update leaves the other output intact.
  await fs.rm(publicDir,{recursive:true,force:true});
  const state=radar.id==='rsi'?'.state':`.state/${radar.id}`;
  const env={...process.env,RADAR_PROFILE:radar.id,RADAR_CONFIG:radar.config,RADAR_STATE:state,RADAR_BUILD:`.build/${radar.id}`};
  const args=['scripts/build.mjs'];
  if(process.argv.includes('--offline'))args.push('--offline');
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
await fs.rm(publicDir,{recursive:true,force:true});
await fs.cp('.site',publicDir,{recursive:true});
console.log(`Combined site ready; updated ${selected.name}.`);
