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

## 2. Screen grid and layout

| Property | Contract |
| --- | --- |
| Logical viewport | Landscape / held: 480 x 320 px; portrait play: native CSS dimensions |
| Base spacing / snap | 4px |
| Hairline exceptions | 1px and 2px borders / offsets |
| Safe area | 12px, `--safe` |
| Font grid | Landscape compact roles; portrait native Departure Mono roles below |
| Sprites | 16px or 32px logical pixel frames, integer scale |
| Rendering | Game: DOM/CSS and stepped SVG; decorative outer scenery: pixelated canvas |
| Image filtering | `image-rendering: pixelated` |

Laptop and held consoles keep the fixed landscape composition. Desktop play uses adaptive viewport fitting, including fractional shell enlargement when more room is available; the 480x320 logical screen and shell proportions are unchanged. Short desktop viewports shrink rather than clip controls. At <=640px in portrait, the play shell remains a native-sized handheld with no manual scale control: a flexible screen above compact, unscaled controls. Container queries on `game-screen` reflow the game without changing the landing's held consoles. Short phones scroll dense settings within the screen, with action footers pinned and D-pad focus scrolling into view.
Use integer scaling for sprite pixels inside the logical screen and snap sprite positions to the logical grid. Fractional outer-shell fitting is an explicit readability trade-off, not permission to resample sprite sheets or introduce fractional logical coordinates.
A fixed inset fit box owns screen measurement, not content height or an already transformed element.
Re-measure after `document.fonts.ready` and `visualViewport` resize.
Two independent transforms never share the same element.

Desktop fitting measures the stage, not the already-transformed shell. Widescreen
play uses the full stage; widths >=641px with viewport aspect ratio <=4:3 reserve
a64px header lane for the unscaled guide. The fit calculation uses that reduced
stage height so controls cannot extend below the viewport. GUIDE remains outside
the shell transform. No manual zoom setting or portrait-phone sizing change is added.

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

Difficulty readouts reserve a non-wrapping label column; long symbol lists wrap
only in the value column. Changing tier restores the cast to the top of the
internal scrolling region. The header and action footer do not shrink.
Quote review leads with actual range endpoints, clamp warnings, deposit and
fee estimates. Supporting execution checks stay in shallow disclosures, not
in place of visible costs or recovery. A new quote/error or return from Inputs
resets the review scroll so the relevant result is not hidden below an old offset.

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

Portrait play uses local role overrides, not a global token change: micro/body 11px with 16px line height, title 16/24, value 22/28 and hero 33/40. Sprites retain their integer art size. D-pad arms, START/SELECT, volume and screen controls meet a 44px unscaled touch minimum; A/B are 52px.
Changing numbers use tabular metrics and fixed character-width slots.
A rising counter must not move neighboring labels.

The live disk shelf uses compact, equally weighted body-role SCORE/DAMAGE
figures; selected rows invert both figures for contrast without removing labels.
Name/run, exact TESTNET MON balance and score/damage form three reading groups.
Rows keep their content height, a fixed integer sprite footprint and wrapping
long values. Native portrait spacing is container-scoped. Receipt-rich shelves
and funded gameplay scroll inside the screen with a pinned footer; selection
scrolls the active slot into view without animation. Shared live/result figures
reserve label width and let the remaining value column wrap, never clip a loss.
Charts retain their content height rather than shrinking to zero.

Check every non-ASCII glyph against the actual shipped font file before using it in player copy.
Maintain the confirmed glyph inventory from font inspection, not from what a system fallback happens to draw.
If a symbol is absent, use a supported ASCII equivalent or an explicit pixel icon.
Test arrows, signs, currency labels, punctuation, and tiny-unit text at actual phone scale.
No em-dashes in player-visible strings.

## 5. Primitives and states

| Primitive | Treatment |
| --- | --- |
| Panel | White panel, 1px edge, 2px down/right sunk-colour hard shadow, no blur |
| Bevel | Not used for DAYLIGHT screen panels |
| PixelText | Role-driven sizes and line heights from section 4 |
| Cursor | Solid accent fill, inverted text, not a required cursor glyph |
| Meter | 4px segments with 1px gaps; accent filled, sunk empty |
| Sprite | Sprite-sheet frame on a panel well, stepped animation |
| Dialog | Panel with a portrait slot on the left |
| Marquee | Linear horizontal scroll for overflow warnings |
| Tab | Panel; active bottom border joins the body |
| Field | Sunk inset, 1px edge, blinking ink block caret |
| Toggle | Accent on / sunk off, plus a supported state glyph |
| Pin | Four shape variants before colour variation |
| Ladder tile | 8px column; sunk empty, accent in range, ink active, screen + 1px edge out |
| Chart | Stepped SVG polyline, 1px ink |
| Scanline | Optional overlay, default off |

The tile draws a Kuru ladder level, never an unrelated range structure.
Do not create another spacing or type convention inside a primitive.

| State | Visible treatment |
| --- | --- |
| Rest | Panel fill and 1px meaningful edge |
| Focused / selected | Accent fill, inverted text, meaningful edge retained |
| Pressed | Translate 1px down and right for 80ms, no easing |
| Disabled | Sunk fill, dim text, soft edge, unmistakably unavailable |

Every reachable action has visible focus. Cursor position is not the same as the applied setting.
Applied values remain identifiable when the cursor moves away.
Context-dependent key labels update when their action changes.
No essential information is hover-only: D-pad, touch, and keyboard are first-class.
The key legend belongs to the console shell, not each screen's height budget.
Console touch targets are measured after the fit transform, not in the console's own pixels. At 360px wide the console renders at 0.677x, so A and B must measure 48px or more on screen, and each D-pad arm, START and SELECT 44px or more, with the button element itself carrying the hit area.

## 6. Motion contract

The more often the player sees an animation, the less it should animate.
Cursor navigation is instantaneous, not a traveling tween.

| Interaction | Exact motion |
| --- | --- |
| Cursor move | None, zero duration |
| Button press | 1px down/right, 80ms, no easing |
| Screen transition | 120ms wipe |
| Panel open | 100ms, four steps |
| Character run | `steps(4)`, 8fps, loop |
| NAD-SENSE | 600ms `steps(2)`, loop while active |
| Out of range | 200ms freeze, then desaturate over 400ms |
| Boot | 1800ms, skippable |
| Results reveal | 60ms stagger between rows |

```css
--ease-sprite-2: steps(2, end);
--ease-sprite-4: steps(4, end);
--ease-sprite-8: steps(8, end);
--ease-out-screen: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out-screen: cubic-bezier(0.77, 0, 0.175, 1);
--press-x: 1px;
--press-y: 1px;
--press-ms: 80ms;
```

No ease-in token. It delays the first visible response and reads as lag.
Sprites and grid-positioned UI use steps, never springs or fractional coordinates.
Real curves are reserved for full-screen effects; springs are allowed only on the illustrated shell.
Press feedback is translation, not `scale(0.97)`, which blurs pixel borders.
Separate fit scaling and interaction transforms on different wrappers.
Reduced motion disables boot and NAD-SENSE pulsing; retain direct input feedback and state changes.
Existing motion is preserved; a live data connection is not permission to restyle it.

## 7. Sprite, scanline, and shell rules

Author logical sprite pixel frames at 16px or 32px; scale by whole-number factors only.
A 64px sheet / display footprint may package or display a frame but is not permission for fractional resampling.
Keep sprite-sheet metadata, frame boundaries, integer positions, and `image-rendering: pixelated` aligned.
Judge silhouettes at actual 1x logical size before inspecting enlarged art.
Running, edge-warning, and sitting states must be distinguishable without reading a formula.
Palette changes do not decouple the mascot from its difficulty.

Scanlines are optional and off by default.

```css
.scanlines {
  background: repeating-linear-gradient(
    to bottom, transparent 0 3px, rgba(14, 9, 28, 0.14) 3px 4px
  );
  pointer-events: none;
}
```

The overlay removes a row in four from small glyphs, so legibility wins over nostalgic texture.
Never use chromatic aberration or barrel distortion; both resample the grid.

The shell uses these illustrated-plastic constants:

```css
--shell: #6E54FF;
--shell-d: #4A35C4;
--shell-dd: #3A2A9E;
--shell-l: #9C89FF;
--btn: #E4DFFF;
--btn-d: #B3A6EC;
```

`apps/web/src/console` owns shell materials, input, fit scale, and the key legend, never money.
The centered laptop console sits above a seeded pixel night city: layered facades, roof details, a crescent moon, elevated railway, harbour reflections and a foreground railing.
The city draws once per resize; only a small train moves by compositor transform.
Reduced motion freezes the train; hidden tabs pause it. No scenery implies a live fill or affects a game number.
Portrait phones reserve a 52px safe-area-aware GUIDE header. The city is cropped
into that header and outer framing, never behind the game text. The native shell
keeps 44px controls and a flexible bright screen; unusually short viewports scroll
instead of scaling or clipping controls. Held landing consoles keep landscape layout.

The landing page preserves the same city, console and factual copy. Its primary
PRESS START action has a 64px minimum height; short phones use 16px action text
to keep the label on one line. Hero copy has a protected dark reading area,
and tablet/phone sections reflow without turning the site into a generic card grid.
A fixed top bar turns solid once the page moves and shows a small START key after
the hero leaves. An LED sign under the hero crawls one whole pixel per step.
The how-it-plays rail pins the real console through four beats (card, tracker,
range, live); the rail fill is the scroll position, and each beat rings the keys
it names on the held console. Every screen change, on the page and in `/play`,
uses the 120ms four-step wipe. The ladder illustration is labelled as not market
data; the cast select reads its filter rows from the SDK gates, never retyped.

Production gameplay screens share the fixture screens' layout, filled only with
chain and worker reads. SET RANGE uses square amount keys (real options and MAX),
equal WIDE / TIGHT / MANUAL keys, and a ladder bar drawn from quoted orders; before
a quote it says the levels are not drawn yet. Receipts are a stepper whose
confirmed, broadcast, not-sent and reverted states differ in shape, not only text.
CURRENT POSITION puts SCORE, DAMAGE and NET at equal weight above an arena that
fills the remaining screen; chain holdings and sources live behind START. Results
show only measured facts: no time-in-range row exists until it is recorded.
An empty tracker names the stricter tier honestly (EASY filters hardest) and lists
the closest pools with the first gate each failed.

### Volume

The shared VOL slider is the only visible sound control. Zero is exact silence.
An explicit adjustment clears a stored mute; M still mutes/restores the saved level.
While M-muted, the slider displays zero rather than a misleading nonzero level.
No audio starts before a trusted gesture. Browser gain/state proof is not physical-speaker proof.
The background loop's pre-master gain is0.0675, fifteen percent of its previous
0.45gain. Effects and the player's VOL setting are unchanged. An accepted jump
uses a160ms rising chip tone; paused/busy/out-of-range review does not emit it.
The stepped300ms jump respects reduced motion; sound does not imply a chain fill.

### On-demand guide

RULE BOOK is an unscaled viewport launcher at the desktop's upper right; portrait
phones show GUIDE in the safe header. The native modal first shows current-screen
actions. HOW TO PLAY and CONTROLS are explicit sections, not one long initial page.
Live and opt-in fixture guidance stay distinct. Escape restores opener focus;
keyboard, touch and gamepad input cannot reach the game while the guide is open.

## 8. Verification contract

Phase 2 palette checks compare CSS and TypeScript, contrast pairs, decorative exceptions, and grid constants.
They enforce the landscape tokens, grid-aligned spacing and stepped easing. Native portrait sizing and clipping are checked on the rendered screen, not by source-text assertions.
A token addition updates its mirror and contrast contract or explicitly records why it is decorative.
Tests do not prove phone readability or motion quality.

Render at a 412px phone viewport and inspect every screen, including formula and error panels.
Wait for the real font, check all glyphs, inspect overflow, and exercise every reachable selection state.
Judge the transition out of range, not only the calm live screen.
Confirm equal-weight SCORE/DAMAGE, readable TESTNET labels, and sprite / accent separation.
Report whether the surface was actually seen rendered; Phase 1 has no screen implementation to inspect.
