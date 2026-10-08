(() => {
  fetch('site.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('无法读取雷达导航');return r.json();}).then(site=>{
    for(const nav of document.querySelectorAll('[data-radar-nav]')){
      const home=document.createElement('a');home.textContent='← 全部雷达';home.href='../';nav.append(home);
      for(const r of site.radars){const a=document.createElement('a');a.textContent=r.name;a.href=r.href;a.className='settings-link';if(r.id===site.id)a.setAttribute('aria-current','page');nav.append(a);}
    }
    const source=document.querySelector('[data-source-link]');if(source)source.href=`https://github.com/${site.repository}`;
    const status=document.querySelector('[data-apply-link]');if(status)status.href=`https://github.com/${site.repository}/actions/workflows/apply-config.yaml`;
    const edit=document.querySelector('[data-config-link]');if(edit)edit.href=`https://github.com/${site.repository}/edit/main/${site.config}`;
    const name=document.querySelector('#radar-name');if(name)name.textContent=`当前雷达：${site.name}。这里的设置只影响此雷达。`;
    const recipe=document.querySelector('#recipe-controls');if(recipe)recipe.hidden=site.id!=='post-train-recipe';
    const resources=document.querySelector('#recipe-starters');if(resources)resources.hidden=site.id!=='post-train-recipe';
  }).catch(error=>console.error(error.message));
})();
