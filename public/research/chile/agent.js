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
    paragraph(box, 'Fresh regression result', 'eyebrow');
    paragraph(box, data.model==='commune'?'With commune fixed effects':'Main cohort model');
    paragraph(box, `Coefficient ${data.coefficient.toFixed(4)} · standard error ${data.se.toFixed(4)}`);
    paragraph(box, `95% confidence interval: ${data.ci95[0].toFixed(4)} to ${data.ci95[1].toFixed(4)}. ${data.N.toLocaleString()} observations; ${data.clusters} commune clusters.`);
    paragraph(box, `${data.effect.share_change_pp} percentage points in private share implies ${data.effect.score_points.toFixed(4)} SIMCE points (${data.effect.individual_test_sd.toFixed(4)} individual test-score SD) in the commune mean.`);
    paragraph(box, 'This is the fitted association, not an individual treatment prediction.', 'context-note');
    // Full result record is always available, independent of the compact presentation.
    const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Inspect calculation and sources';details.append(summary);
    const pre=document.createElement('pre');pre.textContent=JSON.stringify(data,null,2);details.append(pre);box.append(details);
    const download=document.createElement('button');download.type='button';download.className='text-button';download.textContent='Download this run ↓';
    download.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='chile-cohort-run.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};box.append(download);parent.append(box);
    return box;
  }
  fetch('/api/chile/health').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
    $('agent-status').textContent=data.chat_available?'Ready. Ask about the two cohort models and their interpretation.':'Conversation is awaiting activation. You can run the two models directly.';
    $('agent-send').disabled=!data.chat_available;
  }).catch(()=>{$('agent-status').textContent='The research service is currently unavailable.';});
  $('agent-run-form').addEventListener('submit',async event=>{
    event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;
    const target=$('agent-result');target.replaceChildren();paragraph(target,'Running the regression on the paper’s data…');
    try {const data=await call('analyze',{specification:$('agent-model').value,share_change_pp:Number($('agent-pp').value)});target.replaceChildren();result(target,data);}
    catch(error){target.replaceChildren();paragraph(target,error.name==='AbortError'?'The calculation timed out. Please try again.':error.message);}
    finally{button.disabled=false;}
  });
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
