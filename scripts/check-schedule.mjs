import fs from 'node:fs/promises';
import {loadConfig,isScheduledDue} from './config.mjs';
import {profile} from './profiles.mjs';
const selected=await profile();
const config=await loadConfig(selected.config);
const collect=process.env.GITHUB_EVENT_NAME!=='schedule'||isScheduledDue(config);
if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,`collect=${collect}\n`);
console.log(collect?'Collecting for configured research schedule':'No collection due in this 15-minute window');
