export function crossrefItems(payload){
  const works=payload.message?.items||(payload.message?.DOI?[payload.message]:[]);
  return works.map(work=>{
    const parts=(work.published||work['published-online']||work.issued)?.['date-parts']?.[0];
    const date=parts?`${parts[0]}-${String(parts[1]||1).padStart(2,'0')}-${String(parts[2]||1).padStart(2,'0')}T00:00:00Z`:null;
    const preprint=work.DOI?.match(/^10\.20944\/preprints(\d{6}\.\d+)\.v(\d+)$/i);
    return {title:work.title?.join(' ')||'',link:preprint?`https://www.preprints.org/manuscript/${preprint[1]}/v${preprint[2]}`:work.URL||`https://doi.org/${work.DOI}`,published:date,updated:date,
      summary:work.abstract||'',author:(work.author||[]).map(a=>[a.given,a.family].filter(Boolean).join(' ')).join(', ')};
  });
}
