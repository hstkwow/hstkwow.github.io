// Motion vocabulary shared by every page: signals decode and headings are wiped in.
// Everything here is a no-op when the reader prefers reduced motion.
import { reducedMotion } from './dom.js';

export const motion = () => document.documentElement.classList.contains('motion') && !reducedMotion();

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>°·+';

// Decode a short mono label like a telemetry readout settling, left to right.
export function scramble(el, duration = 700) {
  if (!motion() || !el) return;
  const text = el.dataset.text ?? el.textContent;
  el.dataset.text = text;
  if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', text);
  cancelAnimationFrame(el._scramble);
  const start = performance.now();
  const step = now => {
    const f = Math.min(1, (now - start) / duration);
    let out = '';
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === ' ' || f >= 1 || i / text.length < f * 1.15 - 0.15) out += c;
      else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    el.textContent = out;
    if (f < 1) el._scramble = requestAnimationFrame(step);
  };
  el._scramble = requestAnimationFrame(step);
}

// Split a heading into letters that rise out of their own baselines.
export function splitRise(el, { delay = 0, stagger = 38 } = {}) {
  if (!motion() || !el || el.classList.contains('split')) return;
  el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  let i = 0;
  const walk = node => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const word of child.textContent.split(/(\s+)/)) {
          if (!word) continue;
          if (/^\s+$/.test(word)) { frag.append(word); continue; }
          const w = document.createElement('span');
          w.className = 'word';
          w.setAttribute('aria-hidden', 'true');
          for (const ch of word) {
            const c = document.createElement('span');
            c.className = 'ch';
            c.textContent = ch;
            c.style.animationDelay = `${delay + i++ * stagger}ms`;
            w.append(c);
          }
          frag.append(w);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === 1) walk(child);
    }
  };
  walk(el);
  el.classList.add('split');
}

// Add .in-view once an element enters the viewport; call back for extra effects.
export function onEnter(elements, callback, rootMargin = '0px 0px -12% 0px') {
  if (!('IntersectionObserver' in window)) { elements.forEach(el => { el.classList.add('in-view'); callback?.(el); }); return; }
  const io = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('in-view');
    callback?.(entry.target);
    io.unobserve(entry.target);
  }), { rootMargin });
  elements.forEach(el => io.observe(el));
}
