// Command palette (⌘K / Ctrl+K / "/"): jump to pages, notes and projects, with full-text note search.
import { escapeHTML } from './dom.js';
import { loadManifest, loadSearch } from './data.js';

const PAGES = [
  { group: 'Pages', title: 'Home', hint: 'Profile, background and awards', href: 'index.html' },
  { group: 'Pages', title: 'Projects', hint: 'IoT, web and graphics work', href: 'projects.html' },
  { group: 'Pages', title: 'Reading', hint: 'Paper notes on pansharpening', href: 'papers.html' },
  { group: 'Pages', title: 'Concept references', hint: 'Standalone knowledge notes', href: 'papers.html?view=concepts' },
  { group: 'Elsewhere', title: 'GitHub', hint: 'github.com/HSTKwow', href: 'https://github.com/HSTKwow' },
  { group: 'Elsewhere', title: 'Email', hint: 'hstkwow@gmail.com', href: 'mailto:hstkwow@gmail.com' },
];

let dialog, input, list, status, items = [], results = [], active = 0, fullText = null, opener = null;

function haystack(item) { return [item.title, item.hint, ...(item.keywords || [])].join(' ').toLowerCase(); }

async function collect() {
  const [notes, projects] = await Promise.all([
    loadManifest().catch(() => []),
    import('../../data/projects.js').then(m => m.default).catch(() => []),
  ]);
  items = [
    ...PAGES,
    ...notes.map(n => ({ group: n.kind === 'paper' ? 'Paper notes' : 'Concepts', id: n.id, title: n.title, hint: n.summary || `${n.topic} · ${n.kind === 'paper' ? (n.finished_at ? 'completed' : 'in progress') : 'reference'}`, keywords: [n.topic, ...n.tags], href: 'papers.html?note=' + encodeURIComponent(n.id) })),
    ...projects.map(p => ({ group: 'Projects', title: p.title, hint: p.summary, keywords: [p.topic, ...p.tags], href: 'projects.html?project=' + encodeURIComponent(p.id) })),
  ];
}

function snippet(text, q) {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return '';
  const start = Math.max(0, i - 24), end = Math.min(text.length, i + q.length + 40);
  return (start ? '…' : '') + escapeHTML(text.slice(start, i)) + '<mark>' + escapeHTML(text.slice(i, i + q.length)) + '</mark>' + escapeHTML(text.slice(i + q.length, end)) + (end < text.length ? '…' : '');
}

function search() {
  const q = input.value.trim().toLowerCase();
  if (!q) results = items.filter(i => i.group !== 'Projects').map(i => ({ item: i, score: 0 }));
  else {
    results = [];
    for (const item of items) {
      const title = item.title.toLowerCase(), hay = haystack(item);
      let score = title.startsWith(q) ? 100 : title.includes(q) ? 70 : hay.includes(q) ? 40 : 0, match = '';
      if (!score && item.id && fullText?.[item.id]) { match = snippet(fullText[item.id], q); if (match) score = 20; }
      if (score) results.push({ item, score, match });
    }
    results.sort((a, b) => b.score - a.score);
  }
  active = 0;
  render(q);
}

function render(q) {
  let html = '', group = '';
  results.slice(0, 40).forEach(({ item, match }, i) => {
    if (item.group !== group) { group = item.group; html += `<li class="palette-group" role="presentation">${escapeHTML(group)}</li>`; }
    html += `<li role="option" id="palette-${i}" data-index="${i}" aria-selected="${i === active}"><a href="${escapeHTML(item.href)}" tabindex="-1"${item.href.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : ''}><span class="palette-title">${escapeHTML(item.title)}</span><span class="palette-hint">${match || escapeHTML(item.hint || '')}</span></a></li>`;
  });
  list.innerHTML = html || `<li class="palette-empty">No results for “${escapeHTML(q)}”.</li>`;
  status.textContent = `${results.length} ${results.length === 1 ? 'result' : 'results'}${q && !fullText ? ' · loading full text…' : ''}`;
  input.setAttribute('aria-activedescendant', results.length ? 'palette-' + active : '');
}

function move(delta) {
  if (!results.length) return;
  list.querySelector(`[data-index="${active}"]`)?.setAttribute('aria-selected', 'false');
  active = (active + delta + Math.min(results.length, 40)) % Math.min(results.length, 40);
  const el = list.querySelector(`[data-index="${active}"]`);
  el?.setAttribute('aria-selected', 'true');
  el?.scrollIntoView({ block: 'nearest' });
  input.setAttribute('aria-activedescendant', 'palette-' + active);
}

function build() {
  dialog = document.createElement('dialog');
  dialog.className = 'palette';
  dialog.setAttribute('aria-label', 'Search the journal');
  dialog.innerHTML = `<div class="palette-head"><span class="palette-mark" aria-hidden="true">⌖</span><input type="text" placeholder="Search pages, notes, projects, or any phrase in a note…" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-autocomplete="list" autocomplete="off" spellcheck="false"><kbd>Esc</kbd></div><ul id="palette-list" role="listbox"></ul><div class="palette-foot"><span class="palette-status" role="status"></span><span><kbd>↑</kbd><kbd>↓</kbd> select <kbd>↵</kbd> open</span></div>`;
  document.body.append(dialog);
  input = dialog.querySelector('input'); list = dialog.querySelector('ul'); status = dialog.querySelector('.palette-status');
  input.addEventListener('input', () => {
    search();
    if (input.value.trim() && !fullText) loadSearch().then(t => { fullText = t; search(); });
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); list.querySelector(`[data-index="${active}"] a`)?.click(); }
    else if (e.key === 'Escape') { e.preventDefault(); dialog.close(); }
  });
  list.addEventListener('pointermove', e => { const li = e.target.closest('[data-index]'); if (li && +li.dataset.index !== active) move(+li.dataset.index - active); });
  list.addEventListener('click', e => { if (e.target.closest('a')) dialog.close(); });
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => opener?.focus?.());
}

export async function openPalette() {
  if (!dialog) build();
  if (dialog.open) return;
  opener = document.activeElement;
  input.value = '';
  dialog.showModal();
  if (!items.length) { status.textContent = 'Loading index…'; await collect(); }
  search();
}

export function initPalette() {
  document.getElementById('palette-open')?.addEventListener('click', openPalette);
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); openPalette(); }
  });
  const key = document.querySelector('#palette-open kbd');
  if (key && !/Mac|iPhone|iPad/.test(navigator.platform)) key.textContent = 'Ctrl K';
}
