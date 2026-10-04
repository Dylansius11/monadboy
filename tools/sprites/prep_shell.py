"""
Prepare a generated console shell for use as live UI chrome.

Does three things the raw generation cannot:
  1. keys the white studio background to transparent, by flood fill from the
     corners, so the shell can sit on a patterned backdrop
  2. finds the screen rectangle, so the live 480x320 board can be positioned
     inside it to the pixel instead of by eye
  3. emits the CSS custom properties for that rectangle as percentages, so the
     placement survives any scale

Usage:
    py tools/sprites/prep_shell.py assets/game-shell/game-console.jpeg
"""

import argparse
import json
from collections import deque
from pathlib import Path

from PIL import Image


def key_background(img, tol=34):
    """Flood fill the studio background from the four corners."""
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    corners = [px[0, 0][:3], px[w - 1, 0][:3], px[0, h - 1][:3], px[w - 1, h - 1][:3]]
    bg = max(set(corners), key=corners.count)

    def near(p):
        return sum(abs(a - b) for a, b in zip(p[:3], bg)) <= tol * 3

    seen = [[False] * h for _ in range(w)]
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near(px[x, y]):
                seen[x][y] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not seen[x][y] and near(px[x, y]):
                seen[x][y] = True
                q.append((x, y))

    n = 0
    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        n += 1
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not seen[nx][ny] and near(px[nx, ny]):
                seen[nx][ny] = True
                q.append((nx, ny))
    return img, n


def find_screen(img, thresh=63):
    """
    The screen is the largest CONNECTED dark region.

    A per-row brightness scan does not work: the shell's own outline is dark
    too, so scanning rows independently unions the screen with the lid border
    and returns a rectangle far taller than the display. Connectivity keeps the
    two apart, because the outline never touches the screen.
    """
    rgb = img.convert("RGB")
    px = rgb.load()
    w, h = rgb.size
    dark = [[sum(px[x, y]) < thresh * 3 for y in range(h)] for x in range(w)]
    seen = [[False] * h for _ in range(w)]
    best = None

    for sx in range(0, w, 3):
        for sy in range(0, h, 3):
            if not dark[sx][sy] or seen[sx][sy]:
                continue
            q = deque([(sx, sy)])
            seen[sx][sy] = True
            minx = maxx = sx
            miny = maxy = sy
            n = 0
            while q:
                x, y = q.popleft()
                n += 1
                minx, maxx = min(minx, x), max(maxx, x)
                miny, maxy = min(miny, y), max(maxy, y)
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and dark[nx][ny] and not seen[nx][ny]:
                        seen[nx][ny] = True
                        q.append((nx, ny))
            if best is None or n > best[0]:
                best = (n, minx, miny, maxx, maxy)

    if not best:
        return None
    return best[1], best[2], best[3] + 1, best[4] + 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("shell")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    src = Path(args.shell)
    out = Path(args.out) if args.out else src.with_suffix(".png")

    img = Image.open(src)
    keyed, n = key_background(img)
    print(f"  keyed {n} background pixels -> transparent")

    rect = find_screen(img)
    if not rect:
        raise SystemExit("could not locate the screen rectangle")
    l, t, r, b = rect
    W, H = img.size
    sw, sh = r - l, b - t

    keyed.save(out)
    print(f"  shell -> {out}  ({W}x{H})")

    meta = {
        "shell": out.name,
        "size": [W, H],
        "screen_px": [l, t, sw, sh],
        "screen_pct": {
            "left": round(l / W * 100, 3),
            "top": round(t / H * 100, 3),
            "width": round(sw / W * 100, 3),
            "height": round(sh / H * 100, 3),
        },
        "screen_aspect": round(sw / sh, 4),
        "target_aspect": round(480 / 320, 4),
    }
    (out.parent / "shell.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    print(f"  screen  {sw}x{sh}px  aspect {meta['screen_aspect']}  (target 1.5)")
    print(f"  css     left:{meta['screen_pct']['left']}%  top:{meta['screen_pct']['top']}%")
    print(f"          width:{meta['screen_pct']['width']}%  height:{meta['screen_pct']['height']}%")
    if abs(meta["screen_aspect"] - 1.5) > 0.08:
        print("  ! screen aspect is off 3:2. the board will letterbox inside the bezel.")


if __name__ == "__main__":
    main()
