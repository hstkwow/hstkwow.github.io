// Homepage: shared chrome, the live globe, and sections that settle in as they scroll into view.
import '../core/site.js';
import { reducedMotion } from '../core/dom.js';
import { initGlobe } from './globe.js';

const globe = document.getElementById('globe');
if (globe) initGlobe(globe);

if (!reducedMotion() && 'IntersectionObserver' in window) {
  const blocks = document.querySelectorAll('.home-profile section, .explore-panel, .home-contact');
  const io = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('in-view');
    io.unobserve(entry.target);
  }), { rootMargin: '0px 0px -8% 0px' });
  blocks.forEach((el, i) => { el.classList.add('reveal'); el.style.setProperty('--d', `${(i % 3) * 70}ms`); io.observe(el); });
}
