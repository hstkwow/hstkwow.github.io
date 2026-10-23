// Reading collection and note viewer.
import '../core/site.js';
import { $, escapeHTML, idle } from '../core/dom.js';
import { loadManifest, loadNote, loadSearch } from '../core/data.js';
import { typeset, clearMath, prefetchMath } from './math.js';
import { openImage } from './lightbox.js';
import { timeline, linkTimeline } from './timeline.js';

let notes = [], fullText = null, category = 'paper', selected = null, observer = null, revision = 0;
const dateFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const date = value => value ? dateFormat.format(new Date(value)) : 'Not recorded';
function span(seconds) {
  if (seconds == null) return 'In progress';
  const minutes = Math.max(1, Math.round(seconds / 60));
  const days = Math.floor(minutes / 1440), hours = Math.floor(minutes % 1440 / 60), mins = minutes % 60;
  return [days ? days + 'd' : '', hours ? hours + 'h' : '', mins ? mins + 'm' : ''].filter(Boolean).join(' ');
}
const tags = note => note.tags.map(t => '<span>' + escapeHTML(t) + '</span>').join('');

function candidates() {
  const query = $('search').value.trim().toLowerCase();
  return notes.filter(n => n.kind === category && [n.id, n.title, n.topic, n.summary, ...n.tags, fullText?.[n.id] || ''].join(' ').toLowerCase().includes(query));
}

function updateList() {
  $('filters').replaceChildren();
  for (const [kind, label] of [['paper', 'Papers'], ['concept', 'Concepts']]) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label; b.setAttribute('aria-pressed', String(category === kind));
    b.onclick = () => { category = kind; overview({ push: true }); };
    $('filters').append(b);
  }
  const matches = candidates();
  $('count').textContent = `${matches.length} ${category === 'paper' ? 'papers' : 'concept documents'}`;
  $('paper-links').replaceChildren();
  for (const note of matches) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = note.title; b.dataset.id = note.id;
    b.setAttribute('aria-current', String(selected?.id === note.id));
    b.onclick = () => select(note, { scroll: true });
    $('paper-links').append(b);
  }
}

function reset() { revision++; observer?.disconnect(); clearMath($('detail')); }

function select(note, { push = true, anchor = '', scroll = false } = {}) {
  selected = note; category = note.kind;
  document.body.classList.remove('reading-overview');
  if (push) { const u = new URL(location.href); u.search = ''; u.searchParams.set('note', note.id); u.hash = anchor; history.pushState({}, '', u); }
  updateList();
  show(note, anchor, scroll);
}

function jump(anchor) { if (anchor) document.getElementById(anchor)?.scrollIntoView({ block: 'start' }); }

async function show(note, anchor = '', scroll = false) {
  reset();
  const version = revision;
  const meta = note.kind === 'paper'
    ? `<dl class="note-dates"><div><dt>Started</dt><dd>${escapeHTML(date(note.started_at))}</dd></div><div><dt>Finished</dt><dd>${note.finished_at ? escapeHTML(date(note.finished_at)) : 'In progress'}</dd></div><div><dt>Reading span</dt><dd>${note.started_at ? escapeHTML(span(note.span_seconds)) : 'Not recorded'}</dd></div></dl><p class="timing-note">Times shown in UTC+08:00. Reading span includes breaks between the start and finish.</p>`
    : '';
  // The heading renders immediately from the manifest; the body streams in after it.
  $('detail').innerHTML = `<article class="note-article"><a class="back-library" href="papers.html">← All notes</a><div class="note-heading"><div class="paper-meta">${note.kind === 'paper' ? 'PAPER NOTE' : 'CONCEPT REFERENCE'} / ${escapeHTML(note.topic)} / ~${note.minutes} MIN READ</div><h2 class="paper-title">${escapeHTML(note.title)}</h2>${note.summary ? '<p>' + escapeHTML(note.summary) + '</p>' : ''}<div class="tags">${tags(note)}</div>${note.paper_url ? '<p class="note-source"><a href="' + escapeHTML(note.paper_url) + '" target="_blank" rel="noopener noreferrer">Original paper ↗</a></p>' : ''}${note.publication_status ? '<p class="timing-note">' + escapeHTML(note.publication_status) + '</p>' : ''}${meta}</div><div class="markdown-body loading" lang="zh-CN" aria-busy="true"><div class="scan-skeleton" aria-hidden="true"><span></span><span></span><span></span><span></span></div></div></article>`;
  $('toc-links').replaceChildren();
  if (scroll && !anchor) $('detail').scrollIntoView({ block: 'start' });
  else if (!anchor) window.scrollTo({ top: 0 });

  let body;
  try { body = await loadNote(note); }
  catch {
    if (version !== revision) return;
    $('detail').querySelector('.markdown-body').outerHTML = '<p class="empty">This note could not be loaded. Check your connection and try again.</p>';
    return;
  }
  if (version !== revision) return;
  const container = $('detail').querySelector('.markdown-body');
  container.innerHTML = body.html;
  container.classList.remove('loading');
  container.removeAttribute('aria-busy');
  buildToc(container);
  for (const image of container.querySelectorAll('img')) {
    image.tabIndex = 0; image.setAttribute('role', 'button');
    image.setAttribute('aria-label', 'Enlarge image: ' + (image.alt || 'figure'));
    image.addEventListener('click', () => openImage(image));
    image.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openImage(image); } });
  }
  jump(anchor);
  if (note.has_math) {
    try { await typeset(container); if (version === revision) jump(anchor); }
    catch {
      if (version !== revision) return;
      const p = document.createElement('p'); p.className = 'timing-note';
      p.textContent = 'Some equations could not be rendered; the original TeX remains available.';
      $('detail').append(p);
    }
  }
}

function buildToc(container) {
  const toc = $('toc-links');
  const headings = container.querySelectorAll('h1,h2,h3,h4');
  for (const heading of headings) {
    const a = document.createElement('a');
    a.href = '#' + encodeURIComponent(heading.id); a.textContent = heading.textContent;
    a.className = 'toc-level-' + heading.tagName.slice(1); a.dataset.target = heading.id;
    toc.append(a);
  }
  if (!('IntersectionObserver' in window)) return;
  observer = new IntersectionObserver(entries => {
    const active = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (active) for (const a of toc.querySelectorAll('a')) a.classList.toggle('active', a.dataset.target === active.target.id);
  }, { rootMargin: '0px 0px -65% 0px' });
  headings.forEach(h => observer.observe(h));
}

function overview({ push = false } = {}) {
  selected = null; reset();
  document.body.classList.add('reading-overview');
  if (push) { const u = new URL(location.href); u.searchParams.delete('note'); if (category === 'concept') u.searchParams.set('view', 'concepts'); else u.searchParams.delete('view'); u.hash = ''; history.pushState({}, '', u); }
  updateList(); $('toc-links').replaceChildren();
  const matches = candidates(), papers = notes.filter(n => n.kind === 'paper');
  const query = $('search').value.trim();
  $('detail').innerHTML = `<div class="overview-heading"><div class="eyebrow">THE READING COLLECTION</div><h1>Read.</h1><p>Notes on pansharpening, the methods behind it, and the concepts I return to.</p><div class="reading-stats"><span><strong>${papers.length}</strong> papers</span><span><strong>${papers.filter(n => n.finished_at).length}</strong> completed</span><span><strong>${notes.filter(n => n.kind === 'concept').length}</strong> concept reference</span></div></div>${category === 'paper' && !query ? timeline(notes, span) : ''}<div class="collection-heading"><h2>${category === 'paper' ? 'Paper notes' : 'Concept references'}</h2><span>${matches.length} ${matches.length === 1 ? 'entry' : 'entries'}</span></div><div class="note-cards">${matches.map(note => `<a class="note-card" data-id="${escapeHTML(note.id)}" href="papers.html?note=${encodeURIComponent(note.id)}"><div class="paper-meta">${escapeHTML(note.topic)} / ${note.kind === 'paper' ? (note.finished_at ? 'COMPLETED' : 'IN PROGRESS') : 'REFERENCE'}</div><h3>${escapeHTML(note.title)}<span aria-hidden="true">↗</span></h3>${note.summary ? '<p>' + escapeHTML(note.summary) + '</p>' : ''}<div class="tags">${tags(note)}</div><div class="card-meta"><span>${note.finished_at ? escapeHTML(date(note.finished_at).split(',')[0]) : note.started_at ? escapeHTML(date(note.started_at).split(',')[0]) : 'Concept notes'}</span><span>${note.kind === 'paper' && note.started_at ? 'Span: ' + escapeHTML(span(note.span_seconds)) : 'Open notes →'}</span></div></a>`).join('')}</div>${matches.length ? '' : '<p class="empty">No matching notes. Try another keyword.</p>'}`;
}

function route() {
  const u = new URL(location.href), id = u.searchParams.get('note');
  $('search').value = '';
  if (!id) { category = u.searchParams.get('view') === 'concepts' ? 'concept' : 'paper'; overview(); return; }
  const note = notes.find(n => n.id === id);
  if (!note) {
    category = 'paper'; overview();
    const p = document.createElement('p'); p.className = 'empty'; p.textContent = 'This note was not found. Choose one from the collection.';
    $('detail').prepend(p); return;
  }
  select(note, { push: false, anchor: decodeURIComponent(u.hash.slice(1)) });
}

// In-page navigation: note links keep query strings so refresh, sharing and Back work.
function noteFromLink(a) {
  const u = new URL(a.href, location.href);
  if (u.origin !== location.origin || u.pathname !== location.pathname) return null;
  if (!u.searchParams.has('note')) return u.search === '' || u.searchParams.has('view') ? { overview: u } : null;
  const note = notes.find(n => n.id === u.searchParams.get('note'));
  return note ? { note, anchor: decodeURIComponent(u.hash.slice(1)) } : null;
}
$('detail').addEventListener('click', e => {
  const a = e.target.closest('a');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0 || a.target) return;
  const hit = noteFromLink(a);
  if (!hit) return;
  e.preventDefault(); $('search').value = '';
  if (hit.note) select(hit.note, { anchor: hit.anchor, scroll: true });
  else { history.pushState({}, '', hit.overview); route(); window.scrollTo({ top: 0 }); }
});
// Fetch a note body as soon as the reader shows intent to open it.
function prefetch(e) {
  const el = e.target.closest?.('[data-id]');
  const note = el && notes.find(n => n.id === el.dataset.id);
  if (note) { loadNote(note).catch(() => {}); if (note.has_math) prefetchMath(); }
}
document.addEventListener('pointerover', prefetch);
document.addEventListener('focusin', prefetch);

// Reading progress, drawn as a scan line under the masthead.
(() => {
  const bar = document.querySelector('.scan-progress');
  let queued = false;
  function update() {
    queued = false;
    const article = selected && $('detail').querySelector('.markdown-body');
    if (!article) { bar.style.transform = 'scaleX(0)'; return; }
    const r = article.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight * 0.35 - r.top) / Math.max(1, r.height - innerHeight * 0.4)));
    bar.style.transform = `scaleX(${p.toFixed(4)})`;
  }
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  new MutationObserver(update).observe($('detail'), { childList: true, subtree: true });
})();

$('search').addEventListener('input', () => {
  overview({ push: Boolean(selected) });
  if (!fullText) loadSearch().then(t => { fullText = t; if (!selected) overview(); });
});
addEventListener('popstate', route);
addEventListener('hashchange', () => jump(decodeURIComponent(location.hash.slice(1))));
linkTimeline($('detail'));

try { notes = await loadManifest(); }
catch { $('detail').innerHTML = '<p class="empty">The reading index could not be loaded. Refresh to try again.</p>'; }
route();
idle(() => { if (notes.some(n => n.has_math)) prefetchMath(); });
