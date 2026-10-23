// "Acquisition log": every paper's reading span drawn like a satellite pass schedule.
import { escapeHTML } from '../core/dom.js';

const DAY = 864e5;
const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', month: 'short', day: '2-digit' });

export function timeline(notes, span) {
  const papers = notes.filter(n => n.kind === 'paper' && n.started_at)
    .sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
  if (papers.length < 2) return '';
  const now = Date.now();
  const end = n => n.finished_at ? new Date(n.finished_at).getTime() : now;
  const t0 = Math.min(...papers.map(n => new Date(n.started_at).getTime())) - DAY / 2;
  const t1 = Math.max(...papers.map(end)) + DAY / 2;
  const pos = t => ((t - t0) / (t1 - t0) * 100).toFixed(2);
  // Ticks every few days, aligned to midnight in UTC+08:00.
  const step = Math.max(1, Math.ceil((t1 - t0) / DAY / 7)) * DAY;
  const ticks = [];
  for (let t = Math.ceil((t0 + 8 * 36e5) / DAY) * DAY - 8 * 36e5; t < t1; t += step) ticks.push(`<span style="left:${pos(t)}%">${fmt.format(t)}</span>`);
  const rows = papers.map((n, i) => {
    const s = new Date(n.started_at).getTime(), e = end(n);
    return `<li style="--i:${i}"><a href="papers.html?note=${encodeURIComponent(n.id)}" data-id="${escapeHTML(n.id)}"><span class="acq-name">${escapeHTML(n.title)}</span><span class="acq-track"><span class="acq-bar${n.finished_at ? '' : ' live'}" style="left:${pos(s)}%;width:${Math.max(0.8, pos(e) - pos(s))}%"></span></span><span class="acq-span">${n.finished_at ? escapeHTML(span(n.span_seconds)) : 'live'}</span></a></li>`;
  }).join('');
  return `<figure class="acq-log" aria-label="Reading timeline"><figcaption><span>ACQUISITION LOG</span><span>READING SPANS · UTC+08:00</span></figcaption><div class="acq-axis" aria-hidden="true"><span></span><span class="acq-ticks">${ticks.join('')}</span><span></span></div><ol class="acq-rows">${rows}</ol></figure>`;
}

// Hovering a pass highlights its note card, and the reverse.
export function linkTimeline(root) {
  const set = (id, on) => root.querySelectorAll(`[data-id="${CSS.escape(id)}"]`).forEach(el => el.classList.toggle('linked', on));
  root.addEventListener('pointerover', e => { const el = e.target.closest('[data-id]'); if (el) set(el.dataset.id, true); });
  root.addEventListener('pointerout', e => { const el = e.target.closest('[data-id]'); if (el && !el.contains(e.relatedTarget)) set(el.dataset.id, false); });
}
