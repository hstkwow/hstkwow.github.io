// FIG. 01 — Earth, in perspective.
//
// An ink-drawn globe: land as a dot matrix, a faint graticule, and a sun-synchronous satellite
// whose ground track and imaging swath trail across the surface while the Earth turns beneath
// the orbit. Drawn with the page's own colour tokens so it reads as part of the print.
import { POINTS, LAND } from '../../data/land.js';
import { reducedMotion } from '../core/dom.js';

const RAD = Math.PI / 180;
const ORBIT_SECONDS = 18;          // one revolution of the satellite
const EARTH_SECONDS = 120;         // one turn of the Earth (wildly accelerated)
const INCLINATION = 98 * RAD;      // sun-synchronous
const NODE = 40 * RAD;             // right ascension of the ascending node
const ALTITUDE = 1.42;             // orbit radius in Earth radii, exaggerated for legibility
const HOME = { lat: 39.07, lon: 117.10, name: 'TIANJIN' };

// Fibonacci-sphere land dots as unit vectors in the Earth-fixed frame.
function landPoints() {
  const bits = Uint8Array.from(atob(LAND), c => c.charCodeAt(0));
  const golden = Math.PI * (3 - Math.sqrt(5)), out = [];
  for (let i = 0; i < POINTS; i++) {
    if (!(bits[i >> 3] >> (i & 7) & 1)) continue;
    const y = 1 - 2 * (i + 0.5) / POINTS, lon = (i * golden) % (2 * Math.PI) - Math.PI;
    out.push(lon, Math.asin(y));
  }
  return Float32Array.from(out);
}

function colour(name) {
  const probe = document.createElement('span');
  probe.style.cssText = `color:var(${name});display:none`;
  document.body.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value.match(/[\d.]+/g).slice(0, 3).join(',');
}

const fmt = (v, pos, neg) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? pos : neg}`;

export function initGlobe(figure) {
  const canvas = figure.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const readout = figure.querySelector('[data-readout]');
  if (!ctx) return false;
  const land = landPoints();
  const still = reducedMotion();
  const state = {
    w: 0, h: 0, dpr: 1, yaw: -HOME.lon * RAD + 0.35, pitch: 0.42, spin: 0, drag: null, hover: null,
    t: still ? 4.2 : 0, last: performance.now(), visible: true, frame: 0, ink: '', accent: '', paper: '',
  };
  function theme() { state.ink = colour('--ink'); state.accent = colour('--accent'); state.paper = colour('--paper'); }
  theme();

  function resize() {
    const r = canvas.getBoundingClientRect();
    state.dpr = Math.min(devicePixelRatio || 1, 2);
    state.w = r.width; state.h = r.height;
    canvas.width = Math.round(r.width * state.dpr); canvas.height = Math.round(r.height * state.dpr);
  }

  // Earth-fixed (lon, lat) → screen, given the current Earth rotation θ.
  function project(lon, lat, k, theta, view) {
    const L = lon + theta + state.yaw, c = Math.cos(lat);
    const x = c * Math.sin(L), y = Math.sin(lat), z = c * Math.cos(L);
    const sp = Math.sin(state.pitch), cp = Math.cos(state.pitch);
    view.x = view.cx + x * k * view.R;
    view.y = view.cy - (y * cp - z * sp) * k * view.R;
    view.z = y * sp + z * cp;
    return view;
  }
  // Satellite position (inertial unit vector) at argument of latitude u.
  function orbit(u) {
    const cu = Math.cos(u), su = Math.sin(u), ci = Math.cos(INCLINATION), si = Math.sin(INCLINATION);
    const x = cu * Math.sin(NODE) + su * ci * Math.cos(NODE), y = su * si, z = cu * Math.cos(NODE) - su * ci * Math.sin(NODE);
    return { lat: Math.asin(y), L: Math.atan2(x, z) };
  }
  const thetaAt = t => 2 * Math.PI * t / EARTH_SECONDS;
  const uAt = t => 2 * Math.PI * t / ORBIT_SECONDS + 1.1;

  function draw() {
    const { w, h, dpr, ink, accent } = state;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const R = Math.min(w * 0.3, h * 0.36), view = { cx: w / 2, cy: h / 2, R, x: 0, y: 0, z: 0 };
    const theta = thetaAt(state.t);

    // Drafting grid behind the figure, as in the printed version.
    ctx.strokeStyle = `rgba(${ink},.07)`; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = (w / 2) % 20; x < w; x += 20) { ctx.moveTo(Math.round(x) + .5, 0); ctx.lineTo(Math.round(x) + .5, h); }
    for (let y = (h / 2) % 20; y < h; y += 20) { ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(w, Math.round(y) + .5); }
    ctx.stroke();
    // Cross-hair ticks at the frame edges.
    ctx.strokeStyle = `rgba(${ink},.45)`;
    ctx.beginPath();
    ctx.moveTo(8, h / 2); ctx.lineTo(40, h / 2); ctx.moveTo(w - 40, h / 2); ctx.lineTo(w - 8, h / 2);
    ctx.moveTo(w / 2, 6); ctx.lineTo(w / 2, 20); ctx.moveTo(w / 2, h - 20); ctx.lineTo(w / 2, h - 6);
    ctx.stroke();

    // Disc and limb.
    ctx.fillStyle = `rgb(${state.paper})`;
    ctx.beginPath(); ctx.arc(view.cx, view.cy, R, 0, 2 * Math.PI); ctx.fill();
    ctx.strokeStyle = `rgba(${ink},.85)`; ctx.lineWidth = 1.3; ctx.stroke();

    // Graticule: front hemisphere only.
    ctx.strokeStyle = `rgba(${ink},.16)`; ctx.lineWidth = .8;
    ctx.beginPath();
    const p = { ...view };
    const line = (lon0, lat0, lon1, lat1, steps) => {
      let pen = false;
      for (let s = 0; s <= steps; s++) {
        const f = s / steps;
        project(lon0 + (lon1 - lon0) * f, lat0 + (lat1 - lat0) * f, 1, theta, p);
        if (p.z > 0) { pen ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); pen = true; } else pen = false;
      }
    };
    for (let lon = -180; lon < 180; lon += 30) line(lon * RAD, -80 * RAD, lon * RAD, 80 * RAD, 48);
    for (let lat = -60; lat <= 60; lat += 30) line(-Math.PI, lat * RAD, Math.PI, lat * RAD, 120);
    ctx.stroke();

    // Land dots, shaded by their angle to the viewer.
    const size = Math.max(1.1, R / 120);
    for (let i = 0; i < land.length; i += 2) {
      project(land[i], land[i + 1], 1, theta, p);
      if (p.z <= 0.02) continue;
      ctx.fillStyle = `rgba(${ink},${(0.18 + 0.72 * p.z).toFixed(2)})`;
      ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    }

    // Ground track and swath over the last orbit and a bit, fading with age.
    const now = state.t, track = 150, span = ORBIT_SECONDS * 1.15;
    ctx.lineCap = 'round';
    for (const [width, alpha] of [[R * 0.075, 0.13], [1.2, 0.85]]) {
      ctx.lineWidth = width;
      let prev = null;
      for (let s = 0; s <= track; s++) {
        const t = now - span * (1 - s / track), o = orbit(uAt(t));
        project(o.L - thetaAt(t), o.lat, 1, theta, p);
        if (p.z > 0 && prev) {
          ctx.strokeStyle = `rgba(${accent},${(alpha * (s / track) * Math.min(1, p.z * 3)).toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        }
        prev = p.z > 0 ? { x: p.x, y: p.y } : null;
      }
    }

    // Home marker.
    project(HOME.lon * RAD, HOME.lat * RAD, 1, theta, p);
    const sat = orbit(uAt(now)), satLon = sat.L - theta;
    const near = Math.acos(Math.min(1, Math.sin(sat.lat) * Math.sin(HOME.lat * RAD) + Math.cos(sat.lat) * Math.cos(HOME.lat * RAD) * Math.cos(satLon - HOME.lon * RAD))) < 9 * RAD;
    if (p.z > 0.05) {
      ctx.strokeStyle = `rgb(${accent})`; ctx.lineWidth = 1.2;
      ctx.strokeRect(p.x - 3, p.y - 3, 6, 6);
      if (near) {
        const pulse = (state.t * 1.6) % 1;
        ctx.strokeStyle = `rgba(${accent},${(1 - pulse).toFixed(2)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4 + pulse * 16, 0, 2 * Math.PI); ctx.stroke();
      }
      const label = near ? `${HOME.name} · OVERPASS` : HOME.name;
      ctx.font = '9px "Courier New", monospace';
      ctx.fillStyle = `rgba(${state.paper},.85)`;
      ctx.fillRect(p.x + 7, p.y - 16, ctx.measureText(label).width + 4, 12);
      ctx.fillStyle = `rgb(${near ? accent : ink})`;
      ctx.fillText(label, p.x + 9, p.y - 7);
    }

    // Orbit ring: solid where it is in front of or beside the globe, dashed where hidden.
    const steps = 180, ring = [];
    for (let s = 0; s <= steps; s++) {
      const o = orbit(s / steps * 2 * Math.PI), q = project(o.L - theta, o.lat, ALTITUDE, theta, { ...view });
      q.hidden = q.z < 0 && Math.hypot(q.x - view.cx, q.y - view.cy) < R;
      ring.push(q);
    }
    ctx.lineWidth = 1.1;
    for (let s = 1; s <= steps; s++) {
      const a = ring[s - 1], b = ring[s];
      ctx.setLineDash(b.hidden ? [] : [5, 4]);
      ctx.strokeStyle = b.hidden ? `rgba(${accent},.15)` : `rgba(${accent},${b.z < 0 ? .45 : .9})`;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.setLineDash([]);

    // Satellite with its imaging beam down to the swath.
    const sp = project(satLon, sat.lat, ALTITUDE, theta, { ...view });
    const hidden = sp.z < 0 && Math.hypot(sp.x - view.cx, sp.y - view.cy) < R;
    const ahead = orbit(uAt(now + 0.05)), ap = project(ahead.L - thetaAt(now + 0.05), ahead.lat, ALTITUDE, theta, { ...view });
    const nadir = project(satLon, sat.lat, 1, theta, { ...view });
    if (!hidden && nadir.z > 0) {
      const dx = ap.x - sp.x, dy = ap.y - sp.y, n = Math.hypot(dx, dy) || 1, half = R * 0.045;
      const gx = -dy / n * half, gy = dx / n * half;
      ctx.fillStyle = `rgba(${accent},.12)`; ctx.strokeStyle = `rgba(${accent},.5)`; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(nadir.x + gx, nadir.y + gy); ctx.lineTo(nadir.x - gx, nadir.y - gy); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    ctx.save();
    ctx.translate(sp.x, sp.y);
    ctx.rotate(Math.atan2(ap.y - sp.y, ap.x - sp.x) + Math.PI / 2);
    ctx.globalAlpha = hidden ? 0.25 : 1;
    ctx.fillStyle = `rgb(${state.paper})`; ctx.strokeStyle = `rgb(${ink})`; ctx.lineWidth = 1.2; ctx.lineJoin = 'round';
    const s = Math.max(0.55, R / 190);
    ctx.scale(s, s);
    for (const [x, y, rw, rh] of [[-6, -5, 12, 10], [-22, -7, 13, 14], [9, -7, 13, 14]]) { ctx.fillRect(x, y, rw, rh); ctx.strokeRect(x, y, rw, rh); }
    ctx.beginPath(); ctx.moveTo(-15.5, -7); ctx.lineTo(-15.5, 7); ctx.moveTo(15.5, -7); ctx.lineTo(15.5, 7); ctx.moveTo(0, -5); ctx.lineTo(0, -11); ctx.stroke();
    ctx.restore();

    // Cursor position on the surface.
    if (state.hover) {
      const { x, y } = state.hover;
      ctx.strokeStyle = `rgba(${accent},.9)`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x - 2, y); ctx.moveTo(x + 2, y); ctx.lineTo(x + 7, y); ctx.moveTo(x, y - 7); ctx.lineTo(x, y - 2); ctx.moveTo(x, y + 2); ctx.lineTo(x, y + 7); ctx.stroke();
    }

    ctx.fillStyle = `rgba(${ink},.8)`; ctx.font = '9px "Courier New", monospace';
    ctx.fillText('OBSERVATION / 001', 10, 18);
    const tag = 'SUN-SYNCHRONOUS · i 98°';
    ctx.fillText(tag, w - 10 - ctx.measureText(tag).width, h - 10);

    // Caption readout, a few times a second.
    if (state.frame++ % 6 === 0) {
      const wrap = v => ((v / RAD + 540) % 360) - 180;
      let text = `SSP ${fmt(sat.lat / RAD, 'N', 'S')} ${fmt(wrap(satLon), 'E', 'W')}`;
      if (state.hover?.lat != null) text = `CURSOR ${fmt(state.hover.lat, 'N', 'S')} ${fmt(state.hover.lon, 'E', 'W')}`;
      if (readout.textContent !== text) readout.textContent = text;
    }
  }

  // Screen → Earth-fixed coordinates (inverse orthographic), or null off the disc.
  function unproject(x, y) {
    const R = Math.min(state.w * 0.3, state.h * 0.36);
    const X = (x - state.w / 2) / R, Y = -(y - state.h / 2) / R, r2 = X * X + Y * Y;
    if (r2 > 1) return null;
    const Z = Math.sqrt(1 - r2), sp = Math.sin(state.pitch), cp = Math.cos(state.pitch);
    const y0 = Y * cp + Z * sp, z0 = -Y * sp + Z * cp;
    const lon = Math.atan2(X, z0) - thetaAt(state.t) - state.yaw;
    return { lat: Math.asin(y0) / RAD, lon: ((lon / RAD + 540) % 360) - 180 };
  }

  function tick(now) {
    state.running = false;
    if (!state.visible) return;
    const dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;
    if (!still) state.t += dt;
    if (!state.drag) { state.yaw += state.spin * dt; state.spin *= Math.pow(0.04, dt); }
    if (state.hover) Object.assign(state.hover, unproject(state.hover.x, state.hover.y) || { lat: null, lon: null });
    draw();
    if (!still || state.drag || Math.abs(state.spin) > 0.002) request();
  }
  function request() { if (!state.running && state.visible) { state.running = true; state.last = performance.now(); requestAnimationFrame(tick); } }

  const local = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', e => {
    state.drag = { ...local(e), time: performance.now() };
    canvas.setPointerCapture(e.pointerId); canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', e => {
    const q = local(e);
    state.hover = e.pointerType === 'mouse' ? { ...q } : null;
    if (state.drag) {
      const R = Math.min(state.w * 0.3, state.h * 0.36), now = performance.now();
      const dYaw = (q.x - state.drag.x) / R, dt = Math.max(1, now - state.drag.time) / 1000;
      state.yaw += dYaw;
      state.pitch = Math.max(-1.2, Math.min(1.2, state.pitch + (q.y - state.drag.y) / R));
      state.spin = dYaw / dt;
      state.drag = { ...q, time: now };
    }
    request();
  });
  const release = () => { state.drag = null; canvas.classList.remove('dragging'); request(); };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => { state.hover = null; request(); });
  canvas.addEventListener('keydown', e => {
    const step = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[e.key];
    if (!step) return;
    e.preventDefault(); state.yaw += step[0]; state.pitch = Math.max(-1.2, Math.min(1.2, state.pitch + step[1])); request();
  });

  document.addEventListener('themechange', () => { theme(); request(); });
  new ResizeObserver(() => { resize(); request(); }).observe(canvas);
  new IntersectionObserver(([entry]) => { state.visible = entry.isIntersecting && !document.hidden; request(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => { state.visible = !document.hidden; request(); });

  figure.querySelector('svg')?.remove();
  canvas.hidden = false;
  resize();
  request();
  return true;
}
