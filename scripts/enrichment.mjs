import {normalize} from './rank.mjs';
export function enrichmentPlan(items,cache,keywords,limit){
  const unseen=items.filter(item=>item.link&&!cache[item.link]);
  const normalized=keywords.map(normalize);
  const priority=unseen.filter(item=>normalized.some(k=>normalize(item.title).includes(k)));
  // Reserve fresh non-obvious titles first, then topic matches, then backfill.
  const ordered=[...new Map([...unseen.slice(0,20),...priority,...unseen].map(item=>[item.link,item])).values()];
  return {candidates:ordered.slice(0,limit),pending:Math.max(0,ordered.length-limit)};
}
