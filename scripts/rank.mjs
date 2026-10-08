export function normalize(text) {
  return String(text ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[‐‑–—−_-]/g, ' ').replace(/\s+/g, ' ').trim();
}
function contains(text, phrase) {
  const p = normalize(phrase).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${p}(?:s)?(?:$|[^a-z0-9])`, 'u').test(text);
}
export function rank(item, config) {
  const title = normalize(item.title);
  const text = normalize(`${item.title} ${item.description}`);
  const exclusions = config.excludePhrases.filter(p => contains(text, p));
  if (exclusions.length) return {tier:'excluded', score:0, matches:exclusions};
  const direct = config.directPhrases.filter(p => contains(text, p));
  const related = config.relatedPhrases.filter(p => contains(text, p));
  const context = !config.contextTerms.length || config.contextTerms.some(p => contains(text, p));
  const directScore = direct.reduce((n, p) => n + (contains(title, p) ? 12 : 8), 0);
  const relatedScore = related.reduce((n, p) => n + (contains(title, p) ? 5 : 3), 0);
  const score = directScore + relatedScore + (context ? 2 : 0);
  const tier = direct.length ? 'direct' : related.length && context && score >= config.relatedMinScore ? 'related' : 'excluded';
  return {tier, score, matches:[...direct, ...related]};
}
export function canonicalId(link) {
  const u = new URL(link);
  const arxiv = u.hostname.endsWith('arxiv.org') && u.pathname.match(/\/(?:abs|pdf|html)\/(\d{4}\.\d{4,5}|[a-z.-]+\/\d{7})(?:v\d+)?/i);
  if (arxiv) return `arxiv:${arxiv[1]}`;
  const preprint=(u.hostname==='www.preprints.org'||u.hostname==='preprints.org')&&u.pathname.match(/\/manuscript\/(\d{6}\.\d+)/i);
  const preprintDoi=u.hostname==='doi.org'&&u.pathname.match(/^\/10\.20944\/preprints(\d{6}\.\d+)\.v\d+/i);
  if(preprint||preprintDoi)return `preprints:${(preprint||preprintDoi)[1]}`;
  u.hash = ''; u.search = ''; u.pathname = u.pathname.replace(/\/$/, '');
  return u.href;
}
