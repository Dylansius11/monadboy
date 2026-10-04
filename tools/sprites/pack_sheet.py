"""Rebuild each character's spritesheet from its individual frames.

WHY THIS EXISTS.

`apps/web/src/ui/motion.tsx` animates by moving `background-position` across ONE image,
`apps/web/public/sprites/<character>-64.png`. The individual frames in
`apps/web/public/sprites/<character>-64/` are the editable source; the sheet is the
build output. Nothing enforced that relationship, so hand-fixing a frame left
the sheet stale and the game kept playing the old art: a character that had
been corrected to run still rendered asleep, and no amount of reading the
TypeScript explained why.

Run this after touching any frame:

    python tools/sprites/pack_sheet.py

The frame order below is the contract with `FRAMES` in apps/web/src/ui/motion.tsx. If
you reorder one you must reorder the other, which is why the order is written
out here rather than taken from a directory listing: an alphabetical listing
puts `alert` first and would silently reshuffle every animation in the game.
"""

from pathlib import Path

from PIL import Image

# Must match FRAMES in apps/web/src/ui/motion.tsx, exactly and in order.
FRAMES = [
    "idle-0",
    "idle-1",
    "run-0",
    "run-1",
    "jump",
    "sit",
    "alert",
    "happy",
]

SIZE = 64
ROOT = Path(__file__).resolve().parents[2] / "apps" / "web" / "public" / "sprites"


def pack(character: str) -> bool:
    frame_dir = ROOT / f"{character}-{SIZE}"
    if not frame_dir.is_dir():
        print(f"skip {character}: no {frame_dir.name}/")
        return False

    sheet = Image.new("RGBA", (SIZE * len(FRAMES), SIZE), (0, 0, 0, 0))

    for index, name in enumerate(FRAMES):
        path = frame_dir / f"{name}.png"
        if not path.exists():
            raise SystemExit(f"{character}: missing frame {name}.png")

        frame = Image.open(path).convert("RGBA")
        if frame.size != (SIZE, SIZE):
            # Resizing here would resample pixel art and every edge would
            # smear. A wrong size is an authoring mistake, not something to
            # paper over at build time.
            raise SystemExit(f"{character}/{name}.png is {frame.size}, expected {(SIZE, SIZE)}")

        sheet.paste(frame, (index * SIZE, 0))

    out = ROOT / f"{character}-{SIZE}.png"
    sheet.save(out)
    print(f"packed {out.name}  {sheet.width}x{sheet.height}  ({len(FRAMES)} frames)")
    return True


def main() -> None:
    characters = sorted(p.name.rsplit("-", 1)[0] for p in ROOT.glob(f"*-{SIZE}") if p.is_dir())
    if not characters:
        raise SystemExit(f"no <character>-{SIZE}/ frame directories under {ROOT}")
    for character in characters:
        pack(character)


if __name__ == "__main__":
    main()
