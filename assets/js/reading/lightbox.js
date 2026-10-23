// Figure viewer with zoom and pan: wheel or pinch to zoom, drag to pan, double-click to toggle.
const viewer = document.getElementById('image-viewer');
const image = document.getElementById('full-image');
const stage = document.getElementById('image-stage');
const readout = document.getElementById('image-zoom');
let scale = 1, x = 0, y = 0;
const pointers = new Map();
let pinch = null, drag = null;

function apply() {
  image.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  stage.classList.toggle('zoomed', scale > 1.001);
  readout.textContent = Math.round(scale * 100) + '%';
}
function clampPan() {
  const r = stage.getBoundingClientRect(), w = image.offsetWidth * scale, h = image.offsetHeight * scale;
  const mx = Math.max(0, (w - r.width) / 2), my = Math.max(0, (h - r.height) / 2);
  x = Math.min(mx, Math.max(-mx, x)); y = Math.min(my, Math.max(-my, y));
}
// Zoom around a point given in stage-centred coordinates so it stays under the cursor.
function zoomAt(next, px = 0, py = 0) {
  next = Math.min(8, Math.max(1, next));
  x = px - (px - x) * next / scale; y = py - (py - y) * next / scale; scale = next;
  clampPan(); apply();
}
function local(e) { const r = stage.getBoundingClientRect(); return [e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2]; }
function reset() { scale = 1; x = y = 0; apply(); }

stage.addEventListener('wheel', e => { e.preventDefault(); zoomAt(scale * Math.exp(-e.deltaY * 0.0015), ...local(e)); }, { passive: false });
stage.addEventListener('dblclick', e => zoomAt(scale > 1.5 ? 1 : 2.5, ...local(e)));
stage.addEventListener('pointerdown', e => {
  stage.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, e);
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), s: scale }; drag = null; }
  else drag = { x: e.clientX - x, y: e.clientY - y };
});
stage.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, e);
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const [cx, cy] = local({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 });
    zoomAt(pinch.s * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.d, cx, cy);
  } else if (drag && scale > 1) { x = e.clientX - drag.x; y = e.clientY - drag.y; clampPan(); apply(); }
});
function release(e) { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; if (!pointers.size) drag = null; }
stage.addEventListener('pointerup', release);
stage.addEventListener('pointercancel', release);

viewer.addEventListener('keydown', e => {
  if (e.key === '+' || e.key === '=') zoomAt(scale * 1.25);
  else if (e.key === '-') zoomAt(scale / 1.25);
  else if (e.key === '0') reset();
});
document.getElementById('zoom-in').addEventListener('click', () => zoomAt(scale * 1.25));
document.getElementById('zoom-out').addEventListener('click', () => zoomAt(scale / 1.25));
document.getElementById('zoom-reset').addEventListener('click', reset);
document.getElementById('close-image').addEventListener('click', () => viewer.close());
viewer.addEventListener('click', e => { if (e.target === viewer) viewer.close(); });
viewer.addEventListener('close', () => { image.removeAttribute('src'); });

export function openImage(source) {
  reset();
  // Show the lightweight copy at once, then swap in the original screenshot when it arrives.
  image.src = source.currentSrc || source.src;
  image.alt = source.alt;
  document.getElementById('image-caption').textContent = source.alt || '';
  viewer.showModal();
  const full = source.dataset.full;
  if (full) { const hi = new Image(); hi.onload = () => { if (viewer.open && image.alt === source.alt) image.src = hi.src; }; hi.src = full; }
}
