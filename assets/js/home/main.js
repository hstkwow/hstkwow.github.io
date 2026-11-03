// Home: shared navigation and themes, plus the interactive Earth.
import '../core/site.js';
import { initGlobe } from './globe.js';

const globe = document.getElementById('globe');
if (globe) initGlobe(globe);

import { escapeHTML as esc } from '../core/dom.js';

async function loadPreviews() {
  try {
    const response = await fetch(new URL('../../data/home.json', import.meta.url), { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Home data: ${response.status}`);
    const data = await response.json();
    document.getElementById('home-projects').innerHTML = data.projects.map(project => `<article class="home-preview"><h3><a href="${esc(project.url)}">${esc(project.name)}</a></h3><p>${esc(project.description)}</p><div class="preview-meta"><span class="preview-language"><span class="language-dot" aria-hidden="true"></span>${esc(project.language)}</span><span aria-label="${esc(project.stars)} GitHub stars">★ ${esc(project.stars)}</span></div></article>`).join('') || '<p class="preview-status">No pinned projects yet.</p>';
    document.getElementById('home-reading').innerHTML = data.reading.map(note => `<article class="home-preview"><h3><a href="papers.html?note=${encodeURIComponent(note.id)}">${esc(note.title)}</a></h3><p>${esc(note.summary)}</p><div class="preview-meta"><span class="preview-topic">${esc(note.topic)}</span><span>Updated <time datetime="${esc(note.updated_at)}">${esc(new Intl.DateTimeFormat('en', { year:'numeric', month:'short', day:'numeric', timeZone:'Asia/Shanghai' }).format(new Date(note.updated_at)))}</time></span></div></article>`).join('') || '<p class="preview-status">No notes yet.</p>';
  } catch (error) {
    for (const id of ['home-projects', 'home-reading']) document.getElementById(id).innerHTML = '<p class="preview-status">Preview unavailable. Use the link above to browse.</p>';
    console.warn(error);
  }
}
loadPreviews();
