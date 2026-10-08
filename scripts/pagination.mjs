export async function paginateSource(source,cutoff,fetchSourceOnce,pause=ms=>new Promise(r=>setTimeout(r,ms))){
  const result=await fetchSourceOnce(source);
  const arxiv=source.id.startsWith('arxiv-'),crossref=source.format==='crossref';
  result.pagesFetched=1;result.coverageCapped=false;
  if((!arxiv&&!crossref)||result.warning)return result;
  const url=new URL(source.url);
  const pageSize=Number(url.searchParams.get(arxiv?'max_results':'rows')||100);
  const maxPages=source.maxPages||3;
  let page=result.parsed.items;
  for(let number=1;number<=maxPages;number++){
    const oldest=Math.min(...page.map(item=>Date.parse(item.published||item.isoDate||item.pubDate)).filter(Number.isFinite));
    const totalReached=crossref&&result.totalAvailable!==undefined&&result.parsed.items.length>=result.totalAvailable;
    if(page.length<pageSize||oldest<cutoff||totalReached)return result;
    if(number===maxPages){result.coverageCapped=true;return result;}
    url.searchParams.set(arxiv?'start':'offset',String(number*pageSize));
    await pause(3500);
    try{
      const next=await fetchSourceOnce({...source,url:url.href,fallbackUrl:undefined});
      page=next.parsed.items;result.parsed.items.push(...page);result.pagesFetched++;
    }catch(error){result.warning=`Pagination stopped (${error.message}); partial results retained.`;result.coverageCapped=true;return result;}
  }
  return result;
}
