import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {validateConfig,loadConfig} from './config.mjs';
import {profile} from './profiles.mjs';
export async function applyConfig(){
  const input=process.env.RADAR_CONFIG_JSON?.trim();
  const parsed=input?JSON.parse(input):null;
  const selected=await profile(parsed?.radar||process.env.RADAR_PROFILE||'rsi');
  const config=parsed?validateConfig(parsed.config||parsed):await loadConfig(selected.config);
  await fs.writeFile(selected.config,JSON.stringify(config,null,2)+'\n');
  if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,`workflow=${selected.workflow}\nconfig=${selected.config}\n`);
  console.log(`Applied ${config.topics.filter(t=>t.enabled).length} topics; Beijing updates: ${config.scheduleTimes.join(', ')}`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  applyConfig().catch(error=>{console.error(error.message);process.exitCode=1;});
}
