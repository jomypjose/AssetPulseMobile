#!/usr/bin/env python3
"""
AssetPulse — Generate all PNG icon / splash assets from the ECG pulse-wave logo.
Run from the mobile/ directory:  python3 scripts/generate_icons.py
"""

import struct, zlib, math, os

# ── Brand colors ────────────────────────────────────────────────────────────
BG      = (8,  13,  23)      # #080d17  dark navy
BLUE    = (239, 68,  68)     # #ef4444  AssetPulse red (matches web logo)
DIM     = (127, 29,  29)     # #7f1d1d  dark red glow

# ── ECG waveform key-points in a 0-100 SVG viewBox ──────────────────────────
ECG = [
    (5,50),(20,50),(25,30),(30,70),(35,45),(40,55),
    (45,50),(50,20),(55,80),(60,40),(65,60),(70,50),
    (75,35),(80,65),(85,50),(95,50),
]

# ────────────────────────────────────────────────────────────────────────────
# Pixel / drawing helpers
# ────────────────────────────────────────────────────────────────────────────

def make_buf(W, H, r, g, b, alpha=255):
    """Create an RGBA bytearray filled with a solid colour."""
    buf = bytearray(W * H * 4)
    for i in range(W * H):
        buf[i*4:i*4+4] = [r, g, b, alpha]
    return buf

def blend(buf, W, H, px, py, r, g, b, a_f):
    """Alpha-blend a single pixel (a_f in 0..1)."""
    if not (0 <= px < W and 0 <= py < H):
        return
    a = max(0, min(255, int(a_f * 255)))
    if a == 0:
        return
    idx = (py * W + px) * 4
    inv = 255 - a
    buf[idx]   = (r * a + buf[idx]   * inv) >> 8
    buf[idx+1] = (g * a + buf[idx+1] * inv) >> 8
    buf[idx+2] = (b * a + buf[idx+2] * inv) >> 8
    buf[idx+3] = min(255, buf[idx+3] + a - (buf[idx+3] * a >> 8))

def pt_seg_dist(px, py, ax, ay, bx, by):
    """Perpendicular (or endpoint) distance from point to segment."""
    dx, dy = bx - ax, by - ay
    len2 = dx*dx + dy*dy
    if len2 < 1e-12:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px-ax)*dx + (py-ay)*dy) / len2))
    return math.hypot(px - ax - t*dx, py - ay - t*dy)

def draw_segment(buf, W, H, ax, ay, bx, by, r, g, b, hw):
    """Draw one thick anti-aliased line segment (half-width hw)."""
    pad = int(hw) + 2
    x0 = max(0, int(min(ax, bx)) - pad)
    x1 = min(W-1, int(max(ax, bx)) + pad)
    y0 = max(0, int(min(ay, by)) - pad)
    y1 = min(H-1, int(max(ay, by)) + pad)
    for py in range(y0, y1+1):
        for px in range(x0, x1+1):
            d = pt_seg_dist(px, py, ax, ay, bx, by)
            a = max(0.0, min(1.0, hw - d + 0.5))
            if a > 0:
                blend(buf, W, H, px, py, r, g, b, a)

def draw_ecg_wave(buf, W, H, cx, cy, wave_w, wave_h, color, hw):
    """Draw the ECG wave centered at (cx,cy) in a box of (wave_w x wave_h)."""
    r, g, b = color
    xs = [p[0] for p in ECG]; ys = [p[1] for p in ECG]
    sw, sh = max(xs)-min(xs), max(ys)-min(ys)   # SVG extents: 90 × 60
    scale = min(wave_w / sw, wave_h / sh)
    ox = cx - (sw * scale) / 2 - min(xs) * scale
    oy = cy - (sh * scale) / 2 - min(ys) * scale
    pts = [(x*scale + ox, y*scale + oy) for x,y in ECG]
    for i in range(len(pts)-1):
        draw_segment(buf, W, H, pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1], r, g, b, hw)

# ────────────────────────────────────────────────────────────────────────────
# PNG writer (stdlib only)
# ────────────────────────────────────────────────────────────────────────────

def save_png(path, W, H, buf):
    def chunk(tag, data):
        c = zlib.crc32(tag + data) & 0xffffffff
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', c)
    raw = bytearray()
    for y in range(H):
        raw.append(0)  # filter = None
        raw += buf[y*W*4 : (y+1)*W*4]
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0)))
        f.write(chunk(b'IDAT', zlib.compress(bytes(raw), 6)))
        f.write(chunk(b'IEND', b''))
    print(f'  ✓  {path}  ({W}×{H})')

# ────────────────────────────────────────────────────────────────────────────
# Asset generators
# ────────────────────────────────────────────────────────────────────────────

def gen_icon(path, size):
    """Solid dark bg + ECG wave — used for iOS icon & mipmap fallback."""
    buf = make_buf(size, size, *BG)
    pad = size * 0.15
    hw  = max(1.5, size * 0.028)
    cx, cy = size / 2, size / 2
    ww = size - pad * 2
    wh = ww * 0.65   # keep aspect close to original
    # subtle glow pass
    draw_ecg_wave(buf, size, size, cx, cy, ww+hw*2, wh+hw*2, DIM, hw * 2.4)
    # main wave
    draw_ecg_wave(buf, size, size, cx, cy, ww, wh, BLUE, hw)
    save_png(path, size, size, buf)

def gen_adaptive_fg(path, size):
    """Transparent background — Android adaptive icon foreground."""
    buf = make_buf(size, size, 0, 0, 0, 0)   # fully transparent
    # safe zone = inner 66 % for adaptive icons
    safe = size * 0.50
    hw   = max(1.5, size * 0.032)
    cx, cy = size / 2, size / 2
    draw_ecg_wave(buf, size, size, cx, cy, safe, safe * 0.65, DIM, hw * 2.0)
    draw_ecg_wave(buf, size, size, cx, cy, safe, safe * 0.65, BLUE, hw)
    save_png(path, size, size, buf)

def gen_splash(path, W, H):
    """Static splash: dark bg + centred ECG wave (text added by JS)."""
    buf = make_buf(W, H, *BG)
    cx, cy = W / 2, H * 0.42
    ww = W * 0.70
    hw = max(3, W * 0.018)
    # glow
    draw_ecg_wave(buf, W, H, cx, cy, ww + hw*4, ww*0.50, DIM, hw * 3)
    # wave
    draw_ecg_wave(buf, W, H, cx, cy, ww, ww * 0.43, BLUE, hw)
    save_png(path, W, H, buf)

# ────────────────────────────────────────────────────────────────────────────
# Main
# ────────────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    mobile_dir = os.path.dirname(script_dir)
    os.chdir(mobile_dir)

    print('\n🎨  Generating AssetPulse icons…\n')

    # ── Expo assets ──────────────────────────────────────────────────────────
    os.makedirs('assets', exist_ok=True)
    gen_icon         ('assets/icon.png',          1024)
    gen_adaptive_fg  ('assets/adaptive-icon.png', 1024)
    gen_splash       ('assets/splash.png',        1242, 2436)
    # favicon (small solid-bg icon)
    buf = make_buf(64, 64, *BG)
    draw_ecg_wave(buf, 64, 64, 32, 32, 44, 28, DIM, 3)
    draw_ecg_wave(buf, 64, 64, 32, 32, 44, 28, BLUE, 2)
    save_png('assets/favicon.png', 64, 64, buf)

    # ── Android mipmap icons ─────────────────────────────────────────────────
    DENSITIES = {
        'mipmap-mdpi':    48,
        'mipmap-hdpi':    72,
        'mipmap-xhdpi':   96,
        'mipmap-xxhdpi':  144,
        'mipmap-xxxhdpi': 192,
    }
    res_dir = 'android/app/src/main/res'
    for folder, size in DENSITIES.items():
        d = os.path.join(res_dir, folder)
        os.makedirs(d, exist_ok=True)
        gen_icon        (os.path.join(d, 'ic_launcher.png'),            size)
        gen_icon        (os.path.join(d, 'ic_launcher_round.png'),      size)
        gen_adaptive_fg (os.path.join(d, 'ic_launcher_foreground.png'), size)
        # remove old .webp if present
        for ext_file in ['ic_launcher.webp','ic_launcher_round.webp','ic_launcher_foreground.webp']:
            fp = os.path.join(d, ext_file)
            if os.path.exists(fp):
                os.remove(fp)
                print(f'  ✗  removed {fp}')

    print('\n✅  All icons generated.\n')
    print('Next step:  cd mobile && npm install expo-notifications@~0.30.0 expo-splash-screen@~0.30.0')
