import fs from 'node:fs/promises';
export async function registry(){
  const value=JSON.parse(await fs.readFile('radars.json','utf8'));
  const ids=new Set(),paths=new Set();
  for(const r of value.radars){
    if(!/^[a-z0-9-]+$/.test(r.id)||ids.has(r.id)||paths.has(r.path)||!/^([a-z0-9-]+)$/.test(r.path)||!/^([a-z0-9-]+\/)?[a-z0-9-]+\.json$/.test(r.config)||!/^update-[a-z0-9-]+\.yaml$/.test(r.workflow))throw Error('Invalid radar registry');
    ids.add(r.id);paths.add(r.path);
  }
  return value;
}
export async function profile(id=process.env.RADAR_PROFILE||'rsi'){
  const data=await registry();const selected=data.radars.find(r=>r.id===id);
  if(!selected)throw Error(`Unknown radar: ${id}`);
  return {...selected,repository:data.repository};
}
export const stateDirectory=()=>process.env.RADAR_STATE||'.state';
export const buildDirectory=()=>process.env.RADAR_BUILD||'.build';
