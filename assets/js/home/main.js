// Home: shared navigation and themes, interactive Earth, and live previews.
import '../core/site.js';
import { escapeHTML as esc } from '../core/dom.js';
import { initGlobe } from './globe.js';

const globe = document.getElementById('globe');
if (globe) initGlobe(globe);

const dateFormatter = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'Asia/Shanghai',
});

async function loadPreviews() {
  try {
    const response = await fetch(new URL('../../data/home.json', import.meta.url), { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Home data: ${response.status}`);
    const data = await response.json();

    document.getElementById('home-projects').innerHTML = data.projects.map(project => {
      const lang = project.language
        ? `<span class="preview-language"><span class="language-dot" aria-hidden="true"></span>${esc(project.language)}</span>`
        : '';
      return `<article class="home-preview"><h3><a href="${esc(project.url)}" target="_blank" rel="noopener noreferrer">${esc(project.name)}<span class="preview-arrow" aria-hidden="true">↗</span></a></h3><p>${esc(project.description)}</p><div class="preview-meta">${lang}<span aria-label="${esc(project.stars)} GitHub stars">★ ${esc(project.stars)}</span></div></article>`;
    }).join('') || '<p class="preview-status">No pinned projects yet.</p>';

    document.getElementById('home-reading').innerHTML = data.reading.map(note => {
      const kindLabel = note.kind === 'blog' ? 'Article' : note.kind === 'concept' ? 'Note' : 'Paper note';
      const formattedDate = note.updated_at ? dateFormatter.format(new Date(note.updated_at)) : '';
      return `<article class="home-preview"><h3><a href="papers.html?note=${encodeURIComponent(note.id)}">${esc(note.title)}</a></h3><p>${esc(note.summary)}</p><div class="preview-meta"><span class="preview-topic">${esc(kindLabel)} · ${esc(note.topic)}</span>${formattedDate ? `<span>Updated <time datetime="${esc(note.updated_at)}">${esc(formattedDate)}</time></span>` : ''}</div></article>`;
    }).join('') || '<p class="preview-status">No posts yet.</p>';
  } catch (error) {
    for (const id of ['home-projects', 'home-reading']) {
      document.getElementById(id).innerHTML = '<p class="preview-status">Preview unavailable. Use the link above to browse.</p>';
    }
    console.warn(error);
  }
}
loadPreviews();
