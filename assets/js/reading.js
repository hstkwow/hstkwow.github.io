'use strict';
const notes=window.READING_NOTES || [];
const $=id=>document.getElementById(id);
const escapeHTML=window.Site.escapeHTML;
let category='paper', selected=null, observer=null, revision=0, mathQueue=Promise.resolve();
const dateFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
function date(value){return value?dateFormat.format(new Date(value)):'Not recorded';}
function span(seconds){if(seconds==null)return 'In progress';const minutes=Math.max(1,Math.round(seconds/60));const days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),mins=minutes%60;return [days?days+'d':'',hours?hours+'h':'',mins?mins+'m':''].filter(Boolean).join(' ');}
function candidates(){const query=$('search').value.trim().toLowerCase();return notes.filter(n=>n.kind===category&&[n.id,n.title,n.topic,n.summary,...n.tags,n.search_text].join(' ').toLowerCase().includes(query));}
function updateList(){
 $('filters').replaceChildren();
 for(const [kind,label] of [['paper','Papers'],['concept','Concepts']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-pressed',String(category===kind));b.onclick=()=>{category=kind;overview({push:true})};$('filters').append(b);}
 const matches=candidates();$('count').textContent=`${matches.length} ${category==='paper'?'papers':'concept documents'}`;$('paper-links').replaceChildren();
 for(const note of matches){const b=document.createElement('button');b.type='button';b.textContent=note.title;b.setAttribute('aria-current',String(selected?.id===note.id));b.onclick=()=>select(note);$('paper-links').append(b);}
}
function empty(){revision++;observer?.disconnect();window.MathJax?.typesetClear?.([$('detail')]);$('detail').innerHTML='<p class="empty">No matching notes. Try another keyword.</p>';$('toc-links').replaceChildren();}
function select(note,{push=true,anchor='',scroll=false}={}){
 selected=note;category=note.kind;document.body.classList.remove('reading-overview');
 if(push){const u=new URL(location.href);u.searchParams.set('note',note.id);u.hash=anchor;history.pushState({},'',u);}
 updateList();show(note,anchor,scroll);
}
function jump(anchor){if(anchor)document.getElementById(anchor)?.scrollIntoView({block:'start'});}
function show(note,anchor='',scroll=false){
 const version=++revision;observer?.disconnect();window.MathJax?.typesetClear?.([$('detail')]);
 $('detail').innerHTML=`<article class="note-article"><a class="back-library" href="papers.html">← All notes</a><div class="note-heading"><div class="paper-meta">${note.kind==='paper'?'PAPER NOTE':'CONCEPT REFERENCE'} / ${escapeHTML(note.topic)}</div><h2 class="paper-title">${escapeHTML(note.title)}</h2>${note.summary?'<p>'+escapeHTML(note.summary)+'</p>':''}<div class="tags">${note.tags.map(t=>'<span>'+escapeHTML(t)+'</span>').join('')}</div>${note.paper_url?'<p class="note-source"><a href="'+escapeHTML(note.paper_url)+'" target="_blank" rel="noopener noreferrer">Original paper ↗</a></p>':''}${note.publication_status?'<p class="timing-note">'+escapeHTML(note.publication_status)+'</p>':''}${note.kind==='paper'?`<dl class="note-dates"><div><dt>Started</dt><dd>${escapeHTML(date(note.started_at))}</dd></div><div><dt>Finished</dt><dd>${note.finished_at?escapeHTML(date(note.finished_at)):'In progress'}</dd></div><div><dt>Reading span</dt><dd>${note.started_at?escapeHTML(span(note.span_seconds)):'Not recorded'}</dd></div></dl><p class="timing-note">Times shown in UTC+08:00. Reading span includes breaks between the start and finish.</p>`:''}</div><div class="markdown-body" lang="zh-CN">${note.html}</div></article>`;
 const toc=$('toc-links');toc.replaceChildren();
 for(const heading of $('detail').querySelectorAll('.markdown-body h1,.markdown-body h2,.markdown-body h3,.markdown-body h4')){const a=document.createElement('a');a.href='#'+encodeURIComponent(heading.id);a.textContent=heading.textContent;a.className='toc-level-'+heading.tagName.slice(1);a.dataset.target=heading.id;toc.append(a);}
 if('IntersectionObserver' in window){observer=new IntersectionObserver(entries=>{const active=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];if(active)for(const a of toc.querySelectorAll('a'))a.classList.toggle('active',a.dataset.target===active.target.id);},{rootMargin:'0px 0px -65% 0px'});$('detail').querySelectorAll('.markdown-body h1,.markdown-body h2,.markdown-body h3,.markdown-body h4').forEach(h=>observer.observe(h));}
 for(const image of $('detail').querySelectorAll('img')){image.tabIndex=0;image.setAttribute('role','button');image.setAttribute('aria-label','Enlarge image: '+(image.alt||'figure'));image.addEventListener('click',()=>openImage(image));image.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openImage(image)}});image.addEventListener('load',()=>{if(version===revision&&anchor)jump(anchor)},{once:true});}
 if(scroll&&!anchor)$('detail').scrollIntoView({block:'start'});jump(anchor);
 if(window.MathJax?.startup?.promise){mathQueue=mathQueue.catch(()=>{}).then(()=>window.MathJax.startup.promise).then(async()=>{if(version!==revision)return;await window.MathJax.typesetPromise([$('detail')]);if(version===revision)jump(anchor);}).catch(()=>{if(version===revision){const p=document.createElement('p');p.className='timing-note';p.textContent='Some equations could not be rendered; the original TeX remains available.';$('detail').append(p)}});}
}
function overview({push=false}={}){
 selected=null;revision++;observer?.disconnect();window.MathJax?.typesetClear?.([$('detail')]);document.body.classList.add('reading-overview');
 if(push){const u=new URL(location.href);u.searchParams.delete('note');if(category==='concept')u.searchParams.set('view','concepts');else u.searchParams.delete('view');u.hash='';history.pushState({},'',u);}
 updateList();$('toc-links').replaceChildren();
 const matches=candidates(),papers=notes.filter(n=>n.kind==='paper');
 $('detail').innerHTML=`<div class="overview-heading"><div class="eyebrow">THE READING COLLECTION</div><h1>Read.</h1><p>Notes on pansharpening, the methods behind it, and the concepts I return to.</p><div class="reading-stats"><span><strong>${papers.length}</strong> papers</span><span><strong>${papers.filter(n=>n.finished_at).length}</strong> completed</span><span><strong>${notes.filter(n=>n.kind==='concept').length}</strong> concept reference</span></div></div><div class="collection-heading"><h2>${category==='paper'?'Paper notes':'Concept references'}</h2><span>${matches.length} ${matches.length===1?'entry':'entries'}</span></div><div class="note-cards">${matches.map(note=>`<a class="note-card" href="papers.html?note=${encodeURIComponent(note.id)}"><div class="paper-meta">${escapeHTML(note.topic)} / ${note.kind==='paper'?(note.finished_at?'COMPLETED':'IN PROGRESS'):'REFERENCE'}</div><h3>${escapeHTML(note.title)}<span aria-hidden="true">↗</span></h3>${note.summary?'<p>'+escapeHTML(note.summary)+'</p>':''}<div class="tags">${note.tags.map(t=>'<span>'+escapeHTML(t)+'</span>').join('')}</div><div class="card-meta"><span>${note.finished_at?escapeHTML(date(note.finished_at).split(',')[0]):note.started_at?escapeHTML(date(note.started_at).split(',')[0]):'Concept notes'}</span><span>${note.kind==='paper'&&note.started_at?'Span: '+escapeHTML(span(note.span_seconds)):'Open notes →'}</span></div></a>`).join('')}</div>${matches.length?'':'<p class="empty">No matching notes. Try another keyword.</p>'}`;
}
function route(){const u=new URL(location.href),id=u.searchParams.get('note');$('search').value='';if(!id){category=u.searchParams.get('view')==='concepts'?'concept':'paper';overview();return;}const note=notes.find(n=>n.id===id);if(!note){category='paper';overview();const p=document.createElement('p');p.className='empty';p.textContent='This note was not found. Choose one from the collection.';$('detail').prepend(p);return;}select(note,{push:false,anchor:decodeURIComponent(u.hash.slice(1))});}
$('search').addEventListener('input',()=>overview({push:Boolean(selected)}));
window.addEventListener('popstate',route);window.addEventListener('hashchange',()=>jump(decodeURIComponent(location.hash.slice(1))));
// Note links use query strings so refresh, sharing and browser Back retain the selected paper.
$('detail').addEventListener('click',e=>{const a=e.target.closest('a');if(!a||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0)return;const u=new URL(a.href,location.href);if(u.origin===location.origin&&u.pathname===location.pathname&&u.searchParams.has('note')){const note=notes.find(n=>n.id===u.searchParams.get('note'));if(note){e.preventDefault();$('search').value='';select(note,{anchor:decodeURIComponent(u.hash.slice(1)),scroll:true});}}});
function openImage(image){$('full-image').src=image.src;$('full-image').alt=image.alt;$('image-viewer').showModal();}
$('close-image').addEventListener('click',()=>$('image-viewer').close());$('image-viewer').addEventListener('click',e=>{if(e.target===$('image-viewer'))$('image-viewer').close()});
route();
