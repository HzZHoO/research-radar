import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const git=async(args,env)=> (await exec('git',args,{env:env||process.env,maxBuffer:4000000,windowsHide:true})).stdout.trim();
const branch='radar-published';
const existing=await git(['ls-remote','--heads','origin',branch]);
await fs.mkdir('.build',{recursive:true});await fs.mkdir('.site',{recursive:true});
if(process.argv.includes('restore')){
  if(existing){
    await git(['fetch','origin',`${branch}:refs/remotes/origin/${branch}`]);
    await git(['archive',`origin/${branch}`,'--format=tar',`--output=${path.resolve('.build/published.tar')}`]);
    await exec('tar',['-xf',path.resolve('.build/published.tar'),'-C',path.resolve('.site')],{windowsHide:true});
  }
}else if(process.argv.includes('save')){
  const env={...process.env,GIT_INDEX_FILE:path.resolve('.build/publish-index')};
  await git(['read-tree','--empty'],env);
  await git([`--work-tree=${path.resolve('.site')}`,'add','--all'],env);
  const tree=await git(['write-tree'],env);
  let parent;
  if(existing){await git(['fetch','origin',`${branch}:refs/remotes/origin/${branch}`]);parent=await git(['rev-parse',`origin/${branch}`]);}
  if(parent&&tree===await git(['rev-parse',`${parent}^{tree}`])){console.log('Published snapshot unchanged');}
  else{
    const commit=await git(['commit-tree',tree,...(parent?['-p',parent]:[]),'-m',`Update ${process.env.RADAR_PROFILE||'rsi'} radar snapshot`]);
    await git(['push','origin',`${commit}:refs/heads/${branch}`]);
    console.log('Saved combined site snapshot');
  }
}else throw Error('Use restore or save');
