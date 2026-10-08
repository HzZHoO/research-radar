import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {rank,canonicalId} from '../scripts/rank.mjs';
const config=JSON.parse(fs.readFileSync('topics.json','utf8'));
test('RSI surveys and Unicode hyphens are directly relevant',()=> {
  for(const title of ['The Last AI Built by Humans: Toward Genuine Recursive Self-Improvement','Recursive Self‑Improvement in AI: A Survey'])assert.equal(rank({title,description:''},config).tier,'direct');
});
test('NVIDIA product news and RSI stock indicator are not RSI research',()=> {
  for(const title of ['New NVIDIA GPU achieves faster inference','Trading with RSI: Relative Strength Index','Personal self-improvement habits'])assert.equal(rank({title,description:''},config).tier,'excluded');
});
test('blog harness engineering is related, not direct evidence of RSI',()=> {
  assert.equal(rank({title:'Harness Engineering for Self-Improvement',description:'Building LLM agents'},config).tier,'related');
});
test('versioned arxiv URLs deduplicate across abs/pdf/html',()=> {
  const links=['https://arxiv.org/abs/2609.11873v3','http://arxiv.org/pdf/2609.11873v2.pdf','https://arxiv.org/html/2609.11873v1'];
  assert.equal(new Set(links.map(canonicalId)).size,1);
});
