// Shared initialization for Home, Projects and Reading.
import { $, reducedMotion } from './dom.js';
import { initPalette } from './palette.js';

// Theme: the inline <head> script applies the stored choice before first paint; the button
// shows a sun or a moon through CSS.
(() => {
  const button = $('theme');
  if (!button) return;
  function set(dark, store) {
    document.documentElement.classList.toggle('dark', dark);
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    button.title = dark ? 'Light theme' : 'Dark theme';
    if (store) try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch {}
    document.dispatchEvent(new CustomEvent('themechange', { detail: { dark } }));
  }
  set(document.documentElement.classList.contains('dark'), false);
  button.addEventListener('click', () => set(!document.documentElement.classList.contains('dark'), true));
})();

// Capsule navigation: a highlight slides to the hovered link and settles back on the current page.
(() => {
  const masthead = document.querySelector('.masthead');
  const nav = masthead?.querySelector('nav');
  const pill = nav?.querySelector('.nav-indicator');
  if (!pill) return;
  const current = nav.querySelector('[aria-current="page"]');
  function moveTo(link, instant) {
    if (!link) { pill.style.opacity = '0'; return; }
    if (instant || reducedMotion()) pill.style.transition = 'none';
    pill.style.opacity = '1';
    pill.style.width = link.offsetWidth + 'px';
    pill.style.transform = `translateX(${link.offsetLeft}px)`;
    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => pill.style.removeProperty('transition')));
  }
  nav.addEventListener('pointerover', e => { const a = e.target.closest('a'); if (a) moveTo(a); });
  nav.addEventListener('focusin', e => { const a = e.target.closest('a'); if (a) moveTo(a); });
  nav.addEventListener('pointerleave', () => moveTo(current));
  nav.addEventListener('focusout', e => { if (!nav.contains(e.relatedTarget)) moveTo(current); });
  // Place the highlight once fonts have settled so its width matches the link.
  moveTo(current, true);
  document.fonts?.ready.then(() => moveTo(current, true));
  addEventListener('resize', () => moveTo(current, true));
  // The capsule gains a little depth once the page has scrolled beneath it.
  const onScroll = () => masthead.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

initPalette();
