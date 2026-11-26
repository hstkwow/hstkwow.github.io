// Shared initialization for Home, Projects, and Blog.
import { $, reducedMotion } from './dom.js';
import { initPalette } from './palette.js';

// Theme toggle + browser theme-color synchronization.
(() => {
  const button = $('theme');
  if (!button) return;
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  function set(dark, store) {
    document.documentElement.classList.toggle('dark', dark);
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    button.title = dark ? 'Light theme' : 'Dark theme';
    if (metaTheme) metaTheme.content = dark ? '#1d1e1c' : '#f4f0e7';
    if (store) try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch {}
    document.dispatchEvent(new CustomEvent('themechange', { detail: { dark } }));
  }
  set(document.documentElement.classList.contains('dark'), false);
  button.addEventListener('click', () => set(!document.documentElement.classList.contains('dark'), true));
})();

// Floating capsule navigation indicator and scroll elevation.
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
  moveTo(current, true);
  document.fonts?.ready.then(() => moveTo(current, true));
  addEventListener('resize', () => moveTo(current, true));

  // Quiet back-to-top button for long pages.
  const topBtn = document.createElement('button');
  topBtn.type = 'button';
  topBtn.className = 'back-to-top';
  topBtn.setAttribute('aria-label', 'Back to top');
  topBtn.title = 'Back to top';
  topBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
  topBtn.addEventListener('click', () => scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' }));
  document.body.append(topBtn);

  const onScroll = () => {
    const y = scrollY;
    masthead.classList.toggle('scrolled', y > 8);
    topBtn.classList.toggle('visible', y > 420);
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

initPalette();
