// Blog collection and article viewer.
import '../core/site.js';
import { $, escapeHTML, idle } from '../core/dom.js';
import { loadManifest, loadNote, loadSearch } from '../core/data.js';
import { typeset, clearMath, prefetchMath } from './math.js';
import { openImage } from './lightbox.js';
import { scramble } from '../core/fx.js';

let notes = [], firstView = true, fullText = null, category = 'all', selected = null, revision = 0;
let activeHeadings = [], tocQueued = false;

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const shortDateFormat = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'Asia/Shanghai',
});
const date = value => value ? dateFormat.format(new Date(value)) : 'Not recorded';
const postDate = note => {
  const raw = note.date || note.started_at;
  return raw ? shortDateFormat.format(new Date(raw)) : '';
};

function span(seconds) {
  if (seconds == null) return 'In progress';
  const minutes = Math.max(1, Math.round(seconds / 60));
  const days = Math.floor(minutes / 1440), hours = Math.floor(minutes % 1440 / 60), mins = minutes % 60;
  return [days ? days + 'd' : '', hours ? hours + 'h' : '', mins ? mins + 'm' : ''].filter(Boolean).join(' ');
}

const labels = { all: 'All posts', blog: 'Articles', concept: 'Notes' };
const kindLabel = kind => labels[kind] || (kind === 'paper' ? 'Paper note' : kind);
let activeTag = '';
const tags = note => note.tags.map(t => '<span>' + escapeHTML(t) + '</span>').join('');

function candidates() {
  const query = $('search').value.trim().toLowerCase();
  return notes.filter(n =>
    (category === 'all' || n.kind === category)
    && (!activeTag || n.tags.includes(activeTag))
    && [n.id, n.title, n.topic, n.summary, ...n.tags, fullText?.[n.id] || ''].join(' ').toLowerCase().includes(query)
  );
}

function updateList() {
  $('filters').replaceChildren();
  for (const [kind, label] of Object.entries(labels)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(category === kind));
    const text = document.createElement('span');
    text.textContent = label;
    const count = document.createElement('span');
    count.className = 'filter-count';
    count.textContent = notes.filter(n => kind === 'all' || n.kind === kind).length;
    b.append(text, count);
    b.onclick = () => { category = kind; activeTag = ''; overview({ push: true }); };
    $('filters').append(b);
  }

  const tagList = $('tag-filter');
  const availableTags = [...new Set(notes.filter(n => category === 'all' || n.kind === category).flatMap(n => n.tags))].sort((a, b) => a.localeCompare(b));
  if (!availableTags.includes(activeTag)) activeTag = '';
  tagList.replaceChildren();
  for (const tag of ['', ...availableTags]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = tag || 'All tags';
    button.setAttribute('aria-pressed', String(activeTag === tag));
    button.onclick = () => { activeTag = tag; overview({ push: true }); };
    tagList.append(button);
  }

  const matches = candidates();
  $('count').textContent = `${matches.length} ${matches.length === 1 ? 'post' : 'posts'}`;
  $('paper-links').replaceChildren();
  for (const note of matches) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = note.title;
    b.dataset.id = note.id;
    b.setAttribute('aria-current', String(selected?.id === note.id));
    b.onclick = () => select(note, { scroll: true });
    $('paper-links').append(b);
  }
}

function reset() {
  revision++;
  activeHeadings = [];
  clearMath($('detail'));
}

function select(note, { push = true, anchor = '', scroll = false } = {}) {
  selected = note;
  if (category !== 'all' && category !== note.kind) {
    category = Object.hasOwn(labels, note.kind) ? note.kind : 'all';
    activeTag = '';
  }
  document.body.classList.remove('reading-overview');
  if (push) {
    const u = new URL(location.href);
    u.search = '';
    u.searchParams.set('note', note.id);
    u.hash = anchor;
    history.pushState({}, '', u);
  }
  updateList();
  show(note, anchor, scroll);
}

function jump(anchor) {
  if (anchor) document.getElementById(anchor)?.scrollIntoView({ block: 'start' });
}

function attachCodeCopy(container) {
  for (const pre of container.querySelectorAll('pre')) {
    const code = pre.querySelector('code');
    if (!code) continue;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-copy';
    btn.textContent = 'Copy';
    btn.setAttribute('aria-label', 'Copy code');
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code.textContent);
        btn.textContent = 'Copied';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1800);
      } catch {
        btn.textContent = 'Failed';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
      }
    });
    pre.append(btn);
  }
}

function articleNavHTML(note) {
  const list = candidates();
  const idx = list.findIndex(n => n.id === note.id);
  if (idx < 0 || list.length < 2) return '';
  const prev = list[idx - 1], next = list[idx + 1];
  if (!prev && !next) return '';
  return `<nav class="article-nav" aria-label="Adjacent posts">${prev ? `<a class="prev" href="papers.html?note=${encodeURIComponent(prev.id)}" data-id="${escapeHTML(prev.id)}"><span>← Previous</span><strong>${escapeHTML(prev.title)}</strong></a>` : ''}${next ? `<a class="next" href="papers.html?note=${encodeURIComponent(next.id)}" data-id="${escapeHTML(next.id)}"><span>Next →</span><strong>${escapeHTML(next.title)}</strong></a>` : ''}</nav>`;
}

async function show(note, anchor = '', scroll = false) {
  reset();
  const version = revision;
  document.title = `${note.title} · Blog · HSTK`;
  const published = postDate(note);
  const meta = note.kind === 'paper'
    ? `<dl class="note-dates"><div><dt>Started</dt><dd>${escapeHTML(date(note.started_at))}</dd></div><div><dt>Finished</dt><dd>${note.finished_at ? escapeHTML(date(note.finished_at)) : 'In progress'}</dd></div><div><dt>Reading span</dt><dd>${note.started_at ? escapeHTML(span(note.span_seconds)) : 'Not recorded'}</dd></div></dl><p class="timing-note">UTC+08:00 · Elapsed time includes breaks.</p>`
    : published ? `<p class="timing-note">Published ${escapeHTML(published)}</p>` : '';

  $('detail').innerHTML = `<article class="note-article"><a class="back-library" href="papers.html">← All posts</a><div class="note-heading"><div class="paper-meta">${escapeHTML(kindLabel(note.kind).toUpperCase())} / ${escapeHTML(note.topic)} / ~${note.minutes} MIN READ</div><h2 class="paper-title">${escapeHTML(note.title)}</h2>${note.summary ? '<p>' + escapeHTML(note.summary) + '</p>' : ''}<div class="tags">${tags({ ...note, tags: note.tags.filter(t => t.toLowerCase() !== note.topic.toLowerCase()) })}</div><div class="note-info">${note.paper_url ? '<p class="note-source"><a href="' + escapeHTML(note.paper_url) + '" target="_blank" rel="noopener noreferrer">Original paper</a></p>' : ''}${note.publication_status ? '<p class="timing-note">' + escapeHTML(note.publication_status) + '</p>' : ''}${meta}</div></div><div class="markdown-body loading" lang="zh-CN" aria-busy="true"><div class="scan-skeleton" aria-hidden="true"><span></span><span></span><span></span><span></span></div></div></article>`;
  $('toc-links').replaceChildren();
  firstView = false;
  scramble($('detail').querySelector('.paper-meta'), 550);
  if (scroll && !anchor) $('detail').scrollIntoView({ block: 'start' });
  else if (!anchor) window.scrollTo({ top: 0 });

  let body;
  try { body = await loadNote(note); }
  catch {
    if (version !== revision) return;
    $('detail').querySelector('.markdown-body').outerHTML = '<p class="empty">This post could not be loaded. Check your connection and try again.</p>';
    return;
  }
  if (version !== revision) return;

  const container = $('detail').querySelector('.markdown-body');
  container.innerHTML = body.html;
  container.classList.remove('loading');
  container.removeAttribute('aria-busy');
  attachCodeCopy(container);
  buildToc(container);

  const navHTML = articleNavHTML(note);
  if (navHTML) container.insertAdjacentHTML('afterend', navHTML);

  for (const image of container.querySelectorAll('img')) {
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', 'Enlarge image: ' + (image.alt || 'figure'));
    image.addEventListener('click', () => openImage(image));
    image.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openImage(image); } });
  }
  jump(anchor);
  if (note.has_math) {
    try {
      await typeset(container);
      if (version === revision) { jump(anchor); updateActiveToc(); }
    } catch {
      if (version !== revision) return;
      const p = document.createElement('p');
      p.className = 'timing-note';
      p.textContent = 'Some equations could not be rendered; the original TeX remains available.';
      $('detail').append(p);
    }
  }
}

function updateActiveToc() {
  tocQueued = false;
  if (!activeHeadings.length) return;
  const threshold = 132;
  let current = activeHeadings[0].id;
  for (const heading of activeHeadings) {
    if (heading.getBoundingClientRect().top <= threshold) current = heading.id;
    else break;
  }
  const toc = $('toc-links');
  for (const a of toc.querySelectorAll('a')) {
    const isActive = a.dataset.target === current;
    a.classList.toggle('active', isActive);
    if (isActive) a.setAttribute('aria-current', 'location');
    else a.removeAttribute('aria-current');
  }
}

function buildToc(container) {
  const toc = $('toc-links');
  toc.replaceChildren();
  activeHeadings = [...container.querySelectorAll('h1,h2,h3,h4')].filter(h => h.id);
  for (const heading of activeHeadings) {
    const a = document.createElement('a');
    a.href = '#' + encodeURIComponent(heading.id);
    a.textContent = heading.textContent;
    a.className = 'toc-level-' + heading.tagName.slice(1);
    a.dataset.target = heading.id;
    toc.append(a);
  }
  updateActiveToc();
}

addEventListener('scroll', () => {
  if (activeHeadings.length && !tocQueued) {
    tocQueued = true;
    requestAnimationFrame(updateActiveToc);
  }
}, { passive: true });

function overview({ push = false } = {}) {
  selected = null;
  reset();
  document.title = 'Blog · HSTK';
  document.body.classList.add('reading-overview');
  if (push) {
    const u = new URL(location.href);
    u.searchParams.delete('note');
    if (category !== 'all') u.searchParams.set('view', category === 'concept' ? 'concepts' : category);
    else u.searchParams.delete('view');
    if (activeTag) u.searchParams.set('tag', activeTag);
    else u.searchParams.delete('tag');
    u.hash = '';
    history.pushState({}, '', u);
  }
  updateList();
  $('toc-links').replaceChildren();
  const matches = candidates();
  const filtered = category !== 'all' || activeTag || $('search').value.trim();
  $('detail').innerHTML = `<header class="blog-intro"><p class="eyebrow">THE JOURNAL</p><h1>Blog</h1><p>Ideas, experiments, and notes along the way.</p></header><div class="collection-heading"><h2>${escapeHTML(activeTag || kindLabel(category))}</h2><span>${matches.length} ${matches.length === 1 ? 'post' : 'posts'}</span></div><div class="note-cards">${matches.map(note => `<a class="note-card" data-id="${escapeHTML(note.id)}" href="papers.html?note=${encodeURIComponent(note.id)}"><div class="blog-entry-meta"><span class="entry-kind">${escapeHTML(kindLabel(note.kind))} · ${escapeHTML(note.topic)}</span>${postDate(note) ? `<time datetime="${escapeHTML(note.date || note.started_at)}">${escapeHTML(postDate(note))}</time>` : ''}</div><h3><span>${escapeHTML(note.title)}</span><span class="card-arrow" aria-hidden="true">→</span></h3>${note.summary ? '<p>' + escapeHTML(note.summary) + '</p>' : ''}<div class="blog-entry-foot"><div class="tags">${tags({ ...note, tags: note.tags.filter(t => t.toLowerCase() !== note.topic.toLowerCase()) })}</div><span>${note.minutes} min read</span></div></a>`).join('')}</div>${matches.length ? '' : `<div class="blog-empty"><h3>${filtered ? 'No matching posts' : 'New stories are on the way'}</h3><p>${filtered ? 'Try another keyword or choose All posts and All tags.' : 'Future articles will appear here.'}</p></div>`}`;
  if (firstView) scramble($('detail').querySelector('.eyebrow'), 700);
  firstView = false;
}

function route() {
  const u = new URL(location.href), id = u.searchParams.get('note');
  $('search').value = '';
  activeTag = u.searchParams.get('tag') || '';
  if (!id) {
    const view = u.searchParams.get('view');
    category = view === 'concepts' ? 'concept' : Object.hasOwn(labels, view) ? view : 'all';
    overview();
    return;
  }
  const note = notes.find(n => n.id === id);
  if (!note) {
    category = 'all';
    overview();
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'This post was not found. Choose one from the collection.';
    $('detail').prepend(p);
    return;
  }
  select(note, { push: false, anchor: decodeURIComponent(u.hash.slice(1)) });
}

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
  e.preventDefault();
  $('search').value = '';
  if (hit.note) select(hit.note, { anchor: hit.anchor, scroll: true });
  else { history.pushState({}, '', hit.overview); route(); window.scrollTo({ top: 0 }); }
});

function prefetch(e) {
  const el = e.target.closest?.('[data-id]');
  const note = el && notes.find(n => n.id === el.dataset.id);
  if (note) {
    loadNote(note).catch(() => {});
    if (note.has_math) prefetchMath();
  }
}
document.addEventListener('pointerover', prefetch);
document.addEventListener('focusin', prefetch);

// Reading progress bar along the top edge.
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

try { notes = await loadManifest(); }
catch { $('detail').innerHTML = '<p class="empty">The blog index could not be loaded. Refresh to try again.</p>'; }
route();
idle(() => { if (notes.some(n => n.has_math)) prefetchMath(); });
