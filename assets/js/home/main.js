// Homepage: an opening sequence, the live globe, and the orbital thread that runs through the sections.
import '../core/site.js';
import { motion, scramble, splitRise, onEnter } from '../core/fx.js';
import { initGlobe } from './globe.js';
import { initRail } from './rail.js';

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

// The satellite rides the thread at the reader's eye line (see rail.js); waypoints it has passed
// are filled in, and the large section numerals drift at a slower rate than the text.
if (thread) {
  const readout = thread.querySelector('.sat-read');
  const rail = initRail(thread);
  const wide = matchMedia('(min-width: 1000px)');
  let queued = false, settled = false;
  const update = () => {
    queued = false;
    const r = thread.getBoundingClientRect();
    // The satellite sits at the reader's eye line, but the page may end before the eye line
    // reaches the bottom of the track. Rather than speeding up at the end, run the whole track
    // at one constant rate that arrives exactly when the page does.
    const eye = innerHeight * 0.45;
    const maxScroll = document.documentElement.scrollHeight - innerHeight;
    const reachable = eye + maxScroll - (r.top + scrollY);
    const rate = reachable > 0 && reachable < r.height ? r.height / reachable : 1;
    const p = Math.max(0, Math.min(r.height, (eye - r.top) * rate));
    let current = null;
    waypoints.forEach(el => {
      const marker = el.querySelector('.section-no');
      const passed = !!marker && marker.getBoundingClientRect().top - r.top < p;
      // Passing a waypoint on the way down pings it; the state found on load does not.
      if (settled && passed && !el.classList.contains('passed') && motion()) {
        el.classList.remove('ping'); void el.offsetWidth; el.classList.add('ping');
        setTimeout(() => el.classList.remove('ping'), 950);
        const m = marker.getBoundingClientRect();
        rail.ping(m.top + m.height / 2 + scrollY);
      }
      el.classList.toggle('passed', passed);
      if (passed) current = el;
      if (wide.matches && motion()) {
        const b = el.getBoundingClientRect();
        el.style.setProperty('--shift', ((b.top + b.height / 2 - innerHeight / 2) * 0.14).toFixed(1) + 'px');
      }
    });
    waypoints.forEach(el => el.classList.toggle('current', el === current));
    if (readout) readout.textContent = Math.round(p / r.height * 100) + '%';
    rail.setProgress(p);
    settled = true;
    // Safety net for the section reveals: anything already on screen or above it is shown,
    // whether or not an IntersectionObserver ever reported it.
    for (const el of waypoints) if (el.classList.contains('reveal') && !el.classList.contains('in-view') && el.getBoundingClientRect().top < innerHeight * 0.92) reveal(el);
  };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update);
  update();
}

// Sections: children settle in one after another, the heading is wiped in, the label decodes.
// Reveals happen once and are never undone, so content can't be left hidden.
function decode(el) {
  if (el.dataset.decoded) return;
  el.dataset.decoded = '1';
  scramble(el.querySelector('.section-no'), 650);
}
function reveal(el) {
  el.classList.add('in-view');
  decode(el);
}
addEventListener('pageshow', () => waypoints.forEach(el => { if (el.getBoundingClientRect().top < innerHeight) reveal(el); }));
if (motion()) {
  waypoints.forEach(el => {
    el.classList.add('reveal');
    [...el.children].forEach((child, i) => child.style.setProperty('--i', i));
  });
  onEnter(waypoints, decode);
}
