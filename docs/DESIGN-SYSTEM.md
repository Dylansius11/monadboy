# MONADBOY design system: DAYLIGHT

This document owns the chosen screen language, grid, type, motion, sprites, and interaction states.
`apps/web/src/styles/tokens.css` is the implementation source of truth; it lands in Phase 2.
`apps/web/src/design/palette.ts` mirrors the palette, with 41 palette assertions planned in Phase 2.
These are planned files and checks, not claims that implementation is already present.

## 1. Decision and thesis

DAYLIGHT is the chosen system: a near-white screen, hard dark borders, and purple selection fills.
The product lowers the intimidation of finance instead of imitating a dark trading terminal.
A bright field makes numbers and the toy-like interface legible in a lit room and on a phone.

The decision is about the screen's value key, not changing the console shell.
Dark / cyan treatment offers strong sprite contrast but reads like a terminal.
A four-value lavender treatment is disciplined but makes a dense two-axis tracker harder to distinguish.
DAYLIGHT argues the approachable-product thesis while retaining enough semantic separation for the tracker.
Its trade-off is a more paper-like screen and deliberate separation of purple characters from purple controls.

The shell is illustrated purple plastic; the screen is crisp pixel UI.
Purple sprites carry a strong dark outline. Check actual silhouette contrast before adding a light rim.
An optional 1px light rim is a per-sprite readability treatment, not a mandatory recolouring pass.
References inform density, not a borrowed visual identity.

## 2. Fixed grid and layout

| Property | Contract |
| --- | --- |
| Logical viewport | 480 x 320 px, fixed |
| Base spacing / snap | 4px |
| Hairline exceptions | 1px and 2px borders / offsets |
| Safe area | 12px, `--safe` |
| Font grid | 8px bitmap, integer size multiples |
| Sprites | 16px or 32px logical pixel frames, integer scale |
| Rendering | DOM/CSS; stepped SVG chart; no canvas |
| Image filtering | `image-rendering: pixelated` |

The viewport never becomes a responsive layout. Only the enclosing fit scale changes.
Use integer scaling for sprite pixels and snap sprite positions to the logical grid.
A fixed inset fit box owns screen measurement, not content height or an already transformed element.
Re-measure after `document.fonts.ready` and `visualViewport` resize.
Two independent transforms never share the same element.

```css
--spacing: 4px;
--unit: 4px;
--gap-xs: 4px;
--gap-sm: 8px;
--gap-md: 16px;
--gap-lg: 24px;
--gap-xl: 32px;
--screen-w: 480px;
--screen-h: 320px;
--safe: 12px;
```

| Spacing utility | Pixels | Typical role |
| --- | --- | --- |
| `1` | 4 | Glyph-to-label and small internal gaps |
| `2` | 8 | List rows |
| `3` | 12 | Bezel safe area |
| `4` | 16 | Groups |
| `6` | 24 | Sections |
| `8` | 32 | Hero padding |

Do not bypass the grid with arbitrary spacing such as 7px.
One flex region absorbs remaining height. Do not hand-sum component heights to 320px.
Budget text using its component's default role and line height, including wrapped lines.
Development overflow warnings make silent clipping observable; verify the actual rendered screen.

## 3. Palette and contrast

The values below define the chosen tokens. Implementation changes happen in tokens.css and its palette mirror together.
Ratios are rounded design-reference measurements, not evidence of a rendered screen check in Phase 1.

| Token | Hex | Role / reference contrast |
| --- | --- | --- |
| `--color-screen` | `#F4F1FF` | Faint lavender screen field |
| `--color-panel` | `#FFFFFF` | Raised panels, rows, dialogs, sprite wells |
| `--color-sunk` | `#DDD7FE` | Wells, empty tracks, hard shadow |
| `--color-ink` | `#0E091C` | Body text, about 17.6:1 on screen |
| `--color-ink-dim` | `#4A35C4` | Labels, units, meta; about 7.3:1 on screen |
| `--color-ink-invert` | `#FFFFFF` | Text on accent / ink fills |
| `--color-edge` | `#0E091C` | Meaningful borders |
| `--color-edge-soft` | `#9B87FF` | Decorative rules only, about 2.6:1 |
| `--color-accent` | `#6E54FF` | Selection fill, white text about 4.8:1 |
| `--color-gain` | `#1E7A34` | SCORE and positive values, about 4.85:1 on screen |
| `--color-loss` | `#C41A1A` | DAMAGE and negative values, about 5.38:1 on screen |
| `--color-alarm` | `#FF3B3B` | Out-of-range banner shape, about 3.18:1 |
| `--color-alarm-ink` | `#0E091C` | Banner text, about 5.53:1 on alarm |
| `--color-warn` | `#FFAE45` | NAD-SENSE strip fill, about 1.66:1 on screen |
| `--color-warn-ink` | `#0E091C` | Strip text, about 10.6:1 on warn |
| `--color-character` | `#6E54FF` | Character palette anchor |

Text targets are 4.5:1; meaningful non-text objects target 3:1.
Use the darker gain and loss tokens for text. Bright alarm and warning tokens are fills.
White on bright alarm is about 3.54:1 and is not the banner text treatment.
Do not use `#2BA84A` for gain text: its roughly 2.77:1 contrast fails both 4.5:1 body and 3:1 large-text floors.
Accent purple as text on the screen is about 4.31:1; use ink-dim for purple text instead.
Monad cyan `#85E6FF` is about 1.3:1 on the light field, so it is not gain text.
The gain green is a deliberate brand-palette deviation to make outcomes legible.
A monochrome alternative uses ink plus a `+` sign, never an illegible brand colour.

Soft edges must never be the sole boundary of an enabled control.
Shape carries meaning before colour: pin silhouette, signs on values, selected fill, and readable labels.
SCORE and DAMAGE have identical role, size, placement prominence, and evidence affordances.

Character purple and interface purple are intentionally the same.
Sprites never sit directly on an accent fill.
A selected row with a portrait places the portrait in a separate panel-coloured cell with an edge border.
The separation is contextual, not another nearly identical purple.

## 4. Type and glyphs

Departure Mono is the bitmap monospace face, chosen for stable numeric metrics.
Self-host the font in Phase 2 with `font-display: block`.
A system monospace fallback is metrically different; do not approve layout from it.

| Role | Utility | Font size | Line height | Use |
| --- | --- | --- | --- | --- |
| title | `text-title` | 16px | 24px | Uppercase screen headers |
| value | `text-value` | 16px | 20px | Financial / game values |
| body | `text-body` | 8px | 16px | Descriptions and dialogue |
| micro | `text-micro` | 8px | 12px | Labels, units, metadata |
| hero | `text-hero` | 32px | 40px | Boot and results |
| sprite | `text-sprite` | 64px | 64px | Sprite-scale display role, not body text |

Line heights are exactly title 24, value 20, body 16, micro 12, hero 40, sprite 64.
Do not confuse line height with font size. 12px, 20px, and 24px font sizes resample the 8px base.
Changing numbers use tabular metrics and fixed character-width slots.
A rising counter must not move neighboring labels.

Check every non-ASCII glyph against the actual shipped font file before using it in player copy.
Maintain the confirmed glyph inventory from font inspection, not from what a system fallback happens to draw.
If a symbol is absent, use a supported ASCII equivalent or an explicit pixel icon.
Test arrows, signs, currency labels, punctuation, and tiny-unit text at actual phone scale.
No em-dashes in player-visible strings.

