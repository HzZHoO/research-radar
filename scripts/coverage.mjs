import {canonicalId} from './rank.mjs';
export function coverageChecks(articles,checks=[],historyDays,now=new Date()){
  return checks.map(check=>{
    const article=articles.find(a=>a.id===canonicalId(check.url));
    const expired=Date.parse(check.publishedOn)<now.getTime()-historyDays*86400000;
    return {...check,status:article?'found':expired?'outside-history':'missing',articleId:article?.id};
  });
}
