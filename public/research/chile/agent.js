(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const history = [];
  async function call(route, body, code) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 125000);
    try {
      const headers = {'Content-Type':'application/json'};
      if (code) headers.Authorization = `Bearer ${code}`;
      const r = await fetch(`/api/chile/${route}`, {method:'POST',headers,body:JSON.stringify(body),signal:controller.signal});
      let data;
      try { data = await r.json(); } catch { throw new Error('The research service is unavailable. Please try again later.'); }
      if (!r.ok) throw new Error(data.error || 'The request could not complete.');
      return data;
    } finally { clearTimeout(timer); }
  }
  function paragraph(parent, text, cls) {
    const p=document.createElement('p'); p.textContent=text; if(cls)p.className=cls;parent.append(p);return p;
  }
  function result(parent,data) {
    const box=document.createElement('div');box.className='agent-record';
    paragraph(box, 'Fresh calculation', 'eyebrow');
    paragraph(box, data.title || data.message || (data.model==='commune'?'With commune fixed effects':'Cohort analysis'));
    const rows=Array.isArray(data.results)?data.results:(Number.isFinite(data.coefficient)?[data]:[]);
    if(rows.length){
      const wrap=document.createElement('div');wrap.className='agent-table-wrap';
      const table=document.createElement('table');const head=document.createElement('thead');const header=document.createElement('tr');
      for(const title of ['Model / sample','Coefficient','Standard error','95% interval','Observations','Communes']){const cell=document.createElement('th');cell.scope='col';cell.textContent=title;header.append(cell);}head.append(header);table.append(head);
      const body=document.createElement('tbody');
      for(const row of rows){const r=row.result||row;if(!Number.isFinite(r.coefficient))continue;const tr=document.createElement('tr');
        const values=[row.label||r.label||r.model||'Cohort model',r.coefficient.toFixed(4),Number.isFinite(r.se)?r.se.toFixed(4):'—',Array.isArray(r.ci95)?r.ci95.map(x=>x.toFixed(4)).join(' to '):'—',r.N?.toLocaleString()||'—',r.clusters?.toLocaleString()||'—'];
        for(const value of values){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);
      }table.append(body);wrap.append(table);box.append(wrap);
    }
    if(data.settings_summary)paragraph(box,data.settings_summary,'context-note');
    if(data.scope)paragraph(box,data.scope,'context-note');
    for(const warning of data.warnings||[])paragraph(box,warning,'context-note');
    // Full result record is always available, independent of the compact presentation.
    const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Inspect calculation and sources';details.append(summary);
    const pre=document.createElement('pre');pre.textContent=JSON.stringify(data,null,2);details.append(pre);box.append(details);
    const download=document.createElement('button');download.type='button';download.className='text-button';download.textContent='Download this run ↓';
    download.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='chile-research-run.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};box.append(download);parent.append(box);
    return box;
  }
  fetch('/api/chile/health').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
    $('agent-status').textContent=data.chat_available?'Ready. Ask about the cohort models and their interpretation.':'Conversation is awaiting activation.';
    $('agent-send').disabled=!data.chat_available;
  }).catch(()=>{$('agent-status').textContent='The research service is currently unavailable.';});
  $('agent-chat-form').addEventListener('submit',async event=>{
    event.preventDefault();const button=$('agent-send');button.disabled=true;
    const question=$('agent-question').value.trim();const target=$('agent-conversation');
    const entry=document.createElement('div');entry.className='agent-turn';target.append(entry);paragraph(entry,question,'agent-user');
    const pending=paragraph(entry,'Reading the paper and running any requested calculations…');
    try {
      const recent=history.slice(-6);
      while(recent.length && new TextEncoder().encode(JSON.stringify({question,history:recent})).length>11000)recent.splice(0,2);
      const data=await call('chat',{question,history:recent},$('agent-access').value);
      pending.remove();paragraph(entry,data.answer,'agent-answer');
      for(const run of data.runs||[])result(entry,run.result);
      const link=document.createElement('a');link.href='/research/chile/paper.pdf';link.textContent='Read the source manuscript ↗';entry.append(link);
      history.push({role:'user',content:question},{role:'assistant',content:data.answer.slice(0,5000)});$('agent-question').value='';
    } catch(error){pending.textContent=error.name==='AbortError'?'The answer timed out. Please try again.':error.message;}
    finally{button.disabled=false;}
  });
})();
