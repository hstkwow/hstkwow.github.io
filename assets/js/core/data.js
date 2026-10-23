// Reading data: a small manifest up front, note bodies and full-text search on demand.
const BASE = new URL('../../data/reading/', import.meta.url);
const bodies = new Map();
let manifest = null, search = null;

function json(url, init) {
  return fetch(url, init).then(r => { if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); });
}
// The manifest revalidates on every visit so a newly published note appears immediately.
export function loadManifest() {
  manifest ??= json(new URL('manifest.json', BASE), { cache: 'no-cache' }).catch(e => { manifest = null; throw e; });
  return manifest;
}
// Note bodies are content-versioned, so the normal HTTP cache is always safe to use.
export function loadNote(note) {
  if (!bodies.has(note.id)) bodies.set(note.id, json(new URL(`${note.file}?v=${note.v}`, BASE)).catch(e => { bodies.delete(note.id); throw e; }));
  return bodies.get(note.id);
}
export function loadSearch() {
  search ??= json(new URL('search.json', BASE), { cache: 'no-cache' }).catch(() => { search = null; return {}; });
  return search;
}
