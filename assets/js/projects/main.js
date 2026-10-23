// Project browsing; ?project=<id> selects an entry so it can be linked and shared.
import '../core/site.js';
import { escapeHTML } from '../core/dom.js';
import data from '../../data/projects.js';

let topic = 'All projects';
let selected = new URL(location.href).searchParams.get('project') || data[0]?.id;
const search = document.getElementById('search'), filters = document.getElementById('filters'), links = document.getElementById('paper-links'), detail = document.getElementById('detail');

function choose(id) {
  selected = id;
  const u = new URL(location.href); u.searchParams.set('project', id); history.replaceState({}, '', u);
  render();
}
function render() {
  filters.replaceChildren();
  ['All projects', ...new Set(data.map(p => p.topic))].forEach(t => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = t; b.setAttribute('aria-pressed', String(topic === t));
    b.onclick = () => { topic = t; render(); };
    filters.append(b);
  });
  const q = search.value.trim().toLowerCase();
  const matches = data.filter(p => (topic === 'All projects' || p.topic === topic) && [p.title, p.topic, p.summary, ...p.tags].join(' ').toLowerCase().includes(q));
  if (!matches.some(p => p.id === selected)) selected = matches[0]?.id;
  document.getElementById('count').textContent = `${matches.length} ${matches.length === 1 ? 'project' : 'projects'}`;
  links.replaceChildren();
  matches.forEach(p => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = p.title; b.setAttribute('aria-current', String(p.id === selected));
    b.onclick = () => choose(p.id);
    links.append(b);
  });
  const p = matches.find(p => p.id === selected);
  if (!p) { detail.innerHTML = '<p class="empty">No matching projects. Try another keyword or category.</p>'; return; }
  detail.innerHTML = `<article class="project-entry"><section id="overview"><div class="paper-meta">PROJECT / ${escapeHTML(p.topic)} / ${escapeHTML(p.date)}</div><h2 class="paper-title">${escapeHTML(p.title)}</h2><div class="tags">${p.tags.map(t => `<span>${escapeHTML(t)}</span>`).join('')}</div><p style="margin-top:22px">${escapeHTML(p.summary)}</p></section><section id="idea"><h3>My role</h3><blockquote>${escapeHTML(p.role)}</blockquote></section><section id="takeaways"><h3>Implementation</h3><ul>${p.implementation.map(n => `<li>${escapeHTML(n)}</li>`).join('')}</ul></section><section id="questions"><h3>Technology stack</h3><ul>${p.stack.map(n => `<li>${escapeHTML(n)}</li>`).join('')}</ul></section></article>`;
}
search.addEventListener('input', render);
render();
