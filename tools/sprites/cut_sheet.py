"""
Cut a generated character sheet into normalised sprite frames.

Sprite conventions are documented in docs/DESIGN-SYSTEM.md section 7.

Solves the three mechanical defects of a diffusion-generated sheet:
  1. baked-in label bars       -> detected and discarded
  2. inconsistent frame scale  -> each pose trimmed to its subject, then the
                                  whole set scaled by ONE shared factor, so the
                                  creature stops inflating between frames
  3. off-palette colour drift  -> nearest-neighbour resample, then quantise to
                                  the locked palette with no dithering

Background removal is a FLOOD FILL FROM THE CORNERS, not a global colour key,
so enclosed white eyes survive. Alpha is forced to 1-bit.

It cannot fix pose problems. A run cycle that does not read as running still
does not read as running after cutting.

Usage:
    py tools/sprites/cut_sheet.py sheet.png
    py tools/sprites/cut_sheet.py sheet.png --cols 3 --rows 3 --frames 8
"""

import argparse
from collections import deque
from pathlib import Path

from PIL import Image

# Character palettes follow docs/DESIGN-SYSTEM.md section 7.
#
# Palettes are PER CHARACTER, never shared. A combined palette lets a character
# quantise onto a colour that belongs to a different character: magenta bleeding
# into Molandak's quills landed on Moyaki's fin pink and speckled every spine.
# A character can only ever resolve to a colour it is allowed to contain.
BASE = [
    (0x6E, 0x54, 0xFF),  # body base
    (0x4A, 0x35, 0xC4),  # shadow
    (0x2E, 0x1F, 0x80),  # deep shadow
    (0x9B, 0x87, 0xFF),  # highlight
    (0xDD, 0xD7, 0xFE),  # rim highlight
    (0xFF, 0xFF, 0xFF),  # eye white
    (0x0E, 0x09, 0x1C),  # outline
]
BILL = [(0xFF, 0xAE, 0x45), (0xC7, 0x7E, 0x1F)]

PALETTES = {
    "molandak": BASE + BILL,
    "moyaki":   BASE + BILL + [(0xFF, 0x8E, 0xE4), (0xC4, 0x5F, 0xA8)],
    "mouch":    BASE + BILL + [(0xB9, 0xE3, 0xF9), (0x7F, 0xA8, 0xC4)],
    "all":      BASE + BILL + [(0xFF, 0x8E, 0xE4), (0xC4, 0x5F, 0xA8),
                               (0xB9, 0xE3, 0xF9), (0x7F, 0xA8, 0xC4)],
}

# Frame order must match apps/web/src/ui/motion.tsx.
FRAME_NAMES = ["idle-0", "idle-1", "run-0", "run-1", "jump", "sit", "alert", "happy"]


def near(a, b, tol):
    return sum(abs(x - y) for x, y in zip(a[:3], b[:3])) <= tol * 3


def dominant(samples, bucket=24):
    """
    Most common colour, counted in coarse buckets.

    Counting exact tuples fails on a JPEG: compression noise makes almost every
    background pixel unique, so the mode is whichever near-arbitrary pixel
    happened to repeat, and everything else reads as subject. Bucketing first
    collapses the noise, then the true average of the winning bucket is
    returned.
    """
    buckets = {}
    for s in samples:
        key = tuple(c // bucket for c in s[:3])
        buckets.setdefault(key, []).append(s[:3])
    best = max(buckets.values(), key=len)
    n = len(best)
    return tuple(sum(c[i] for c in best) // n for i in range(3))


def scrub_furniture(img, tol=48, pad=5):
    """
    Whiten every full-width row and full-height column that is mostly dark.

    A generated sheet arrives with caption bars and gutter lines baked in. Left
    in place they defeat per-cell background detection: a cell whose corner
    lands on a black gutter reports black as its background, so the white field
    counts as subject and the trim returns the whole cell. That is what made
    every frame come back 32x32.
    """
    rgb = img.convert("RGB")
    px = rgb.load()
    w, h = rgb.size

    # Fill with the sheet's OWN background, not white. The brief now mandates a
    # magenta field, so painting furniture white would introduce a second
    # background colour and defeat the key.
    field = dominant([px[x, y] for x in range(0, w, 16) for y in (0, h - 1)]
                     + [px[x, y] for y in range(0, h, 16) for x in (0, w - 1)])

    def med(vals):
        vals = sorted(vals)
        return vals[len(vals) // 2]

    # Median, not a percentage. A caption bar carries white lettering, and any
    # percentage threshold high enough to ignore the letters also ignores the
    # bar. The median is unmoved by a minority of bright pixels.
    rows = [y for y in range(h) if med([sum(px[x, y]) for x in range(0, w, 4)]) < tol * 3]
    cols = [x for x in range(w) if med([sum(px[x, y]) for y in range(0, h, 4)]) < tol * 3]

    # Dilate. A dark line on a JPEG carries a ringing halo either side of it,
    # and those halo pixels are neither dark enough to be detected nor close
    # enough to the field to be keyed, so they survive at the cell boundary and
    # the trim swallows the whole cell. Painting past the line removes them.
    rows = sorted({y + d for y in rows for d in range(-pad, pad + 1) if 0 <= y + d < h})
    cols = sorted({x + d for x in cols for d in range(-pad, pad + 1) if 0 <= x + d < w})

    for y in rows:
        for x in range(w):
            px[x, y] = field
    for x in cols:
        for y in range(h):
            px[x, y] = field
    return rgb, len(rows), len(cols)


def trim_to_subject(cell, tol=34):
    """Drop the uniform border and return the subject bbox crop plus its bg."""
    rgb = cell.convert("RGB")
    px = rgb.load()
    w, h = rgb.size
    # sample the whole border, not four corners. one stray pixel in a corner
    # should not decide the background colour for the entire cell.
    bg = dominant([px[x, 0] for x in range(0, w, 3)] + [px[x, h - 1] for x in range(0, w, 3)]
                  + [px[0, y] for y in range(0, h, 3)] + [px[w - 1, y] for y in range(0, h, 3)])

    xs = [x for x in range(w) for y in range(0, h, 2) if not near(px[x, y], bg, tol)]
    ys = [y for y in range(h) for x in range(0, w, 2) if not near(px[x, y], bg, tol)]
    if not xs or not ys:
        return None, bg
    return rgb.crop((min(xs), min(ys), max(xs) + 1, max(ys) + 1)), bg


def quantise_rgba(img, palette):
    """
    Quantise colour while preserving the alpha channel.

    Quantising before keying was the second bug: the white field mapped onto the
    nearest palette entry, which was the pink used for Moyaki's fins, so the key
    then compared live pink pixels against a remembered white and matched
    nothing. Alpha is decided first and colour second.
    """
    alpha = img.getchannel("A")
    pal = Image.new("P", (1, 1))
    flat = [c for rgb in palette for c in rgb]
    flat += [0] * (768 - len(flat))
    pal.putpalette(flat)
    out = img.convert("RGB").quantize(palette=pal, dither=Image.Dither.NONE).convert("RGBA")
    out.putalpha(alpha)
    return out


def flood_key(img, bg, tol=60):
    """
    Remove background by flooding inward from all four edges.

    A global colour key would also erase enclosed regions that happen to match
    the background, which is how you punch holes through white eyes. Flooding
    only reaches pixels connected to the border.
    """
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    seen = [[False] * h for _ in range(w)]
    q = deque()

    for x in range(w):
        for y in (0, h - 1):
            if not seen[x][y] and near(px[x, y], bg, tol):
                seen[x][y] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not seen[x][y] and near(px[x, y], bg, tol):
                seen[x][y] = True
                q.append((x, y))

    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not seen[nx][ny] and near(px[nx, ny], bg, tol):
                seen[nx][ny] = True
                q.append((nx, ny))

    # force 1-bit alpha. any partial pixel becomes a halo on a dark screen.
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 0 if a < 128 else 255)
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sheet")
    ap.add_argument("--cols", type=int, default=3)
    ap.add_argument("--rows", type=int, default=3)
    ap.add_argument("--frames", type=int, default=8)
    ap.add_argument("--size", type=int, default=32)
    ap.add_argument("--out", default=None)
    ap.add_argument("--palette", default=None,
                    help="molandak | moyaki | mouch | all. inferred from the filename.")
    args = ap.parse_args()

    src = Path(args.sheet)
    key = args.palette or next((k for k in PALETTES if k in src.stem.lower()), "all")
    palette = PALETTES[key]
    print(f"  palette: {key} ({len(palette)} colours)")
    if src.suffix.lower() in (".jpg", ".jpeg"):
        print("  ! source is JPEG. Edges carry compression ringing and the")
        print("    palette has drifted. Regenerate as PNG when you can.\n")

    out_dir = Path(args.out) if args.out else src.parent / src.stem
    out_dir.mkdir(parents=True, exist_ok=True)

    sheet, n_rows, n_cols = scrub_furniture(Image.open(src).convert("RGB"))
    W, H = sheet.size
    if n_rows or n_cols:
        print(f"  scrubbed {n_rows} caption rows and {n_cols} gutter columns")

    cell_w, cell_h = W // args.cols, H // args.rows
    subjects = []

    for i in range(args.frames):
        r, c = divmod(i, args.cols)
        box = (c * cell_w, r * cell_h, (c + 1) * cell_w, (r + 1) * cell_h)
        crop, bg = trim_to_subject(sheet.crop(box))
        name = FRAME_NAMES[i] if i < len(FRAME_NAMES) else f"frame-{i}"
        if crop is None:
            print(f"  ! {name}: empty cell, skipped")
            continue
        subjects.append((i, name, crop, bg))

    if not subjects:
        raise SystemExit("no frames found. check --cols and --rows.")

    # ONE shared scale factor for the whole set. This is the fix for scale drift:
    # relative differences between poses survive, but the set shares a baseline.
    tallest = max(c.height for _, _, c, _ in subjects)
    scale = args.size / tallest
    print(f"  tallest subject {tallest}px -> shared scale {scale:.3f}\n")

    frames = []
    for i, name, crop, bg in subjects:
        tw = max(1, round(crop.width * scale))
        th = max(1, round(crop.height * scale))
        small = crop.resize((tw, th), Image.Resampling.NEAREST)

        canvas = Image.new("RGB", (args.size, args.size), bg)
        canvas.paste(small, ((args.size - tw) // 2, args.size - th))  # sit on baseline

        # key first, then quantise. see quantise_rgba for why the order matters.
        out = quantise_rgba(flood_key(canvas, bg), palette)
        out.save(out_dir / f"{name}.png")
        frames.append(out)
        print(f"  ok  {name}.png   subject {tw}x{th}")

    strip = Image.new("RGBA", (args.size * len(frames), args.size), (0, 0, 0, 0))
    for n, f in enumerate(frames):
        strip.paste(f, (n * args.size, 0))
    strip_path = out_dir.parent / f"{src.stem}-sheet.png"
    strip.save(strip_path)

    print(f"\n  spritesheet -> {strip_path}  ({len(frames)} frames, {strip.width}x{strip.height})")
    print("  next: hand-fix poses per docs/DESIGN-SYSTEM.md section 7")


if __name__ == "__main__":
    main()
