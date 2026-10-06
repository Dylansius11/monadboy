import { brand } from '../../config/brand'
import { GAMEPAD_BUTTONS, INTENTS, intentFromKey } from '../../console/intents'
import {
  DAMAGE_APR,
  FEE_APR,
  REBALANCE_COST_FRACTION,
  STEP_SECONDS,
} from '../sim'
import type { ConsoleIntent } from '../../console/intents'

/**
 * What the rule book says. Pure data and pure functions, so the copy and the
 * routing are testable without a DOM.
 *
 * Every number comes from the module that owns it (sim.ts constants), and
 * every control line describes what the screen's own intent handler does. A
 * line here that disagrees with a screen is a bug in this file.
 */

export type TopicId = 'testnet' | 'score' | 'recenter'

export interface Topic {
  heading: string
  lines: ReadonlyArray<string>
}

export interface Guide {
  title: string
  summary: string
  /** [button, what it does on this screen] */
  keys: ReadonlyArray<readonly [string, string]>
  notes: ReadonlyArray<string>
  topics: ReadonlyArray<TopicId>
}

const pct = (fraction: number, digits: number) =>
  `${(fraction * 100).toFixed(digits)}%`

export const TOPICS: Record<TopicId, Topic> = {
  testnet: {
    heading: 'TESTNET and FIXTURE',
    lines: [
      `TESTNET means every balance shown is testnet funds. No real money moves anywhere in ${brand.CONSOLE_NAME}.`,
      'FIXTURE marks numbers that come from committed sample data or from the local simulation. They are not a live quote and not a chain fill.',
    ],
  },
  score: {
    heading: 'SCORE and DAMAGE',
    lines: [
      'SCORE is fee income earned while price sits inside your range. DAMAGE is what the position loses, shown at the same size as SCORE and never hidden.',
      'NET is what you keep. The inputs view prints DAMAGE = max(0, SCORE - NET), and a surplus above SCORE is preserved.',
      `In the FIXTURE simulation SCORE accrues at ${pct(FEE_APR, 0)} a year while in range. DAMAGE accrues at ${pct(DAMAGE_APR, 0)} a year while out of range. One tick is ${STEP_SECONDS / 3_600} simulated hour.`,
    ],
  },
  recenter: {
    heading: `Re-center and ${brand.AUTOPILOT_NAME}`,
    lines: [
      'Re-centering moves your range to the current price. It is always manual: press A while OUT OF RANGE on the live screen.',
      `It costs a swap. In the FIXTURE simulation that is ${pct(REBALANCE_COST_FRACTION, 2)} of your deposit, counted as DAMAGE. A real swap also pays slippage and gas.`,
      `${brand.AUTOPILOT_NAME} re-arms your flip orders after every fill. It does not re-center the range and adds no fee. In this FIXTURE build the setting is displayed but the simulation does not use it, so it changes no numbers.`,
    ],
  },
}

const GALLERY: Guide = {
  title: 'Primitives gallery',
  summary:
    'A developer view of every interface part, at real size, on FIXTURE data.',
  keys: [
    ['Up / Down', 'Move the list cursor.'],
    ['Left / Right', 'Change the character.'],
    ['A', 'Toggle scanlines.'],
    ['START', 'Switch the tab.'],
  ],
  notes: ['B and SELECT do nothing here.'],
  topics: ['testnet'],
}

const FALLBACK: Guide = {
  title: 'Console',
  summary:
    'The controls work the same on every screen. Open a screen to see its own guide.',
  keys: [],
  notes: [],
  topics: ['testnet'],
}

/**
 * Keyed by route id with the pathless `/_console` layout stripped, so a guide
 * follows the URL a player sees. `/play/` is the boot screen.
 */
const GUIDES: Record<string, Guide> = {
  '/play/': {
    title: 'Power on',
    summary: `${brand.CONSOLE_NAME} runs a short boot, then waits on the title. ${brand.CARTRIDGE_01} is the cartridge inside.`,
    keys: [
      ['START or A', `Continue to the ${brand.WALLET_UNIT} screen.`],
      ['Any other button', 'Skip the boot animation.'],
    ],
    notes: [
      'The full boot plays once per browser session. Later visits, and reduced motion, open on the final frame.',
    ],
    topics: ['testnet'],
  },
  '/card': {
    title: brand.WALLET_UNIT,
    summary: `Your ${brand.WALLET_UNIT} holds your ${brand.SAVE_UNIT}s.`,
    keys: [
      ['Up / Down', 'Move between INSERT CARD and NEW CARD.'],
      [
        'A',
        `Insert the card and go to your ${brand.SAVE_UNIT}s. With a card already in, the first row reads CONTINUE.`,
      ],
      ['B', 'Back to the title.'],
    ],
    notes: [
      'Sign-in is not wired yet. Both rows load the same committed FIXTURE card, so nobody is logged in and nothing is signed.',
    ],
    topics: ['testnet'],
  },
  '/disks': {
    title: `Select ${brand.SAVE_UNIT}`,
    summary: `Each ${brand.SAVE_UNIT} keeps one run history bound to a difficulty.`,
    keys: [
      ['Up / Down', 'Move between disks. Empty slots are skipped.'],
      ['A', 'Open the highlighted disk. Its difficulty is applied, then cartridges open.'],
      ['B', `Back to the ${brand.WALLET_UNIT}.`],
    ],
    notes: [
      'The disks and the card address are FIXTURE data. An empty slot cannot be opened because creating a disk is not wired yet.',
    ],
    topics: ['testnet'],
  },
  '/cartridges': {
    title: 'Select cartridge',
    summary: 'Pick the game to insert. Locked cartridges cannot be inserted.',
    keys: [
      ['Left / Right', 'Move between cartridges.'],
      ['A', 'Insert the highlighted cartridge and choose a difficulty.'],
      ['B', `Back to your ${brand.SAVE_UNIT}s.`],
      ['START', 'Open the leaderboard.'],
    ],
    notes: [
      'The cartridge list is FIXTURE data. Tapping an unlocked cartridge inserts it in one tap.',
    ],
    topics: ['testnet'],
  },
  '/play/difficulty': {
    title: 'Choose your Monanimal',
    summary:
      'EASY, NORMAL and HARD each pair one Monanimal with its own pool filters, listed on the screen.',
    keys: [
      ['Left / Right', 'Pick the tier. It does not wrap.'],
      ['Up / Down', 'On HARD only, move between the tier row and GOD MODE.'],
      [
        'A',
        'On the tier row, confirm and open the pool tracker. On the GOD MODE row, turn it off, or start the confirm to turn it on.',
      ],
      ['B', 'Back to cartridges.'],
    ],
    notes: [
      'The filter numbers are FIXTURE.',
      'GOD MODE turns off every pool filter except the sellability check, which always stays on. Turning it on needs a deliberate spelling confirm: Left / Right pick a letter, A tries it, B erases a letter or cancels.',
    ],
    topics: ['testnet'],
  },
  '/play/tracker': {
    title: 'Pool tracker',
    summary:
      'A map of pools. Each pin is one pool: Safety runs left to right and Heat runs bottom to top.',
    keys: [
      ['D-pad', 'Move the cursor to the nearest pin in that direction.'],
      ['SELECT', 'Cycle the map zoom through its three levels.'],
      ['A', 'Open details for the highlighted pool.'],
      ['B', 'Back to difficulty.'],
      [
        'A in details',
        'Play the pool, but only if it reads PLAYABLE and TESTNET. Setting the range opens next.',
      ],
      ['B in details', 'Back to the map.'],
    ],
    notes: [
      'Pin colours read Safe, Risky or Very risky. Details list every term behind Safety and Heat.',
      'Pools marked MAINNET READ ONLY, BOOK TOO THIN or LOCKED BY FILTER cannot be played.',
      'Fee income is an estimate from 24h volume and pool size. It is not a promise.',
      'If every pool fails the filter the screen says Nothing passed. Press B and try an easier tier.',
      'The pools are FIXTURE data.',
    ],
    topics: ['testnet'],
  },
  '/play/range/$id': {
    title: 'Set your range',
    summary:
      'Choose how much to deposit and how wide the range is. The picture shows where your orders would sit.',
    keys: [
      ['Up / Down', `Move between HOW MUCH, HOW WIDE and ${brand.AUTOPILOT_NAME}.`],
      [
        'Left / Right',
        `HOW MUCH steps the amount, capped by your TESTNET balance. HOW WIDE moves between WIDE, TIGHT and MANUAL, and WIDE and TIGHT apply at once. On ${brand.AUTOPILOT_NAME} it toggles.`,
      ],
      ['A', 'Confirm and start the live screen. On the MANUAL chip it opens the range editor instead.'],
      ['SELECT', 'Open the manual range editor.'],
      ['START', 'Open the inputs view: the source and formula behind each number here. START or B closes it.'],
      ['B', 'Back to the pool tracker.'],
    ],
    notes: [
      'Width is arithmetic from the pool 24h volatility. It is not a prediction.',
      'YOU WILL HOLD shows what your deposit becomes. Part of your quote token is swapped first, and the swap cost shown is an estimate before slippage and gas.',
      'In the manual editor, Up / Down pick START or END, Left / Right step that edge, A applies, SELECT returns to the suggested range and B cancels.',
      'Every number is FIXTURE and TESTNET funds do not move here.',
    ],
    topics: ['testnet', 'recenter'],
  },
  '/play/live/$id': {
    title: 'Live position',
    summary:
      'A simulated session over fixture data. The face, the banner and the numbers all report where price is against your range.',
    keys: [
      [
        'A',
        'In range, jump (a visual only). OUT OF RANGE, re-center the range to the current price by hand, which costs a swap.',
      ],
      ['SELECT', 'A FIXTURE demo control: nudge price toward the nearer edge to show OUT OF RANGE on demand.'],
      ['START', 'Open the inputs view: sources, SCORE, DAMAGE and the formulas. START or B closes it.'],
      ['B', 'Withdraw and go to the results.'],
    ],
    notes: [
      `${brand.ALERT_NAME} warns when price is close to the edge of your range. It measures distance to your edges and does not predict anything.`,
      'If the price feed is not live, SCORE freezes, A and SELECT stop, and B still withdraws.',
      'This is a simulation over FIXTURE data, not a chain position.',
    ],
    topics: ['testnet', 'score', 'recenter'],
  },
  '/play/results/$id': {
    title: 'Session over',
    summary: 'The recorded result of the session you just finished.',
    keys: [
      ['A or B', `Back to your ${brand.SAVE_UNIT}s.`],
      ['START', 'Open the inputs view. It needs a finished session. START or B closes it.'],
    ],
    notes: [
      'TIME IN RANGE is the skill number: the share of ticks spent inside your range. It is FIXTURE, not a live leaderboard.',
      'Rebalanced counts the times you pressed A out of range yourself.',
      'The session is a FIXTURE simulation. Sealed saves are not wired yet.',
    ],
    topics: ['testnet', 'score', 'recenter'],
  },
  '/leaderboard': {
    title: 'Leaderboard',
    summary:
      'Compare TESTNET disk runs measured by the worker from chain fills and price samples. This screen never substitutes fixture rankings.',
    keys: [
      ['Left / Right', 'Choose 24h, 7d or All. The window does not wrap and is kept in the URL.'],
      ['Up / Down', 'Move between the measured disk rows.'],
      ['A', 'Open the highlighted disk’s last fill in the explorer, if one was read. If the worker read failed, retry it instead.'],
      ['B', 'Back to cartridges.'],
    ],
    notes: [
      'Tap a window to select it. Tap a disk row to highlight it, then use A LAST FILL to open its evidence.',
      'SCORE is realized flip spread. DAMAGE is the loss compared with holding the starting inventory; NET is that holding-relative difference. SCORE and DAMAGE have equal visual weight.',
      'The source, chain-read timestamp and computation age appear above the rows. STALE, OFFLINE and PARTIAL describe the actual read, not a new measurement.',
      'With partial fill history, SCORE is only what was read so far, and NET and DAMAGE are not read. Missing measurements are shown as missing, not zero.',
      'No configured market, no computed leaderboard or no disks produces an honest empty state. START and SELECT do nothing here.',
    ],
    topics: ['testnet'],
  },
  '/gallery': GALLERY,
}

/** The guide for a route id. Unknown routes get the controls-only fallback. */
export function guideForRoute(routeId: string | undefined): Guide {
  if (!routeId) return FALLBACK
  return GUIDES[routeId.replace(/^\/_console(?=\/)/, '')] ?? FALLBACK
}

export interface KeyMapRow {
  intent: ConsoleIntent
  button: string
  keyboard: ReadonlyArray<string>
  gamepad: ReadonlyArray<string>
}

const BUTTON_LABEL: Record<ConsoleIntent, string> = {
  UP: 'D-pad up',
  DOWN: 'D-pad down',
  LEFT: 'D-pad left',
  RIGHT: 'D-pad right',
  A: 'A',
  B: 'B',
  START: 'START',
  SELECT: 'SELECT',
}

const KEY_LABEL: Record<string, string> = {
  arrowup: 'Up arrow',
  arrowdown: 'Down arrow',
  arrowleft: 'Left arrow',
  arrowright: 'Right arrow',
  ' ': 'Space',
  escape: 'Escape',
  enter: 'Enter',
  shift: 'Shift',
}

const PAD_LABEL: Record<number, string> = {
  0: 'bottom face button',
  1: 'right face button',
  8: 'Back / Select',
  9: 'Start',
  12: 'D-pad up',
  13: 'D-pad down',
  14: 'D-pad left',
  15: 'D-pad right',
}

/**
 * Keys that could be on the map. Each is resolved through the real
 * `intentFromKey`, so a key that stops mapping disappears from the book
 * instead of lingering in it.
 */
const KEY_CANDIDATES: ReadonlyArray<string> = [
  'ArrowUp',
  'w',
  'ArrowDown',
  's',
  'ArrowLeft',
  'a',
  'ArrowRight',
  'd',
  'z',
  ' ',
  'x',
  'Escape',
  'Enter',
  'Shift',
]

export function keyMapRows(): ReadonlyArray<KeyMapRow> {
  return INTENTS.map((intent) => ({
    intent,
    button: BUTTON_LABEL[intent],
    keyboard: KEY_CANDIDATES.filter((key) => intentFromKey(key) === intent).map(
      (key) => KEY_LABEL[key.toLowerCase()] ?? key.toUpperCase(),
    ),
    gamepad: [
      ...Object.entries(GAMEPAD_BUTTONS)
        .filter(([, mapped]) => mapped === intent)
        .map(([index]) => PAD_LABEL[Number(index)] ?? `button ${index}`),
      ...(intent === 'UP' ||
      intent === 'DOWN' ||
      intent === 'LEFT' ||
      intent === 'RIGHT'
        ? [`left stick ${intent.toLowerCase()}`]
        : []),
    ],
  }))
}
