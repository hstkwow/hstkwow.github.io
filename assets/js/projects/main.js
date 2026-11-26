// Project browsing; ?project=<id> selects an entry so it can be linked and shared.
import '../core/site.js';
import { $, escapeHTML } from '../core/dom.js';
import data from '../../data/projects.js';

let topic = 'All projects';
let selected = new URL(location.href).searchParams.get('project') || data[0]?.id;
const search = $('search'), filters = $('filters'), links = $('paper-links'), detail = $('detail');
const tocLinks = [...document.querySelectorAll('.toc nav a')];
let spyQueued = false;

function updateToc() {
  spyQueued = false;
  const sections = tocLinks.map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  if (!sections.length) return;
  let activeId = sections[0].id;
  for (const s of sections) {
    if (s.getBoundingClientRect().top <= 140) activeId = s.id;
  }
  for (const a of tocLinks) {
    a.classList.toggle('active', a.getAttribute('href') === '#' + activeId);
  }
}

addEventListener('scroll', () => {
  if (!spyQueued) {
    spyQueued = true;
    requestAnimationFrame(updateToc);
  }
}, { passive: true });

function choose(id, { push = true, scroll = false } = {}) {
  selected = id;
  if (push) {
    const u = new URL(location.href);
    u.searchParams.set('project', id);
    history.pushState({}, '', u);
  }
  render();
  if (scroll && innerWidth <= 760) detail.scrollIntoView({ block: 'start' });
}

function render() {
  filters.replaceChildren();
  const topics = ['All projects', ...new Set(data.map(p => p.topic))];
  topics.forEach(t => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(topic === t));
    const label = document.createElement('span');
    label.textContent = t;
    const count = document.createElement('span');
    count.className = 'filter-count';
    count.textContent = data.filter(p => t === 'All projects' || p.topic === t).length;
    b.append(label, count);
    b.onclick = () => { topic = t; render(); };
    filters.append(b);
  });

  const q = search.value.trim().toLowerCase();
  const matches = data.filter(p =>
    (topic === 'All projects' || p.topic === topic)
    && [p.title, p.topic, p.summary, ...p.tags].join(' ').toLowerCase().includes(q)
  );
  if (!matches.some(p => p.id === selected)) selected = matches[0]?.id;

  $('count').textContent = `${matches.length} ${matches.length === 1 ? 'project' : 'projects'}`;
  links.replaceChildren();
  matches.forEach(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = p.title;
    b.setAttribute('aria-current', String(p.id === selected));
    b.onclick = () => choose(p.id, { scroll: true });
    links.append(b);
  });

  const p = matches.find(item => item.id === selected);
  if (!p) {
    document.title = 'Projects · HSTK';
    detail.innerHTML = '<p class="empty">No matching projects. Try another keyword or category.</p>';
    return;
  }

  document.title = `${p.title} · Projects · HSTK`;
  const repoHTML = p.repo
    ? `<p class="project-repo"><a href="${escapeHTML(p.repo)}" target="_blank" rel="noopener noreferrer">View source on GitHub ↗</a></p>`
    : '';
  detail.innerHTML = `<article class="project-entry"><section id="overview"><div class="paper-meta">PROJECT / ${escapeHTML(p.topic)} / ${escapeHTML(p.date)}</div><h2 class="paper-title">${escapeHTML(p.title)}</h2><div class="tags">${p.tags.map(t => `<span>${escapeHTML(t)}</span>`).join('')}</div><p class="project-summary">${escapeHTML(p.summary)}</p>${repoHTML}</section><section id="idea"><h3>My role</h3><blockquote>${escapeHTML(p.role)}</blockquote></section><section id="takeaways"><h3>Implementation</h3><ul>${p.implementation.map(n => `<li>${escapeHTML(n)}</li>`).join('')}</ul></section><section id="questions"><h3>Technology stack</h3><ul>${p.stack.map(n => `<li>${escapeHTML(n)}</li>`).join('')}</ul></section></article>`;
  requestAnimationFrame(updateToc);
}

search.addEventListener('input', render);
addEventListener('popstate', () => {
  selected = new URL(location.href).searchParams.get('project') || data[0]?.id;
  render();
});
render();
