import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
test('persisted site snapshot restores both radars without modifying main or its index',async()=>{
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'radar-snapshot-'));
  const repo=path.join(temp,'repo'),remote=path.join(temp,'remote.git');
  await fs.mkdir(repo);const git=args=>exec('git',args,{cwd:repo,windowsHide:true});
  try{
    await exec('git',['init','--bare',remote],{windowsHide:true});await git(['init','-b','main']);
    await git(['config','user.name','Test']);await git(['config','user.email','test@example.org']);await git(['config','core.autocrlf','false']);
    await fs.writeFile(path.join(repo,'source.txt'),'source');await git(['add','source.txt']);await git(['commit','-m','Source']);await git(['remote','add','origin',remote]);
    const head=(await git(['rev-parse','HEAD'])).stdout;
    await fs.mkdir(path.join(repo,'scripts'));await fs.copyFile('scripts/published.mjs',path.join(repo,'scripts/published.mjs'));
    await fs.mkdir(path.join(repo,'.site/post-train-recipe'),{recursive:true});
    await fs.writeFile(path.join(repo,'.site/index.html'),'RSI');await fs.writeFile(path.join(repo,'.site/post-train-recipe/index.html'),'POST');
    const run=mode=>exec(process.execPath,['scripts/published.mjs',mode],{cwd:repo,windowsHide:true});
    await run('save');assert.equal((await git(['rev-parse','HEAD'])).stdout,head);
    assert.equal((await git(['diff','--cached','--name-only'])).stdout,'');
    await fs.rm(path.join(repo,'.site'),{recursive:true});await run('restore');
    assert.equal(await fs.readFile(path.join(repo,'.site/index.html'),'utf8'),'RSI');
    assert.equal(await fs.readFile(path.join(repo,'.site/post-train-recipe/index.html'),'utf8'),'POST');
    await fs.writeFile(path.join(repo,'.site/post-train-recipe/index.html'),'POST2');await run('save');
    await fs.rm(path.join(repo,'.site'),{recursive:true});await run('restore');
    assert.equal(await fs.readFile(path.join(repo,'.site/index.html'),'utf8'),'RSI');
    assert.equal(await fs.readFile(path.join(repo,'.site/post-train-recipe/index.html'),'utf8'),'POST2');
  }finally{await fs.rm(temp,{recursive:true,force:true});}
});
