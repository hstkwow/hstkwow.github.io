// Shared initialization for Home, Projects and Reading.
import { $ } from './dom.js';
import { initPalette } from './palette.js';

// Theme: the inline <head> script applies the stored choice before first paint.
(() => {
  const button = $('theme');
  if (!button) return;
  function set(dark, store) {
    document.documentElement.classList.toggle('dark', dark);
    button.textContent = dark ? 'Light ◑' : 'Dark ◐';
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    if (store) try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch {}
    document.dispatchEvent(new CustomEvent('themechange', { detail: { dark } }));
  }
  set(document.documentElement.classList.contains('dark'), false);
  button.addEventListener('click', () => set(!document.documentElement.classList.contains('dark'), true));
})();

// Show the current page and entry in the compact masthead after its introduction scrolls away.
(() => {
  const masthead = document.querySelector('.masthead');
  if (!masthead) return;
  const current = document.createElement('span');
  current.className = 'nav-context';
  current.setAttribute('aria-hidden', 'true');
  masthead.insertBefore(current, masthead.querySelector('nav'));
  const page = document.body.dataset.page || 'Home';
  const marker = () => document.querySelector('.overview-heading') || document.querySelector('.note-heading') || document.querySelector('.reading-head') || document.querySelector('main > header');
  let scheduled = false;
  function update() {
    scheduled = false;
    const entry = document.querySelector('#detail .paper-title')?.textContent.trim();
    const label = page + ' / ' + (entry || (page === 'Home' ? 'Sun Tao' : page));
    if (current.textContent !== label) { current.textContent = label; current.title = label; }
    const m = marker();
    const passed = m ? m.getBoundingClientRect().bottom <= masthead.getBoundingClientRect().bottom : window.scrollY > 160;
    current.classList.toggle('visible', passed && window.scrollY > 32);
  }
  function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  const detail = $('detail');
  if (detail) new MutationObserver(schedule).observe(detail, { childList: true });
  update();
})();

initPalette();
