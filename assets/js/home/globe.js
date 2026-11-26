// FIG. 01 — Earth, in perspective.
//
// An ink-drawn globe: land as a dot matrix, a faint graticule, and a sun-synchronous satellite
// whose ground track and imaging swath trail across the surface while the Earth turns beneath
// the orbit. Drawn with the page's own colour tokens so it reads as part of the print.
import { POINTS, LAND } from '../../data/land.js';
import { reducedMotion } from '../core/dom.js';

const RAD = Math.PI / 180;
const ORBIT_SECONDS = 18;          // one revolution of the satellite
const EARTH_SECONDS = 120;         // one turn of the Earth (accelerated)
const INCLINATION = 98 * RAD;      // sun-synchronous
const NODE = 240 * RAD;            // right ascension of the ascending node
const ALTITUDE = 1.2;              // orbit radius in Earth radii, exaggerated for legibility
const HOME = { lat: 39.07, lon: 117.10, name: 'TIANJIN' };
const DEFAULT_YAW = -HOME.lon * RAD + 0.35;
const DEFAULT_PITCH = 0.42;
const DOT_BUCKETS = 12;

// Precompute (lon, sin(lat), cos(lat)) for each land point once so per-frame projection avoids
// redundant trig on latitude across thousands of dots.
function landPoints() {
  const bits = Uint8Array.from(atob(LAND), c => c.charCodeAt(0));
  const golden = Math.PI * (3 - Math.sqrt(5)), out = [];
  for (let i = 0; i < POINTS; i++) {
    if (!(bits[i >> 3] >> (i & 7) & 1)) continue;
    const sinLat = 1 - 2 * (i + 0.5) / POINTS;
    const cosLat = Math.sqrt(Math.max(0, 1 - sinLat * sinLat));
    const lon = (i * golden) % (2 * Math.PI) - Math.PI;
    out.push(lon, sinLat, cosLat);
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
  const buckets = Array.from({ length: DOT_BUCKETS }, () => []);
  const state = {
    w: 0, h: 0, dpr: 1,
    yaw: DEFAULT_YAW, pitch: DEFAULT_PITCH, spin: 0,
    drag: null, hover: null,
    t: still ? 4.2 : 0, intro: still ? 99 : 0,
    cxf: 0.5, last: performance.now(),
    inView: true, visible: !document.hidden,
    frame: 0, running: false,
    ink: '', accent: '', paper: '',
    inkRGB: [0, 0, 0], paperRGB: [255, 255, 255],
    dotStyles: [],
  };

  function theme() {
    state.ink = colour('--ink');
    state.accent = colour('--accent');
    state.paper = colour('--paper');
    state.inkRGB = state.ink.split(',').map(Number);
    state.paperRGB = state.paper.split(',').map(Number);
    state.dotStyles = Array.from({ length: DOT_BUCKETS }, (_, i) => {
      const zMid = (i + 0.5) / DOT_BUCKETS;
      return `rgba(${state.ink},${(0.18 + 0.72 * zMid).toFixed(2)})`;
    });
  }
  theme();

  function syncVisibility() {
    state.visible = state.inView && !document.hidden;
    if (state.visible) request();
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    state.dpr = Math.min(devicePixelRatio || 1, 2);
    state.w = r.width;
    state.h = r.height;
    state.cxf = parseFloat(getComputedStyle(figure).getPropertyValue('--globe-x')) || 0.5;
    canvas.width = Math.round(r.width * state.dpr);
    canvas.height = Math.round(r.height * state.dpr);
  }

  const radius = () => Math.min(state.w * 0.3, state.h * 0.33);

  function project(lon, lat, k, theta, view) {
    const L = lon + theta + state.yaw, c = Math.cos(lat);
    const x = c * Math.sin(L), y = Math.sin(lat), z = c * Math.cos(L);
    const sp = Math.sin(state.pitch), cp = Math.cos(state.pitch);
    view.x = view.cx + x * k * view.R;
    view.y = view.cy - (y * cp - z * sp) * k * view.R;
    view.z = y * sp + z * cp;
    return view;
  }

  function orbit(u) {
    const cu = Math.cos(u), su = Math.sin(u), ci = Math.cos(INCLINATION), si = Math.sin(INCLINATION);
    const x = cu * Math.sin(NODE) + su * ci * Math.cos(NODE);
    const y = su * si;
    const z = cu * Math.cos(NODE) - su * ci * Math.sin(NODE);
    return { lat: Math.asin(y), L: Math.atan2(x, z) };
  }
  const thetaAt = t => 2 * Math.PI * t / EARTH_SECONDS;
  const uAt = t => 2 * Math.PI * t / ORBIT_SECONDS + 1.1;

  // ── The spacecraft ───────────────────────────────────────────────────────────────────────
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const LIGHT = norm([-0.5, 0.75, 0.5]);

  function satVec(t) {
    const o = orbit(uAt(t)), L = o.L + state.yaw, c = Math.cos(o.lat);
    return [c * Math.sin(L), Math.sin(o.lat), c * Math.cos(L)];
  }
  function toView(v) {
    const sp = Math.sin(state.pitch), cp = Math.cos(state.pitch);
    return [v[0], v[1] * cp - v[2] * sp, v[1] * sp + v[2] * cp];
  }

  function buildCraft(t) {
    const parts = [];
    const face = (poly, n, tone, opts = {}) => parts.push({ poly, n, tone, ...opts });
    const line = (p, q, opts = {}) => parts.push({ seg: [p, q], ...opts });
    const lerp = (p, q, k) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k];

    const E = [1.0, 0.85, 1.05];
    for (let axis = 0; axis < 3; axis++) for (const sgn of [1, -1]) {
      const [i, j] = [0, 1, 2].filter(k => k !== axis);
      const corner = (u, w) => { const m = [0, 0, 0]; m[axis] = sgn * E[axis]; m[i] = u * E[i]; m[j] = w * E[j]; return m; };
      const poly = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
      const n = [0, 0, 0]; n[axis] = sgn;
      const detail = [];
      if (axis === 1) for (let k = 1; k < 8; k++) detail.push([corner(-1 + k / 4, -0.8), corner(-1 + k / 4, 0.8)]);
      else for (const k of [-0.4, 0.35]) detail.push([corner(-1, k), corner(1, k + 0.08)]);
      face(poly, n, axis === 1 ? 0.06 : 0.14, { solid: true, detail });
    }

    function cylinder(base, axis, rad, length, sides, tone, cap) {
      const ax = norm(axis), ref = Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
      const u = norm(cross(ax, ref)), w = cross(ax, u), top = add(base, ax, length);
      const ring = (c, r, k) => add(add(c, u, Math.cos(k) * r), w, Math.sin(k) * r);
      for (let s = 0; s < sides; s++) {
        const k0 = s / sides * 2 * Math.PI, k1 = (s + 1) / sides * 2 * Math.PI, km = (k0 + k1) / 2;
        face([ring(base, rad, k0), ring(base, rad, k1), ring(top, rad, k1), ring(top, rad, k0)],
          norm(add(add([0, 0, 0], u, Math.cos(km)), w, Math.sin(km))), tone, { solid: true, facet: true });
      }
      if (cap) face(Array.from({ length: sides }, (_, s) => ring(top, rad, s / sides * 2 * Math.PI)), ax, cap.tone, { solid: true, ...cap });
      return { top, u, w };
    }

    cylinder([0, 0, -E[2]], [0, 0, -1], 0.52, 0.95, 18, 0.1);
    cylinder([0, 0, -E[2] - 0.95], [0, 0, -1], 0.62, 0.32, 18, 0.18, { tone: 0.85, aperture: true });

    for (const side of [1, -1]) cylinder([-0.45, side * 0.42, E[2]], [-0.35, side * 0.45, 1], 0.17, 0.42, 10, 0.12, { tone: 0.6 });

    const boomEnd = [E[0] + 0.45, 0.2, -0.75];
    line([E[0], 0.2, -0.4], boomEnd);
    const dish = Array.from({ length: 16 }, (_, s) => {
      const k = s / 16 * 2 * Math.PI;
      return [boomEnd[0] + Math.cos(k) * 0.38, boomEnd[1] + Math.sin(k) * 0.38, boomEnd[2] - 0.12];
    });
    face(dish, [0, 0, -1], 0.08, { solid: false });

    const beta = 0.5 + 0.3 * Math.sin(t * 0.3), ca = Math.cos(beta), sa = Math.sin(beta);
    const onWing = (s, b) => [s * ca, b, s * sa];
    for (const side of [1, -1]) {
      const root = E[1] + 0.55, pw = 1.3, gap = 0.08, hw = 0.95;
      line([0.0, side * E[1], 0.35], onWing(0, side * root));
      line([0.0, side * E[1], -0.35], onWing(0, side * root));
      line([0.0, side * E[1], 0], onWing(0, side * root));
      for (let k = 0; k < 3; k++) {
        const b0 = side * (root + k * (pw + gap)), b1 = side * (root + k * (pw + gap) + pw);
        const P0 = onWing(-hw, b0), P1 = onWing(hw, b0), P2 = onWing(hw, b1), P3 = onWing(-hw, b1);
        const detail = [];
        for (let c = 1; c < 6; c++) detail.push([lerp(P0, P3, c / 6), lerp(P1, P2, c / 6)]);
        for (let c = 1; c < 4; c++) detail.push([lerp(P0, P1, c / 4), lerp(P3, P2, c / 4)]);
        face([P0, P1, P2, P3], [-sa, 0, ca], 0.42, { panel: true, detail });
        if (k < 2) {
          for (const s of [-0.6, 0.6]) line(onWing(s, b1), onWing(s, b1 + side * gap));
        }
      }
    }
    return parts;
  }

  function drawCraft(view, t, alpha) {
    if (alpha <= 0) return;
    const r = satVec(t), v = norm(add(satVec(t + 0.02), r, -1));
    const vh = norm(add(v, r, -dot(v, r))), nh = cross(r, vh);
    const centre = [r[0] * ALTITUDE, r[1] * ALTITUDE, r[2] * ALTITUDE];
    const S = Math.max(0.035, 13 / view.R);
    const world = m => add(add(add(centre, vh, m[0] * S), nh, m[1] * S), r, m[2] * S);
    const screen = m => { const w = toView(world(m)); return { x: view.cx + w[0] * view.R, y: view.cy - w[1] * view.R, z: w[2] }; };
    const dirView = m => toView(norm(add(add(vh.map(x => x * m[0]), nh, m[1]), r, m[2])));
    const ink = state.inkRGB, paper = state.paperRGB;
    const mix = k => `${Math.round(paper[0] + (ink[0] - paper[0]) * k)},${Math.round(paper[1] + (ink[1] - paper[1]) * k)},${Math.round(paper[2] + (ink[2] - paper[2]) * k)}`;

    const items = buildCraft(t).map(p => {
      if (p.seg) { const a = screen(p.seg[0]), b = screen(p.seg[1]); return { ...p, a, b, z: (a.z + b.z) / 2 }; }
      const pts = p.poly.map(screen);
      return { ...p, pts, nv: dirView(p.n), z: pts.reduce((s, q) => s + q.z, 0) / pts.length };
    }).sort((a, b) => a.z - b.z);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const stroke = (a, b) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
    for (const it of items) {
      if (it.seg) { ctx.strokeStyle = `rgba(${state.ink},.85)`; ctx.lineWidth = 0.8; stroke(it.a, it.b); continue; }
      let n = it.nv;
      if (it.solid && n[2] <= 0) continue;
      const back = n[2] < 0;
      if (back) n = n.map(x => -x);
      const lit = Math.max(0, dot(n, LIGHT));
      let tone = it.panel && back ? 0.1 : it.tone;
      tone = Math.min(0.95, tone + (1 - lit) * (it.panel && !back ? 0.3 : 0.22));
      ctx.fillStyle = it.aperture ? 'rgb(22,22,20)' : `rgb(${mix(tone)})`;
      ctx.beginPath();
      it.pts.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
      ctx.closePath();
      ctx.fill();
      if (it.facet) { ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 0.7; ctx.stroke(); }
      else { ctx.strokeStyle = `rgba(${state.ink},.9)`; ctx.lineWidth = 0.8; ctx.stroke(); }
      if (it.detail && !(it.panel && back)) {
        ctx.strokeStyle = it.panel ? `rgba(${state.paper},${(0.25 + 0.35 * lit).toFixed(2)})` : `rgba(${state.ink},.4)`;
        ctx.lineWidth = 0.5;
        for (const [p, q] of it.detail) stroke(screen(p), screen(q));
      }
      if (it.panel && !back) {
        const sheen = Math.pow(Math.max(0, dot(n, norm(add(LIGHT, [0, 0, 1])))), 18);
        if (sheen > 0.02) { ctx.fillStyle = `rgba(255,255,255,${(sheen * 0.35).toFixed(3)})`; ctx.fill(); }
      }
      if (it.aperture) {
        const c = it.pts.reduce((s, q) => ({ x: s.x + q.x / it.pts.length, y: s.y + q.y / it.pts.length }), { x: 0, y: 0 });
        ctx.fillStyle = `rgb(${state.accent})`;
        ctx.beginPath(); ctx.arc(c.x - 0.8, c.y - 0.8, Math.max(1, S * view.R * 0.12), 0, 2 * Math.PI); ctx.fill();
      }
    }
    ctx.restore();
  }

  // Ground track geometry.
  const A = [Math.sin(NODE), 0, Math.cos(NODE)];
  const B = [Math.cos(INCLINATION) * Math.cos(NODE), Math.sin(INCLINATION), -Math.cos(INCLINATION) * Math.sin(NODE)];
  const ORBIT_N = cross(A, B);
  const SWATH = 4 * RAD;
  function groundAt(t, off = 0) {
    const u = uAt(t), cu = Math.cos(u), su = Math.sin(u), co = Math.cos(off), so = Math.sin(off);
    const v0 = (A[0] * cu + B[0] * su) * co + ORBIT_N[0] * so;
    const v1 = (A[1] * cu + B[1] * su) * co + ORBIT_N[1] * so;
    const v2 = (A[2] * cu + B[2] * su) * co + ORBIT_N[2] * so;
    return { lat: Math.asin(v1), lon: Math.atan2(v0, v2) - thetaAt(t) };
  }

  function draw() {
    const { w, h, dpr, ink, accent } = state;
    if (!w || !h) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const R = radius(), view = { cx: w * state.cxf, cy: h / 2, R, x: 0, y: 0, z: 0 };
    const theta = thetaAt(state.t);
    const I = state.intro, clamp = x => Math.max(0, Math.min(1, x)), ease = x => 1 - Math.pow(1 - x, 3);
    const limb = ease(clamp(I / 0.9)), grat = clamp((I - 0.4) / 0.8), scan = ease(clamp((I - 0.3) / 1.6));
    const trailDrawn = ease(clamp((I - 1.1) / 1.1)), live = clamp((I - 1.9) / 0.5);
    const scanY = view.cy - R + 2 * R * scan;

    // Disc and limb.
    const halo = ctx.createRadialGradient(view.cx, view.cy, R, view.cx, view.cy, R * 1.16);
    halo.addColorStop(0, `rgba(${accent},${(0.1 * limb).toFixed(3)})`);
    halo.addColorStop(1, `rgba(${accent},0)`);
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(view.cx, view.cy, R * 1.16, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = `rgb(${state.paper})`;
    ctx.beginPath(); ctx.arc(view.cx, view.cy, R, 0, 2 * Math.PI); ctx.fill();
    ctx.strokeStyle = `rgba(${ink},.85)`; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(view.cx, view.cy, R, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * limb); ctx.stroke();

    // Graticule: front hemisphere only.
    ctx.strokeStyle = `rgba(${ink},${(0.16 * grat).toFixed(3)})`; ctx.lineWidth = .8;
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

    // Land dots, batched by depth bucket to avoid thousands of fillStyle changes per frame.
    const size = Math.max(1.1, R / 120), halfSize = size / 2;
    const spPitch = Math.sin(state.pitch), cpPitch = Math.cos(state.pitch);
    const rot = theta + state.yaw;
    for (let b = 0; b < DOT_BUCKETS; b++) buckets[b].length = 0;
    for (let i = 0; i < land.length; i += 3) {
      const L = land[i] + rot, sinLat = land[i + 1], cosLat = land[i + 2];
      const z0 = cosLat * Math.cos(L);
      const z = sinLat * spPitch + z0 * cpPitch;
      if (z <= 0.02) continue;
      const py = view.cy - (sinLat * cpPitch - z0 * spPitch) * R;
      if (py > scanY) continue;
      const px = view.cx + cosLat * Math.sin(L) * R;
      const idx = Math.min(DOT_BUCKETS - 1, (z * DOT_BUCKETS) | 0);
      buckets[idx].push(px - halfSize, py - halfSize);
    }
    for (let b = 0; b < DOT_BUCKETS; b++) {
      const pts = buckets[b];
      if (!pts.length) continue;
      ctx.fillStyle = state.dotStyles[b];
      for (let i = 0; i < pts.length; i += 2) ctx.fillRect(pts[i], pts[i + 1], size, size);
    }

    // Imaging scan line during initial intro.
    if (scan > 0 && scan < 1) {
      const half = Math.sqrt(Math.max(0, R * R - (scanY - view.cy) ** 2));
      const glow = ctx.createLinearGradient(0, scanY - 28, 0, scanY);
      glow.addColorStop(0, `rgba(${accent},0)`); glow.addColorStop(1, `rgba(${accent},.22)`);
      ctx.save();
      ctx.beginPath(); ctx.arc(view.cx, view.cy, R, 0, 2 * Math.PI); ctx.clip();
      ctx.fillStyle = glow; ctx.fillRect(view.cx - R, scanY - 28, 2 * R, 28);
      ctx.restore();
      ctx.strokeStyle = `rgb(${accent})`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(view.cx - half - 14, scanY); ctx.lineTo(view.cx + half + 14, scanY); ctx.stroke();
    }
    ctx.globalAlpha = clamp((I - 1.1) / 0.3);

    // Ground track & swath.
    const now = state.t, track = 96, span = ORBIT_SECONDS * 0.5, lead = 30, leadSpan = ORBIT_SECONDS * 0.18;
    const at = (t, off) => { const g = groundAt(t, off); const q = project(g.lon, g.lat, 1, theta, { ...view }); q.lat = g.lat; return q; };
    const step = span / track, base = Math.floor(now / step);
    const samples = [];
    const sample = (t, k) => samples.push({ c: at(t, 0), l: at(t, SWATH), r: at(t, -SWATH), age: (now - t) / span, k });
    for (let k = base - track; k <= base; k++) sample(k * step, k);
    if (now > base * step) sample(now, null);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const seg = (a, b, col, width) => { ctx.strokeStyle = col; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
    const mid = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1], b = samples[i];
      if (b.age > trailDrawn) continue;
      if (a.c.z <= 0 || b.c.z <= 0) continue;
      const fade = Math.pow(Math.max(0, 1 - b.age), 1.3) * Math.min(1, b.c.z * 3);
      if (fade < 0.01) continue;
      if (b.age < 0.22) {
        ctx.fillStyle = `rgba(${accent},${(0.07 * (1 - b.age / 0.22) * fade).toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(a.l.x, a.l.y); ctx.lineTo(b.l.x, b.l.y); ctx.lineTo(b.r.x, b.r.y); ctx.lineTo(a.r.x, a.r.y); ctx.closePath(); ctx.fill();
      }
      seg(a.l, b.l, `rgba(${accent},${(0.28 * fade).toFixed(3)})`, 0.6);
      seg(a.r, b.r, `rgba(${accent},${(0.28 * fade).toFixed(3)})`, 0.6);
      seg(a.c, b.c, `rgba(${accent},${(0.85 * fade).toFixed(3)})`, 1.1);
      if (b.k !== null && b.k % 6 === 0) seg(mid(b.c, b.l, 0.45), mid(b.c, b.r, 0.45), `rgba(${accent},${(0.55 * fade).toFixed(3)})`, 0.8);
      if ((a.c.lat > 0) !== (b.c.lat > 0)) node(b.c, a.c.lat > b.c.lat ? 'DN' : 'AN', fade);
    }

    let prevLead = samples[samples.length - 1].c;
    ctx.setLineDash([2.5, 3]);
    const leadStep = leadSpan / lead, leadBase = Math.floor(now / leadStep);
    for (let s = 1; s <= lead; s++) {
      const t = (leadBase + s) * leadStep, q = at(t, 0), f = Math.max(0, 1 - (t - now) / leadSpan);
      if (q.z > 0 && prevLead.z > 0) seg(prevLead, q, `rgba(${accent},${(0.5 * f * Math.min(1, q.z * 3)).toFixed(3)})`, 0.9);
      if (q.z > 0 && prevLead.z > 0 && (prevLead.lat > 0) !== (q.lat > 0)) { ctx.setLineDash([]); node(q, prevLead.lat > q.lat ? 'DN' : 'AN', f); ctx.setLineDash([2.5, 3]); }
      prevLead = q;
    }
    ctx.setLineDash([]);

    function node(q, label, alpha) {
      if (alpha < 0.05) return;
      ctx.strokeStyle = `rgba(${ink},${(0.75 * alpha).toFixed(3)})`; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(q.x, q.y, 2.6, 0, 2 * Math.PI); ctx.stroke();
      ctx.font = '8px ui-monospace, monospace';
      ctx.fillStyle = `rgba(${ink},${(0.8 * alpha).toFixed(3)})`;
      ctx.fillText(label, q.x + 6, q.y + 3);
    }

    // Home marker (Tianjin).
    ctx.globalAlpha = clamp((I - 1.5) / 0.4);
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
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillStyle = `rgba(${state.paper},.85)`;
      ctx.fillRect(p.x + 7, p.y - 16, ctx.measureText(label).width + 4, 12);
      ctx.fillStyle = `rgb(${near ? accent : ink})`;
      ctx.fillText(label, p.x + 9, p.y - 7);
    }

    // Satellite & imaging beam.
    ctx.globalAlpha = live;
    const sp = project(satLon, sat.lat, ALTITUDE, theta, { ...view });
    const hidden = sp.z < 0 && Math.hypot(sp.x - view.cx, sp.y - view.cy) < R;
    const here = samples[samples.length - 1];
    if (!hidden && here.c.z > 0) {
      ctx.fillStyle = `rgba(${accent},.06)`;
      ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(here.l.x, here.l.y); ctx.lineTo(here.r.x, here.r.y); ctx.closePath(); ctx.fill();
      seg(sp, here.l, `rgba(${accent},.45)`, 0.6);
      seg(sp, here.r, `rgba(${accent},.45)`, 0.6);
    }
    if (here.c.z > 0) {
      seg(here.l, here.r, `rgba(${ink},.9)`, 1);
      ctx.fillStyle = `rgb(${state.paper})`;
      ctx.beginPath(); ctx.arc(here.c.x, here.c.y, 3.6, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = `rgb(${accent})`;
      ctx.beginPath(); ctx.arc(here.c.x, here.c.y, 2.4, 0, 2 * Math.PI); ctx.fill();
    }
    if (!hidden) drawCraft(view, now, live);
    ctx.globalAlpha = 1;

    // Surface hover crosshair.
    if (state.hover) {
      const { x, y } = state.hover;
      ctx.strokeStyle = `rgba(${accent},.9)`; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 7, y); ctx.lineTo(x - 2, y);
      ctx.moveTo(x + 2, y); ctx.lineTo(x + 7, y);
      ctx.moveTo(x, y - 7); ctx.lineTo(x, y - 2);
      ctx.moveTo(x, y + 2); ctx.lineTo(x, y + 7);
      ctx.stroke();
    }

    // Live telemetry readout.
    if (state.frame++ % 6 === 0 && readout) {
      const wrap = v => ((v / RAD + 540) % 360) - 180;
      let text = `SSP ${fmt(sat.lat / RAD, 'N', 'S')} ${fmt(wrap(satLon), 'E', 'W')}`;
      if (state.hover?.lat != null) text = `CURSOR ${fmt(state.hover.lat, 'N', 'S')} ${fmt(state.hover.lon, 'E', 'W')}`;
      if (readout.textContent !== text) readout.textContent = text;
    }
  }

  function unproject(x, y) {
    const R = radius();
    const X = (x - state.w * state.cxf) / R, Y = -(y - state.h / 2) / R, r2 = X * X + Y * Y;
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
    if (!still) { state.t += dt; state.intro += dt; }
    if (!state.drag) { state.yaw += state.spin * dt; state.spin *= Math.pow(0.04, dt); }
    if (state.hover) Object.assign(state.hover, unproject(state.hover.x, state.hover.y) || { lat: null, lon: null });
    draw();
    if (!still || state.intro < 3 || state.drag || Math.abs(state.spin) > 0.002) request();
  }
  function request() { if (!state.running && state.visible) { state.running = true; state.last = performance.now(); requestAnimationFrame(tick); } }

  const local = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', e => {
    state.drag = { ...local(e), time: performance.now() };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', e => {
    const q = local(e);
    state.hover = e.pointerType === 'mouse' ? { ...q } : null;
    if (state.drag) {
      const R = radius(), now = performance.now();
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
  canvas.addEventListener('dblclick', () => {
    state.yaw = DEFAULT_YAW - thetaAt(state.t);
    state.pitch = DEFAULT_PITCH;
    state.spin = 0;
    request();
  });
  canvas.addEventListener('keydown', e => {
    const step = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[e.key];
    if (!step) return;
    e.preventDefault();
    state.yaw += step[0];
    state.pitch = Math.max(-1.2, Math.min(1.2, state.pitch + step[1]));
    request();
  });

  document.addEventListener('themechange', () => { theme(); request(); });
  new ResizeObserver(() => { resize(); request(); }).observe(canvas);
  new IntersectionObserver(([entry]) => { state.inView = entry.isIntersecting; syncVisibility(); }).observe(canvas);
  document.addEventListener('visibilitychange', syncVisibility);

  figure.querySelector('svg')?.remove();
  canvas.hidden = false;
  resize();
  request();
  return true;
}
