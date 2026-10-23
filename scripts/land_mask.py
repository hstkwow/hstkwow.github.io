#!/usr/bin/env python3
"""Regenerate assets/data/land.js from Natural Earth land TopoJSON.

Usage: python scripts/land_mask.py land-110m.json 24000
(land-110m.json from the world-atlas@2.0.2 npm package). Writes land.b64 and mask.png in the cwd."""
import json, sys, math, base64
from PIL import Image, ImageDraw
topo = json.load(open(sys.argv[1]))
sx, sy = topo['transform']['scale']; tx, ty = topo['transform']['translate']
arcs = []
for arc in topo['arcs']:
    x = y = 0; pts = []
    for dx, dy in arc:
        x += dx; y += dy; pts.append((x * sx + tx, y * sy + ty))
    arcs.append(pts)
def ring(ids):
    out = []
    for i in ids:
        a = arcs[i] if i >= 0 else arcs[~i][::-1]
        out += a[1:] if out else a
    return out
W, H = 2880, 1440
im = Image.new('L', (W, H), 0); d = ImageDraw.Draw(im)
def px(lon, lat): return ((lon + 180) / 360 * W, (90 - lat) / 180 * H)
for g in topo['objects']['land']['geometries']:
    polys = g['arcs'] if g['type'] == 'MultiPolygon' else [g['arcs']]
    for poly in polys:
        for k, r in enumerate(ring_ids for ring_ids in poly):
            pts = ring(r)
            # unwrap longitudes so rings crossing the antimeridian stay contiguous
            un = [pts[0]]
            for lon, lat in pts[1:]:
                p = un[-1][0]
                while lon - p > 180: lon -= 360
                while lon - p < -180: lon += 360
                un.append((lon, lat))
            if abs(un[-1][0] - un[0][0]) > 180:  # ring wraps the pole (Antarctica)
                s = 1 if un[-1][0] > un[0][0] else -1
                pole = -90 if sum(l for _, l in un) / len(un) < 0 else 90
                un = un + [(un[-1][0], pole), (un[0][0], pole)]
            for shift in (-360, 0, 360):
                d.polygon([px(lon + shift, lat) for lon, lat in un], fill=0 if k else 255)
im.save('mask.png')
N = int(sys.argv[2]); bits = bytearray((N + 7) // 8); land = 0
golden = math.pi * (3 - math.sqrt(5))
for i in range(N):
    y = 1 - 2 * (i + .5) / N; lat = math.degrees(math.asin(y)); lon = math.degrees((i * golden) % (2 * math.pi)) - 180
    x0, y0 = px(lon, lat)
    if im.getpixel((min(W - 1, int(x0)), min(H - 1, int(y0)))):
        bits[i >> 3] |= 1 << (i & 7); land += 1
print(N, land, len(base64.b64encode(bits)))
open('land.b64', 'w').write(base64.b64encode(bits).decode())
