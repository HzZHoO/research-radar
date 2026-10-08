import test from 'node:test';
import assert from 'node:assert/strict';
import {paginateSource} from '../scripts/pagination.mjs';
const source={id:'arxiv-topic-direct',url:'https://export.arxiv.org/api/query?max_results=2&start=0',maxPages:3};
const page=dates=>({parsed:{items:dates.map(published=>({published}))},effectiveUrl:source.url,warning:null});
test('pagination reaches later results then stops at the actual history boundary',async()=>{
  const offsets=[];const pages=[['2026-10-08','2026-10-07'],['2026-10-06','2026-09-01'],['2026-08-31','2026-08-30']];
  const result=await paginateSource(source,Date.parse('2026-09-10'),async s=>{const start=Number(new URL(s.url).searchParams.get('start'));offsets.push(start);return page(pages[start/2]);},async()=>{});
  assert.deepEqual(offsets,[0,2]);assert.equal(result.parsed.items.length,4);assert.equal(result.coverageCapped,false);
});
test('pagination distinguishes a real cap, partial network failure, and RSS fallback',async()=>{
  const capped=await paginateSource({...source,maxPages:2},0,async()=>page(['2026-10-08','2026-10-07']),async()=>{});
  assert.equal(capped.coverageCapped,true);assert.equal(capped.parsed.items.length,4);
  let calls=0;const partial=await paginateSource(source,0,async()=>{if(calls++)throw Error('network failure');return page(['2026-10-08','2026-10-07']);},async()=>{});
  assert.equal(partial.parsed.items.length,2);assert.match(partial.warning,/partial results retained/);assert.equal(partial.coverageCapped,true);
  calls=0;const fallback=await paginateSource(source,0,async()=>{calls++;return {...page(['2026-10-08','2026-10-07']),warning:'RSS fallback used'};},async()=>{});
  assert.equal(calls,1);assert.equal(fallback.pagesFetched,1);
});
