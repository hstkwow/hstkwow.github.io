// The homepage track: a satellite orbits the rail at the reader's eye line.
//
// It circles the line in a slightly tilted plane, passing in front of it and behind it,
// foreshortened as it turns. Scrolling spins it faster, and it leaves a soft, tapering helix
// down the rail. Its height follows the scroll with damping, so the helix stays smooth even
// when a mouse wheel moves the page in steps. Passing a section sends a short lock-on ping
// toward that section's label. Everything is drawn on one small canvas that sits over the
// rail; the craft itself is an ink line drawing rendered from SVG.
import { motion } from '../core/fx.js';

const BASE_SPIN = (2 * Math.PI) / 7;   // one revolution every 7 s at rest
const TRAIL_SECONDS = 2.4;
const W = 180;                          // canvas width, centred on the rail

function tokens() {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  document.body.append(probe);
  const read = name => { probe.style.color = `var(${name})`; return getComputedStyle(probe).color.match(/[\d.]+/g).slice(0, 3).map(Number); };
  const out = { ink: read('--ink'), paper: read('--paper'), accent: read('--accent'), line: read('--line') };
  probe.remove();
  return out;
}

// Ink drawing of the craft. 'zenith' is the side facing away from the rail (star trackers,
// the white backs of the wings); 'nadir' is the camera side, lens and sunshade.
function craftSVG(side, c) {
  const mix = k => `rgb(${c.paper.map((p, i) => Math.round(p + (c.ink[i] - p) * k)).join(',')})`;
  const ink = `rgb(${c.ink})`, faint = a => `rgba(${c.ink},${a})`;
  const PW = 9.2, GAP = 1, H = 12, nadir = side === 'nadir';
  let s = '';
  for (const dir of [-1, 1]) {
    let x = dir * 13;
    for (let k = 0; k < 3; k++) {
      const x0 = dir > 0 ? x : x - PW;
      s += `<rect x="${x0}" y="${-H / 2}" width="${PW}" height="${H}" fill="${nadir ? mix(0.24) : mix(0.05)}" stroke="${ink}" stroke-width=".7"/>`;
      if (nadir) {
        for (const j of [1, 2]) s += `<path d="M${x0 + PW * j / 3} ${-H / 2}v${H}" stroke="${faint(0.3)}" stroke-width=".35"/>`;
        for (const y of [-H / 6, H / 6]) s += `<path d="M${x0} ${y}h${PW}" stroke="${faint(0.3)}" stroke-width=".35"/>`;
      } else {
        s += `<rect x="${x0 + 1}" y="${-H / 2 + 1}" width="${PW - 2}" height="${H - 2}" fill="none" stroke="${faint(0.35)}" stroke-width=".35"/>`;
        s += `<path d="M${x0 + 1} 0h${PW - 2}M${x0 + PW / 2} ${-H / 2 + 1}v${H - 2}" stroke="${faint(0.25)}" stroke-width=".35"/>`;
      }
      if (k < 2) { const hx = dir > 0 ? x0 + PW + GAP / 2 : x0 - GAP / 2; s += `<path d="M${hx} ${-H / 2 + 1.5}v1.6M${hx} ${H / 2 - 3.1}v1.6" stroke="${ink}" stroke-width=".7"/>`; }
      x += dir * (PW + GAP);
    }
    s += `<path d="M${dir * 8} -3.4L${dir * 13} 0L${dir * 8} 3.4" fill="none" stroke="${ink}" stroke-width=".7" stroke-linejoin="round"/>`;
  }
  s += `<rect x="-8" y="-8" width="16" height="16" rx=".6" fill="${nadir ? `rgb(${c.paper})` : mix(0.08)}" stroke="${ink}" stroke-width=".75"/>`;
  s += `<path d="M-8-4.6h2.2M5.8-4.6H8M-8 4.6h2.2M5.8 4.6H8M-4.6-8v2.2M-4.6 5.8V8M4.6-8v2.2M4.6 5.8V8" stroke="${faint(0.5)}" stroke-width=".4"/>`;
  for (const [x, y] of [[-6.9, -6.9], [6.9, -6.9], [-6.9, 6.9], [6.9, 6.9]]) s += `<circle cx="${x}" cy="${y}" r=".45" fill="${ink}"/>`;
  if (nadir) {
    s += `<path d="M0 8v3.2" stroke="${ink}" stroke-width=".7"/><ellipse cx="0" cy="12.3" rx="2.2" ry="1.1" fill="rgb(${c.paper})" stroke="${ink}" stroke-width=".7"/>`;
    s += `<circle r="6.1" fill="rgb(${c.paper})" stroke="${ink}" stroke-width=".7"/><circle r="4.9" fill="${mix(0.1)}" stroke="${ink}" stroke-width=".55"/>`;
    s += `<circle r="4.1" fill="none" stroke="${faint(0.5)}" stroke-width=".4"/><circle r="3.1" fill="#161614" stroke="${ink}" stroke-width=".55"/>`;
    s += `<circle cx="-1" cy="-1" r=".9" fill="rgb(${c.accent})"/>`;
  } else {
    // Zenith deck: two star trackers with baffles, a GNSS patch and a sun sensor.
    for (const x of [-3.6, 3.6]) s += `<circle cx="${x}" cy="-3.2" r="2.1" fill="${mix(0.12)}" stroke="${ink}" stroke-width=".6"/><circle cx="${x}" cy="-3.2" r="1.1" fill="${mix(0.75)}" stroke="none"/>`;
    s += `<rect x="-2.2" y="1.6" width="4.4" height="4.4" rx=".5" fill="${mix(0.04)}" stroke="${ink}" stroke-width=".55"/><circle cx="0" cy="3.8" r=".8" fill="${ink}"/>`;
    s += `<rect x="4.4" y="3" width="2" height="2.6" fill="none" stroke="${ink}" stroke-width=".5"/><circle cx="-5.2" cy="4.2" r=".55" fill="rgb(${c.accent})"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-46 -17 92 34" width="368" height="136">${s}</svg>`;
}

export function initRail(thread) {
  const canvas = document.createElement('canvas');
  canvas.className = 'rail-fx';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const live = motion();
  const art = {};
  let c = tokens(), dpr = 1, H = 0;
  let phase = 0.35, spin = BASE_SPIN, lastScroll = scrollY, lastT = performance.now(), progress = 0, target = 0;
  let trail = [], pings = [], visible = false, running = false;

  function paint() {
    c = tokens();
    for (const side of ['zenith', 'nadir']) {
      const img = new Image();
      img.onload = () => request();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(craftSVG(side, c));
      art[side] = img;
    }
  }
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  }
  const small = () => innerWidth < 761;
  const railOffset = () => parseFloat(getComputedStyle(thread).getPropertyValue('--rail')) || 10;

  function draw(now) {
    const r = thread.getBoundingClientRect();
    const railX = r.left + railOffset();
    canvas.style.transform = `translateX(${(railX - W / 2).toFixed(1)}px)`;
    const cx = W / 2, satY = r.top + progress;
    const R = small() ? 13 : 30, ry = R * 0.3, craftW = small() ? 44 : 70, craftH = craftW * 34 / 92;
    const rgba = (rgb, a) => `rgba(${rgb.join(',')},${a})`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';

    // Helix trail, split into the parts behind and in front of the rail.
    const points = trail.map(q => ({ x: cx + R * Math.sin(q.phase), y: q.pageY - scrollY + ry * Math.cos(q.phase), z: Math.cos(q.phase), age: (now - q.t) / 1000 }));
    // Each piece is a quadratic curve between segment midpoints, so the helix has no corners.
    // The whole trail stays one pale tone, in front of the rail and behind it alike; it only
    // thins and fades toward the tail.
    const strokeTrail = front => {
      const n = points.length;
      for (let i = 2; i < n; i++) {
        const a = points[i - 2], b = points[i - 1], d = points[i];
        if ((b.z >= 0) !== front) continue;
        const life = Math.max(0, 1 - b.age / TRAIL_SECONDS), ease = life * life * (3 - 2 * life);
        if (ease <= 0.01) continue;
        const m0 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, m1 = { x: (b.x + d.x) / 2, y: (b.y + d.y) / 2 };
        ctx.strokeStyle = rgba(c.accent, (0.32 * ease).toFixed(3));
        ctx.lineWidth = 0.9 * (0.4 + 0.6 * ease);
        ctx.beginPath(); ctx.moveTo(m0.x, m0.y); ctx.quadraticCurveTo(b.x, b.y, m1.x, m1.y); ctx.stroke();
      }
    };
    strokeTrail(false);

    // The craft: lens toward the rail, so the zenith deck faces us on the near side.
    const sx = cx + R * Math.sin(phase), sy = satY + ry * Math.cos(phase), depth = Math.cos(phase);
    const drawCraft = () => {
      const img = depth >= 0 ? art.zenith : art.nadir;
      if (!img?.complete) return;
      const scale = 1 + 0.14 * depth, w = craftW * scale * Math.max(0.05, Math.abs(depth)), h = craftH * scale;
      ctx.save();
      ctx.globalAlpha = depth >= 0 ? 1 : 0.6;
      ctx.drawImage(img, sx - w / 2, sy - h / 2, w, h);
      ctx.restore();
    };
    if (depth < 0) {
      drawCraft();
      // The rail passes in front of the craft: redraw that stretch of line over it.
      ctx.strokeStyle = rgba(c.accent, 1); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx + 0.5, sy - craftH); ctx.lineTo(cx + 0.5, Math.min(satY, sy + craftH)); ctx.stroke();
      if (satY < sy + craftH) { ctx.strokeStyle = rgba(c.line, 1); ctx.beginPath(); ctx.moveTo(cx + 0.5, satY); ctx.lineTo(cx + 0.5, sy + craftH); ctx.stroke(); }
    }
    strokeTrail(true);
    // Ranging link from craft to the rail while it is clear of the line.
    if (Math.abs(Math.sin(phase)) > 0.35) {
      ctx.setLineDash([1.5, 2.5]); ctx.strokeStyle = rgba(c.accent, 0.6); ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(cx, satY); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = rgba(c.accent, 0.9); ctx.beginPath(); ctx.arc(cx + 0.5, satY, 1.6, 0, 2 * Math.PI); ctx.fill();
    }
    if (depth >= 0) drawCraft();

    // Lock-on pings: a hairline runs from the rail toward the section, with brackets at the dot.
    pings = pings.filter(q => now - q.t < 1300);
    for (const q of pings) {
      const k = (now - q.t) / 1300, y = q.pageY - scrollY, reach = Math.min(1, k * 2.6), fade = 1 - Math.max(0, (k - 0.45) / 0.55);
      ctx.strokeStyle = rgba(c.accent, fade.toFixed(3)); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx + 6, y + 0.5); ctx.lineTo(cx + 6 + (W / 2 - 8) * reach, y + 0.5); ctx.stroke();
      const b = 6 + 4 * (1 - reach);
      ctx.beginPath();
      for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.moveTo(cx + dx * b, y + dy * b + (dy < 0 ? 3 : -3)); ctx.lineTo(cx + dx * b, y + dy * b); ctx.lineTo(cx + dx * b + (dx < 0 ? 3 : -3), y + dy * b);
      }
      ctx.stroke();
    }
  }

  function frame(now) {
    running = false;
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    // Spin up with scroll speed, settle back to the resting rate.
    const speed = Math.abs(scrollY - lastScroll) / Math.max(dt, 0.001);
    lastScroll = scrollY;
    // Height follows the scroll with critical-style damping rather than jumping with it.
    progress = live ? progress + (target - progress) * (1 - Math.exp(-dt * 9)) : target;
    // The inked trace and the readout ride with the craft, not with the raw scroll position.
    thread.style.setProperty('--p', progress.toFixed(1) + 'px');
    if (live) {
      spin += (BASE_SPIN + Math.min(14, speed * 0.012) - spin) * Math.min(1, dt * 4);
      phase = (phase + spin * dt) % (2 * Math.PI);
      const r = thread.getBoundingClientRect();
      trail.push({ phase, pageY: r.top + scrollY + progress, t: now });
      trail = trail.filter(q => now - q.t < TRAIL_SECONDS * 1000);
    }
    draw(now);
    if (live && visible) request();
    else if (Math.abs(target - progress) > 0.3) request();
  }
  function request() { if (!running) { running = true; requestAnimationFrame(frame); } }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    canvas.classList.toggle('on', visible);
    if (visible) { lastT = performance.now(); request(); }
  }).observe(thread);
  document.addEventListener('themechange', paint);
  addEventListener('resize', () => { resize(); request(); });
  resize(); paint();

  return {
    setProgress(p) { target = p; if (!visible || !live) { progress = live ? progress : p; request(); } },
    ping(pageY) { if (live) { pings.push({ pageY, t: performance.now() }); request(); } },
  };
}
