#!/usr/bin/env python3
"""Generate Kasir Pro app icons as PNG using only standard library (no PIL)."""
import struct, zlib, os

def make_png(width, height, pixel_fn):
    """Create a PNG file. pixel_fn(x, y) returns (r, g, b, a)."""
    def chunk(typ, data):
        c = struct.pack('>I', len(data)) + typ + data
        c += struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff)
        return c

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)

    raw = bytearray()
    for y in range(height):
        raw.append(0)  # filter type 0
        for x in range(width):
            r, g, b, a = pixel_fn(x, y)
            raw += bytes((r, g, b, a))

    idat = zlib.compress(bytes(raw), 9)
    png = sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')
    return png

def rounded_rect(x, y, w, h, img_size, radius):
    """Return True if (x,y) is inside a rounded rectangle."""
    # margins
    l, t = (img_size - w) / 2, (img_size - h) / 2
    r, b = l + w, t + h
    # clamp to rect
    cx = min(max(x, l + radius), r - radius)
    cy = min(max(y, t + radius), b - radius)
    dx, dy = x - cx, y - cy
    # if in rounded corner region, check distance
    if dx != 0 and dy != 0:
        return dx*dx + dy*dy <= radius*radius
    return l <= x <= r and t <= y <= b

def draw_icon(size, gradient_top=(79,70,229), gradient_bottom=(124,58,237), maskable=False):
    """Draw the Kasir Pro icon: gradient background + white calculator symbol."""
    def pixel(x, y):
        # background (rounded square)
        if maskable:
            # full bleed for maskable
            bg = True
        else:
            bg = rounded_rect(x, y, size, size, size, size*0.22)
        if not bg:
            return (0, 0, 0, 0)

        # vertical gradient
        t = y / size
        r = int(gradient_top[0] + (gradient_bottom[0]-gradient_top[0])*t)
        g = int(gradient_top[1] + (gradient_bottom[1]-gradient_top[1])*t)
        b = int(gradient_top[2] + (gradient_bottom[2]-gradient_top[2])*t)

        # calculator symbol (white) - draw in normalized 0..1
        nx, ny = x / size, y / size
        # body of calculator
        body_b = 0.15
        body_t = 0.85
        body_l = 0.22
        body_r = 0.78
        # rounded body corners
        if rounded_rect(nx*size, ny*size, (body_r-body_l)*size, (body_t-body_b)*size, size, size*0.05):
            # display bar
            if 0.26 <= ny <= 0.40:
                return (255, 255, 255, 255)
            # buttons
            if 0.46 <= ny <= 0.80:
                # grid of 3x2
                for i in range(3):
                    for j in range(2):
                        bx = 0.30 + i*0.16
                        by = 0.48 + j*0.16
                        if abs(nx - bx) < 0.045 and abs(ny - by) < 0.045:
                            return (255, 255, 255, 255)
        return (r, g, b, 255)
    return pixel

os.makedirs('icons', exist_ok=True)

configs = [
    ('icons/icon-192.png', 192, draw_icon(192, maskable=False)),
    ('icons/icon-512.png', 512, draw_icon(512, maskable=False)),
    ('icons/icon-maskable-192.png', 192, draw_icon(192, maskable=True)),
    ('icons/icon-maskable-512.png', 512, draw_icon(512, maskable=True)),
]

for path, size, pixel_fn in configs:
    with open(path, 'wb') as f:
        f.write(make_png(size, size, pixel_fn))
    print(f"Generated {path} ({size}x{size})")

print("Done!")
