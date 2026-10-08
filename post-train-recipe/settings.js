(() => {
  const $=selector=>document.querySelector(selector);
  const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const split=value=>value.split(/[\n,，]/).map(s=>s.trim()).filter(Boolean);
  let current=null,site=null;
  const draftKey=`research-radar-draft-v2:${location.pathname.replace(/[^/]*$/, '')}`;
  const presets={
    rsi:{name:'Recursive Self-Improvement',directPhrases:['recursive self improvement','self improving agent','self evolving agent'],relatedPhrases:['self improvement','agent harness','automated ai research'],contextTerms:['agent','llm','language model'],excludePhrases:['relative strength index'],relatedMinScore:5},
    memory:{name:'Agent 记忆',directPhrases:['agent memory','long term memory','memory augmented agent','memory consolidation'],relatedPhrases:['episodic memory','experience replay','continual learning'],contextTerms:['agent','llm','language model'],excludePhrases:[],relatedMinScore:5},
    training:{name:'模型训练与后训练',directPhrases:['post training','language model training','pretraining','supervised fine tuning'],relatedPhrases:['reinforcement learning','preference optimization','distillation','synthetic data','training efficiency'],contextTerms:['llm','language model','training'],excludePhrases:[],relatedMinScore:5},
    reasoning:{name:'推理与强化学习',directPhrases:['reasoning model','reinforcement learning from verifiable rewards','rlvr','test time scaling'],relatedPhrases:['chain of thought','process reward','self play'],contextTerms:['llm','language model','reasoning'],excludePhrases:[],relatedMinScore:5},
    custom:{name:'新研究方向',directPhrases:[],relatedPhrases:[],contextTerms:[],excludePhrases:[],relatedMinScore:5}
  };
  function message(text,error=false){$('#message').textContent=text;$('#message').classList.toggle('error',error);}
  function field(parent,label,key,value,kind='textarea',hint=''){
    const wrapper=el('label',label);wrapper.className='field';const input=el(kind);input.dataset.key=key;input.value=Array.isArray(value)?value.join('\n'):value;
    if(kind==='input')input.type=key==='relatedMinScore'?'number':'text';
    wrapper.append(input);if(hint)wrapper.append(el('small',hint));parent.append(wrapper);return input;
  }
  function addTopic(topic){
    const card=el('section');card.className='editor-card topic-editor';card.dataset.id=topic.id;const header=el('div');header.className='editor-header';
    const toggle=el('label');toggle.className='toggle';const enabled=el('input');enabled.type='checkbox';enabled.dataset.key='enabled';enabled.checked=topic.enabled;toggle.append(enabled,el('span','启用'));header.append(toggle);
    const name=el('input');name.type='text';name.dataset.key='name';name.value=topic.name;name.required=true;name.setAttribute('aria-label','方向名称');header.append(name);
    const remove=el('button','移除');remove.type='button';remove.className='remove';remove.addEventListener('click',()=>{card.remove();saveDraft();});header.append(remove);card.append(header);
    const fields=el('div');fields.className='fields-grid';field(fields,'核心关键词','directPhrases',topic.directPhrases,'textarea','一行一个；命中后列为“直接相关”。');field(fields,'扩展阅读关键词','relatedPhrases',topic.relatedPhrases,'textarea','一行一个；用于发现相邻方法。');card.append(fields);
    const advanced=el('details');advanced.append(el('summary','排除词与匹配条件'));field(advanced,'排除关键词','excludePhrases',topic.excludePhrases);field(advanced,'扩展阅读必须包含的语境词','contextTerms',topic.contextTerms,'textarea','命中任意一个即可；留空则不额外限制。');field(advanced,'扩展阅读分数阈值','relatedMinScore',topic.relatedMinScore,'input');card.append(advanced);$('#topics').append(card);
  }
  function addSource(source){
    const card=el('section');card.className='editor-card source-editor';card.dataset.id=source.id;card.sourceOptions=source;
    const header=el('div');header.className='editor-header';const toggle=el('label');toggle.className='toggle';const enabled=el('input');enabled.type='checkbox';enabled.dataset.key='enabled';enabled.checked=source.enabled;toggle.append(enabled,el('span','启用'));header.append(toggle);
    const name=el('input');name.type='text';name.dataset.key='name';name.value=source.name;name.required=true;name.setAttribute('aria-label','信源名称');header.append(name);
    const remove=el('button','移除');remove.type='button';remove.className='remove';remove.addEventListener('click',()=>{card.remove();saveDraft();});header.append(remove);card.append(header);
    field(card,'订阅 / 检索地址','url',source.url,'input');const modeLabel=el('label','获取方式');modeLabel.className='field';const mode=el('select');mode.dataset.key='format';for(const [value,text]of [['rss','RSS / Atom'],['crossref','Crossref 论文元数据检索']]){const option=el('option',text);option.value=value;mode.append(option);}mode.value=source.format||'rss';modeLabel.append(mode);card.append(modeLabel);const label=el('label','内容形式');label.className='field';const type=el('select');type.dataset.key='type';for(const [value,text]of [['blog','博客／技术文章'],['paper','论文']]){const option=el('option',text);option.value=value;type.append(option);}type.value=source.type;label.append(type);card.append(label);$('#sources').append(card);
  }
  function readCard(card){const obj={id:card.dataset.id};for(const input of card.querySelectorAll('[data-key]')){const key=input.dataset.key;obj[key]=input.type==='checkbox'?input.checked:input.tagName==='TEXTAREA'?split(input.value):input.type==='number'?Number(input.value):input.value.trim();}return obj;}
  function addCheck(check){
    const card=el('section');card.className='editor-card coverage-editor';
    const title=field(card,'文章名称','title',check.title,'input');title.required=true;
    const url=field(card,'文章链接','url',check.url,'input');url.required=true;
    const date=field(card,'首次发布日期','publishedOn',check.publishedOn,'input');date.type='date';date.required=true;
    const remove=el('button','移除检查');remove.type='button';remove.addEventListener('click',()=>{card.remove();saveDraft();});card.append(remove);$('#coverage-checks').append(card);
  }
  function draft(){return {...current,siteTitle:$('#site-title').value.trim(),historyDays:Number($('#history-days').value),scheduleTimes:split($('#schedule').value),
    arxiv:{enabled:$('#arxiv-enabled').checked,categories:split($('#arxiv-categories').value),maxResults:Number($('#arxiv-max').value),maxPages:Number($('#arxiv-pages').value)},
    coverageChecks:[...document.querySelectorAll('.coverage-editor')].map(card=>{const {id,...check}=readCard(card);return check;}),
    topics:[...document.querySelectorAll('.topic-editor')].map(readCard),sources:[...document.querySelectorAll('.source-editor')].map(card=>({...card.sourceOptions,...readCard(card)}))};}
  function saveDraft(){if(!current)return;try{localStorage.setItem(draftKey,JSON.stringify(draft()));}catch{}}
  function render(config){
    $('#topics').replaceChildren();$('#sources').replaceChildren();config.topics.forEach(addTopic);config.sources.forEach(addSource);
    $('#coverage-checks').replaceChildren();(config.coverageChecks||[]).forEach(addCheck);
    $('#site-title').value=config.siteTitle;$('#history-days').value=config.historyDays;$('#schedule').value=config.scheduleTimes.join(', ');
    $('#arxiv-enabled').checked=config.arxiv.enabled;$('#arxiv-categories').value=config.arxiv.categories.join(', ');$('#arxiv-max').value=config.arxiv.maxResults;$('#arxiv-pages').value=config.arxiv.maxPages||3;$('#settings').hidden=false;
  }
  function checkedDraft(){
    if(!$('#settings').reportValidity())throw Error('请补全表单');const config=draft();
    if(!config.topics.some(t=>t.enabled))throw Error('至少启用一个研究方向');
    if(config.topics.some(t=>t.enabled&&!t.directPhrases.length&&!t.relatedPhrases.length))throw Error('每个启用方向至少填写一个关键词');
    if(config.scheduleTimes.length<1||config.scheduleTimes.length>8||config.scheduleTimes.some(t=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))throw Error('更新时间需要 1–8 个 HH:mm 格式的时刻');
    for(const s of config.sources){const url=new URL(s.url);if(!['http:','https:'].includes(url.protocol))throw Error('信源需要有效的 HTTP(S) 订阅地址');}
    if(config.topics.length>10||config.sources.length>30)throw Error('最多 10 个研究方向、30 个信源');
    return config;
  }
  $('#add-topic').addEventListener('click',()=>{const preset=$('#preset').value;const topic=presets[preset];addTopic({...structuredClone(topic),id:`topic-${Date.now().toString(36)}`,enabled:true});saveDraft();});
  $('#add-source').addEventListener('click',()=>{addSource({id:`source-${Date.now().toString(36)}`,name:'新订阅源',type:'blog',url:'',enabled:true});saveDraft();});
  $('#add-check').addEventListener('click',()=>{addCheck({title:'',url:'',publishedOn:''});saveDraft();});
  $('#settings').addEventListener('input',saveDraft);
  $('#apply').addEventListener('click',async()=>{
    try{const config=checkedDraft();const body=JSON.stringify({radar:site.id,config});
      await navigator.clipboard.writeText(body);saveDraft();
      message('配置已复制。在 GitHub 点击 Run workflow，将配置粘贴到 config_json 输入框并运行。通常需 1–3 分钟。');
      window.location.href=`https://github.com/${site.repository}/actions/workflows/apply-config.yaml`;
    }catch(error){message(error.message+'；如果浏览器不允许复制，可以使用“导出配置文件”或直接在 GitHub 编辑。',true);}
  });
  $('#export').addEventListener('click',()=>{try{const config=checkedDraft();const url=URL.createObjectURL(new Blob([JSON.stringify(config,null,2)+'\n'],{type:'application/json'}));const a=el('a');a.href=url;a.download='config.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){message(error.message,true);}});
  $('#import').addEventListener('change',async event=>{try{const config=JSON.parse(await event.target.files[0].text());if(config.version!==1||!Array.isArray(config.topics)||!Array.isArray(config.sources)||!config.arxiv)throw Error('不是有效的研究雷达配置');render(config);saveDraft();message('配置已导入草稿；应用到 GitHub 后生效。');}catch(error){message(error.message,true);}});
  $('#reset').addEventListener('click',()=>{render(current);try{localStorage.removeItem(draftKey);localStorage.removeItem(site.id==='rsi'?'research-radar-draft-v2:/rsi-feed/':'research-radar-draft-v2:/rsi-feed/post-train-recipe/');if(site.id==='rsi')localStorage.removeItem('research-radar-draft-v1');}catch{}message('已恢复当前线上配置。');});
  Promise.all(['config.json','site.json'].map(url=>fetch(url,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('无法读取当前配置与雷达信息');return r.json();}))).then(([config,info])=>{
    site=info;
    current=config;let saved=null;const legacyDraftKey=site.id==='rsi'?'research-radar-draft-v2:/rsi-feed/':'research-radar-draft-v2:/rsi-feed/post-train-recipe/';
    try{saved=JSON.parse(localStorage.getItem(draftKey)||localStorage.getItem(legacyDraftKey)||(site.id==='rsi'?localStorage.getItem('research-radar-draft-v1'):null)||'null');}catch{}
    render(saved?.version===1?saved:config);message(saved?'已恢复浏览器草稿；如要查看线上设置，请点击“恢复当前线上配置”。':'当前线上配置已加载。修改后点击下方“应用设置”。');
  }).catch(error=>message(error.message,true));
})();
