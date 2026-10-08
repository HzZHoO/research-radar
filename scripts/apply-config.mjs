import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {validateConfig,loadConfig} from './config.mjs';
export async function applyConfig(){
  const input=process.env.RADAR_CONFIG_JSON?.trim();
  const config=input?validateConfig(JSON.parse(input)):await loadConfig();
  await fs.writeFile('config.json',JSON.stringify(config,null,2)+'\n');
  console.log(`Applied ${config.topics.filter(t=>t.enabled).length} topics; Beijing updates: ${config.scheduleTimes.join(', ')}`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  applyConfig().catch(error=>{console.error(error.message);process.exitCode=1;});
}
