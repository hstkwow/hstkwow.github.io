// Homepage: an opening sequence, the live globe, and the orbital thread that runs through the sections.
import '../core/site.js';
import { motion, scramble, splitRise, onEnter } from '../core/fx.js';
import { initGlobe } from './globe.js';

// Opening: the name rises letter by letter while the labels decode.
splitRise(document.querySelector('.home h1'), { delay: 180 });
setTimeout(() => scramble(document.querySelector('.home header .eyebrow'), 900), 60);

const globe = document.getElementById('globe');
if (globe) initGlobe(globe);

const thread = document.querySelector('.thread');
const waypoints = thread ? [...thread.querySelectorAll('.home-profile > section, .home-explore > .explore-panel, .home-contact')] : [];
waypoints.forEach(el => {
  const no = el.querySelector('.section-no')?.textContent.match(/^\d+/)?.[0];
  if (no) el.dataset.no = no;
});

// The satellite rides the thread at the reader's eye line; waypoints it has passed are filled in,
// and the large section numerals drift at a slower rate than the text. The craft banks with
// scroll speed and levels out again; a readout beneath it gives the share of the track covered.
if (thread) {
  const readout = thread.querySelector('.sat-read');
  const wide = matchMedia('(min-width: 1000px)');
  let queued = false, lastY = scrollY, tilt = 0, settling = 0;
  const update = () => {
    queued = false;
    const r = thread.getBoundingClientRect();
    const remain = document.documentElement.scrollHeight - innerHeight - scrollY;
    const k = Math.max(0, 1 - remain / 360);
    const p = Math.max(0, Math.min(r.height, innerHeight * (0.45 + 0.55 * k) + 240 * k - r.top));
    thread.style.setProperty('--p', p.toFixed(1) + 'px');
    let current = null, index = 0;
    waypoints.forEach((el, i) => {
      const marker = el.querySelector('.section-no');
      const passed = !!marker && marker.getBoundingClientRect().top - r.top < p;
      if (passed && !el.classList.contains('passed') && motion()) {
        el.classList.remove('ping'); void el.offsetWidth; el.classList.add('ping');
        setTimeout(() => el.classList.remove('ping'), 950);
      }
      el.classList.toggle('passed', passed);
      if (passed) { current = el; index = i + 1; }
      if (wide.matches && motion()) {
        const b = el.getBoundingClientRect();
        el.style.setProperty('--shift', ((b.top + b.height / 2 - innerHeight / 2) * 0.14).toFixed(1) + 'px');
      }
    });
    waypoints.forEach(el => el.classList.toggle('current', el === current));
    if (readout) readout.textContent = Math.round(p / r.height * 100) + '%';
    // Bank in proportion to scroll speed, then ease back to level.
    if (motion()) {
      tilt += (Math.max(-9, Math.min(9, (scrollY - lastY) * 0.4)) - tilt) * 0.3;
      lastY = scrollY;
      thread.style.setProperty('--tilt', tilt.toFixed(2) + 'deg');
      if (Math.abs(tilt) > 0.15) { cancelAnimationFrame(settling); settling = requestAnimationFrame(update); }
    }
  };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update);
  update();
}

// Sections: children settle in one after another, the heading is wiped in, the label decodes.
if (motion()) {
  waypoints.forEach(el => {
    el.classList.add('reveal');
    [...el.children].forEach((child, i) => child.style.setProperty('--i', i));
  });
  onEnter(waypoints, el => scramble(el.querySelector('.section-no'), 650));
}
