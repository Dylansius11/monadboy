"""
Cut a free-layout pixel sprite sheet into normalised frames.

Replaces the grid cutter. The generated sheets are NOT on a grid: poses sit
wherever the model put them, sizes differ, and the bottom half is empty. Slicing
a fixed 4x4 over that cuts through bodies. This finds each sprite by
connectivity instead, so layout does not matter.

The other change is the resampling rule, and it is the one that stops sprites
looking shattered.

    Nearest neighbour is correct when the source is ALREADY on the target pixel
    grid. It is wrong for a 10:1 reduction of high-resolution art, because it
    SAMPLES one source pixel per output pixel: a 3px antenna is hit or missed at
    random, which is exactly the broken, speckled look. Area averaging asks
    "what is in this region", so a thin feature survives as a darker average and
    quantises to a solid pixel.

Usage:
    py tools/sprites/cut_pixel_sheet.py assets/pixel/molandak-sprite.png \
        --name molandak --sizes 64 32 --out apps/web/public/sprites
"""

import argparse
import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

BASE = [
    (0x6E, 0x54, 0xFF), (0x4A, 0x35, 0xC4), (0x2E, 0x1F, 0x80),
    (0x9B, 0x87, 0xFF), (0xDD, 0xD7, 0xFE), (0xFF, 0xFF, 0xFF),
    (0x0E, 0x09, 0x1C),
]
BILL = [(0xFF, 0xAE, 0x45), (0xC7, 0x7E, 0x1F)]
PALETTES = {
    "molandak": BASE + BILL,
    "moyaki":   BASE + BILL + [(0xFF, 0x8E, 0xE4), (0xC4, 0x5F, 0xA8)],
    "mouch":    BASE + BILL + [(0xB9, 0xE3, 0xF9), (0x7F, 0xA8, 0xC4)],
}
OUTLINE = (0x0E, 0x09, 0x1C)

FRAME_NAMES = ["idle-0", "idle-1", "run-0", "run-1", "jump", "sit", "alert", "happy"]


def subject_mask(arr, tol=60):
    """
    True where the pixel is not the magenta field.

    This must be a PER CHANNEL chroma key, not a sum of channel differences.
    Summing conflates the axes: a mid purple like (170,100,190) is 209 away from
    magenta by total distance and so reads as background at any threshold that
    still catches the field, which is why the first pass hollowed out every body
    and left only outlines. Magenta is specifically "red high, green near zero,
    blue high", and testing those three conditions separately keys it exactly
    while touching nothing the artwork contains.
    """
    a = arr[:, :, :3].astype(np.int16)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    fr, fg, fb = (int(v) for v in arr[0, 0, :3])
    field = (r > fr - tol) & (g < fg + tol) & (b > fb - tol)
    return ~field


def label_blobs(mask, join, want):
    """
    Connected components, then limbs absorbed into the nearest body.

    Dilating hard enough to reach Mouch's detached antennae also fuses two
    neighbouring poses into one blob, which is how Moyaki came back as seven
    sprites instead of eight. So dilate only slightly, keep the N largest blobs
    as bodies, and attach every small leftover to whichever body it is nearest.
    A limb joins a character; a character never joins a character.
    """
    m = Image.fromarray((mask * 255).astype(np.uint8))
    small = m.resize((m.width // 4, m.height // 4), Image.Resampling.BOX)
    if join > 1:
        small = small.filter(ImageFilter.MaxFilter(join | 1))
    sm = np.array(small) > 40

    h, w = sm.shape
    seen = np.zeros((h, w), dtype=bool)
    blobs = []
    for sy in range(h):
        for sx in range(w):
            if not sm[sy, sx] or seen[sy, sx]:
                continue
            q = deque([(sy, sx)])
            seen[sy, sx] = True
            y0 = y1 = sy
            x0 = x1 = sx
            n = 0
            while q:
                y, x = q.popleft()
                n += 1
                y0, y1 = min(y0, y), max(y1, y)
                x0, x1 = min(x0, x), max(x1, x)
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and sm[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((ny, nx))
            blobs.append([n, x0 * 4, y0 * 4, (x1 + 1) * 4, (y1 + 1) * 4])

    blobs.sort(key=lambda b: -b[0])
    bodies, limbs = blobs[:want], blobs[want:]

    def gap(a, b):
        dx = max(0, max(a[1] - b[3], b[1] - a[3]))
        dy = max(0, max(a[2] - b[4], b[2] - a[4]))
        return (dx * dx + dy * dy) ** 0.5

    absorbed = 0
    for lb in limbs:
        if lb[0] < 3:
            continue
        host = min(bodies, key=lambda b: gap(b, lb))
        if gap(host, lb) > 90:
            continue
        host[1] = min(host[1], lb[1])
        host[2] = min(host[2], lb[2])
        host[3] = max(host[3], lb[3])
        host[4] = max(host[4], lb[4])
        absorbed += 1
    if absorbed:
        print(f"  absorbed {absorbed} detached limbs into their nearest body")
    return bodies


def refine(mask, box, pad=6):
    """Tighten an approximate box onto the real subject at full resolution."""
    H, W = mask.shape
    x0, y0, x1, y1 = box
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(W, x1 + pad), min(H, y1 + pad)
    sub = mask[y0:y1, x0:x1]
    ys, xs = np.where(sub)
    if len(ys) == 0:
        return None
    return x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1


def reading_order(boxes, row_tol):
    """Sort left-to-right within rows, rows top-to-bottom."""
    rows = []
    for b in sorted(boxes, key=lambda b: b[1]):          # by top
        placed = False
        for r in rows:
            if abs(b[1] - r[0][1]) < row_tol:
                r.append(b)
                placed = True
                break
        if not placed:
            rows.append([b])
    out = []
    for r in rows:
        out.extend(sorted(r, key=lambda b: b[0]))         # by left
    return out


def build_palette(img, mask, colours):
    """
    Derive the palette from the artwork instead of forcing the brand list.

    Forcing the locked brand hexes hollowed every character out. The generator
    draws a muted lavender body, roughly #8B6FB0, and the nearest brand entry by
    RGB distance is the deep shadow #2E1F80, so the fill mapped almost black and
    only the outline survived. The art is already internally consistent across
    all three sheets, so the right move is to preserve what was drawn and treat
    any brand remap as a separate, deliberate pass.
    """
    # Sample the INTERIOR only. The one-pixel rim where the artwork meets the
    # magenta field is a blend of the two, so it reads as pink. There are enough
    # of those rim pixels to dominate a 14-colour histogram, which is how Moyaki
    # came back entirely pink: the rim won the palette and the purple body then
    # quantised onto a pink entry. Eroding first removes the rim from the vote.
    inner = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5))
    interior = np.array(inner) > 127
    if interior.sum() < mask.sum() * 0.25:
        interior = mask                                    # thin art, keep everything

    arr = np.array(img)
    px = arr[interior]
    if len(px) > 200_000:
        px = px[:: len(px) // 200_000 + 1]
    strip = Image.fromarray(px.reshape(-1, 1, 3).astype(np.uint8))
    # MEDIANCUT, not MAXCOVERAGE. Max coverage spreads entries across the colour
    # SPACE rather than the colour POPULATION, so it spent slots on reds, tans
    # and greys that barely occur while omitting Moyaki's actual body purple
    # (145,78,180). With no purple in the palette the body quantised onto the
    # nearest pink and the whole fish turned magenta. Median cut partitions by
    # population, which is what representing an image requires.
    pal_img = strip.quantize(colors=colours, method=Image.Quantize.MEDIANCUT,
                             dither=Image.Dither.NONE)
    pal = pal_img.getpalette()[: colours * 3]
    holder = Image.new("P", (1, 1))
    holder.putpalette(pal + [0] * (768 - len(pal)))
    return holder


def quantise(img, holder):
    return img.convert("RGB").quantize(palette=holder, dither=Image.Dither.NONE).convert("RGB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sheet")
    ap.add_argument("--name", required=True, choices=sorted(PALETTES))
    ap.add_argument("--sizes", type=int, nargs="+", default=[64, 32])
    ap.add_argument("--frames", type=int, default=8)
    ap.add_argument("--join", type=int, default=3, help="dilation radius for limb joining")
    ap.add_argument("--colours", type=int, default=14, help="adaptive palette size")
    ap.add_argument("--alpha", type=int, default=64, help="1-bit alpha cutoff, 0-255")
    ap.add_argument("--out", default="apps/web/public/sprites")
    args = ap.parse_args()

    src = Path(args.sheet)
    img = Image.open(src).convert("RGB")
    arr = np.array(img)
    mask = subject_mask(arr)
    print(f"  {src.name}  {img.width}x{img.height}   subject pixels {mask.sum():,}")

    raw = label_blobs(mask, args.join, args.frames)
    print(f"  found {len(raw)} sprites")

    boxes = []
    for _, x0, y0, x1, y1 in raw:
        r = refine(mask, (x0, y0, x1, y1))
        if r:
            boxes.append(r)

    holder = build_palette(img, mask, args.colours)

    heights = [b[3] - b[1] for b in boxes]
    boxes = reading_order(boxes, row_tol=int(np.median(heights) * 0.6))

    # Background becomes the outline colour before resampling. Averaging against
    # magenta would bleed pink into every edge; averaging against the outline
    # keeps edges dark, which is what the artwork already does.
    flat = arr.copy()
    flat[~mask] = OUTLINE
    flat_img = Image.fromarray(flat)
    alpha_img = Image.fromarray((mask * 255).astype(np.uint8))

    # Scale from the largest dimension in EITHER axis, across the whole set.
    # Scaling by height alone clips anything wider than it is tall, which is
    # every Moyaki pose: the fish overflowed its 64px cell and bled into the
    # next frame of the strip.
    tallest = max(max(b[3] - b[1], b[2] - b[0]) for b in boxes)
    out_root = Path(args.out)

    for size in args.sizes:
        scale = size / tallest
        d = out_root / f"{args.name}-{size}"
        d.mkdir(parents=True, exist_ok=True)
        frames = []

        for i, (x0, y0, x1, y1) in enumerate(boxes):
            bw, bh = x1 - x0, y1 - y0
            tw = max(1, round(bw * scale))
            th = max(1, round(bh * scale))

            # AREA AVERAGE, not nearest. See the module docstring.
            rgb = flat_img.crop((x0, y0, x1, y1)).resize((tw, th), Image.Resampling.BOX)
            a = alpha_img.crop((x0, y0, x1, y1)).resize((tw, th), Image.Resampling.BOX)

            rgb = quantise(rgb, holder)
            a = a.point(lambda v: 255 if v > args.alpha else 0)   # 1-bit alpha

            cell = Image.new("RGBA", (size, size), (0, 0, 0, 0))
            frame = rgb.convert("RGBA")
            frame.putalpha(a)
            cell.paste(frame, ((size - tw) // 2, size - th), frame)

            name = FRAME_NAMES[i] if i < len(FRAME_NAMES) else f"frame-{i}"
            cell.save(d / f"{name}.png")
            frames.append(cell)

        strip = Image.new("RGBA", (size * len(frames), size), (0, 0, 0, 0))
        for n, f in enumerate(frames):
            strip.paste(f, (n * size, 0))
        strip_path = out_root / f"{args.name}-{size}.png"
        strip.save(strip_path)
        print(f"  {size}px -> {strip_path}  ({len(frames)} frames, {strip.width}x{size})")

    meta = {
        "name": args.name,
        "frames": FRAME_NAMES[:len(boxes)],
        "sizes": args.sizes,
        "source": src.name,
        "boxes": [[int(v) for v in b] for b in boxes],
    }
    (out_root / f"{args.name}.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
