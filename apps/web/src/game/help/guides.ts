import { brand } from '../../config/brand'
import { USE_FIXTURES } from '../../config/runtime'
import { GAMEPAD_BUTTONS, INTENTS, intentFromKey } from '../../console/intents'
import {
  DAMAGE_APR,
  FEE_APR,
  REBALANCE_COST_FRACTION,
  STEP_SECONDS,
} from '../sim'
import type { ConsoleIntent } from '../../console/intents'

export type TopicId =
  'testnet' | 'score' | 'recenter' | 'fixture-score' | 'fixture-recenter'

export interface Topic {
  heading: string
  lines: ReadonlyArray<string>
}

export interface Guide {
  title: string
  summary: string
  /** Console button and its current-screen action, not a keyboard map. */
  keys: ReadonlyArray<readonly [string, string]>
  notes: ReadonlyArray<string>
  topics: ReadonlyArray<TopicId>
}

type ScreenGuide = Omit<Guide, 'topics'>

const pct = (fraction: number, digits: number) =>
  `${(fraction * 100).toFixed(digits)}%`

export const TOPICS: Record<TopicId, Topic> = {
  testnet: {
    heading: 'Testnet, not real money',
    lines: [
      'Balances use TESTNET tokens. Live play can sign real testnet transactions; mainnet markets are read-only.',
      'FIXTURE means opt-in sample data or local simulation, never a substitute for an unavailable live source.',
    ],
  },
  score: {
    heading: 'SCORE, DAMAGE and NET',
    lines: [
      'SCORE measures eligible realized flip spread, not promised income. DAMAGE shows the downside with equal weight.',
      'NET is the difference from holding your starting inventory, not your account balance or guaranteed profit. DAMAGE = max(0, SCORE - NET).',
      'Missing or incomplete measurements stay unavailable, not zero. Inputs and explorer links show the source of the numbers.',
    ],
  },
  recenter: {
    heading: 'Your range and manual re-center',
    lines: [
      'Choose a deposit and range, get the actual quote, then review the separate testnet steps before confirming. Observed volatility is not a prediction.',
      'Flip orders re-arm on fills. They do not move your range. OUT OF RANGE, review the exit cost, exit manually, then review and confirm a fresh ladder.',
      'Re-centering can cost swaps, gas and slippage. A paused price feed is not a new measurement; withdrawal remains available.',
    ],
  },
  'fixture-score': {
    heading: 'Fixture simulation',
    lines: [
      `SCORE models in-range income at ${pct(FEE_APR, 0)} a year; DAMAGE models out-of-range loss at ${pct(DAMAGE_APR, 0)} a year. A tick is ${STEP_SECONDS / 3_600} simulated hour.`,
      'These are simulation rules, not measured fills or returns. NET compares the simulated position with holding the starting inventory; SCORE and DAMAGE remain equally visible.',
    ],
  },
  'fixture-recenter': {
    heading: 'Fixture range and re-center',
    lines: [
      `A while OUT OF RANGE manually re-centers, charging ${pct(REBALANCE_COST_FRACTION, 2)} of the deposit as DAMAGE.`,
      `${brand.AUTOPILOT_NAME} is displayed in fixture mode but does not change the simulation. No chain funds move.`,
    ],
  },
}

/** These actions follow the actual route handlers; live is the default. */
const GUIDES: Record<string, ScreenGuide> = {
  '/play/': {
    title: 'Power on',
    summary: `Start ${brand.CARTRIDGE_01} on ${brand.CONSOLE_NAME}.`,
    keys: [
      ['START or A', `Continue to your ${brand.WALLET_UNIT}.`],
      ['Other buttons', 'Skip the boot animation.'],
    ],
    notes: [
      'The full boot plays once per browser session; reduced motion opens on the final frame.',
    ],
  },
  '/card': {
    title: brand.WALLET_UNIT,
    summary:
      'INSERT CARD restores your existing passkey card. NEW CARD creates a different one.',
    keys: [
      ['Up / Down', 'Choose INSERT CARD or NEW CARD.'],
      [
        'A or tap a row',
        'Complete the reader prompt, then open your save disks. CONTINUE uses the inserted card.',
      ],
      ['B', 'Back to the title; cancel an active reader prompt.'],
      ['SELECT', 'Eject an inserted card.'],
    ],
    notes: [
      'A failed restore does not create a new card. Eject ends the local signing session, not the chain position.',
    ],
  },
  '/disks': {
    title: `Select ${brand.SAVE_UNIT}`,
    summary:
      'Select one of your three disk accounts. An empty slot can be funded, created and sealed to your card.',
    keys: [
      ['Up / Down or tap a slot', 'Select a disk or empty slot.'],
      [
        'A',
        'Open a disk, create an empty one, or retry an unreadable slot. Follow the funding and save status.',
      ],
      ['START', 'Show the selected slot’s disk account, and a disk’s sealed proof, with its explorer link.'],
      ['SELECT', 'Eject the card and return to the card slot.'],
      ['B', 'Close that view, or return to your card.'],
    ],
    notes: [
      'Unreadable slots are not empty. Explorer links show confirmed accounts and saves; eject ends the local signing session.',
    ],
  },
  '/cartridges': {
    title: 'Select cartridge',
    summary: 'Choose an unlocked cartridge. Open a saved disk first to play.',
    keys: [
      ['Left / Right', 'Choose a cartridge.'],
      [
        'A or tap a cartridge',
        'Insert it and choose a difficulty; without a disk, return to the disk shelf.',
      ],
      ['START', 'Open the leaderboard.'],
      ['B', 'Back to disks.'],
    ],
    notes: ['Locked cartridges cannot be inserted.'],
  },
  '/play/difficulty': {
    title: 'Choose your Monanimal',
    summary: 'EASY, NORMAL and HARD apply the pool filters shown on screen.',
    keys: [
      ['Left / Right', 'Choose a tier.'],
      ['Up / Down on HARD', 'Choose the tier row or GOD MODE.'],
      [
        'A',
        'Confirm and save preferences before opening the tracker, or change GOD MODE on its row.',
      ],
      ['B', 'Back to cartridges.'],
    ],
    notes: [
      'GOD MODE relaxes filters, never the sellability check. Enabling it needs a spelling confirm: Left / Right choose a letter, A tries it, B erases or cancels.',
      'Pool counts come from the worker read. Unavailable inputs do not become fixture counts.',
    ],
  },
  '/play/tracker': {
    title: 'Pool tracker',
    summary:
      'Choose a pool on the worker’s map: Safety runs left to right, Heat bottom to top.',
    keys: [
      ['D-pad or tap a pin', 'Select a pool. A reticle marks a playable TESTNET market.'],
      [
        'A',
        'Open details; A in details plays only an executable TESTNET pool.',
      ],
      ['SELECT', 'Cycle the three map zoom levels.'],
      ['B', 'Close details, or return to difficulty.'],
      ['A when nothing passed', 'Open the nearest looser tier that would admit a playable TESTNET market on this read, to confirm there.'],
    ],
    notes: [
      'MAINNET READ ONLY, thin books and failed filters cannot be played. EASY filters hardest; when nothing passes, the screen names the looser tier that would let a playable market through, if any does.',
      'Source and age describe the worker read. Offline or missing markets stay unavailable; no fixture map is substituted.',
    ],
  },
  '/play/range/$id': {
    title: 'Set your range',
    summary:
      'Choose the amount and width, then review the actual quote before signing testnet steps.',
    keys: [
      [
        'Up / Down; Left / Right',
        'Choose amount or width, then adjust it. Amount presets and MAX are also available.',
      ],
      ['SELECT or Manual', 'Show editable low and high prices.'],
      [
        'A',
        'Get an actual quote, then confirm its steps. If orders already exist, open the position instead.',
      ],
      ['START', 'Inspect sources and inputs; START or B closes them.'],
      ['B', 'Back to the tracker.'],
    ],
    notes: [
      'Deposit, margin swap and orders are separate transactions, not atomic. Review fees, minimum output and actual endpoints.',
      'A paused source blocks new quotes. Confirmed partial funds can be withdrawn; missing card or disk prerequisites are shown explicitly.',
    ],
  },
  '/play/live/$id': {
    title: 'Current position',
    summary:
      'Follow actual orders and fills. Range status compares source price with your fixed edges; valuation uses the TESTNET book.',
    keys: [
      [
        'A',
        'Jump visually in range. OUT OF RANGE, review exit costs, then explicitly exit to review a fresh range.',
      ],
      ['B', 'Cancel and withdraw; successful receipts open results.'],
      ['SELECT', 'Refresh the chain read, not the price.'],
      ['START', 'Inspect sources and inputs; START or B closes them.'],
    ],
    notes: [
      `${brand.ALERT_NAME} means price is near an edge, not a prediction. A paused price feed does not prevent withdrawal.`,
      'Incomplete history leaves SCORE, DAMAGE and NET unavailable. Time in range is sampled only while this tab is running.',
    ],
  },
  '/play/results/$id': {
    title: 'Session over',
    summary:
      'Review confirmed exit receipts and measured results, with optional sealed history saved to your card.',
    keys: [
      ['A or B', 'Back to disks.'],
      ['START', 'Inspect sources and inputs; START or B closes them.'],
      ['Receipt links', 'Open actual exit steps in the explorer.'],
      ['Retry save', 'Retry a failed optional sealed history save.'],
    ],
    notes: [
      'A failed history save does not undo a confirmed exit. Missing history remains unavailable, not zero.',
      'Without a confirmed exit, open the current position to cancel and withdraw.',
    ],
  },
  '/leaderboard': {
    title: 'Leaderboard',
    summary:
      'Compare TESTNET disk runs measured by the worker from chain fills and price samples.',
    keys: [
      ['Left / Right or tap a window', 'Choose 24h, 7d or All.'],
      ['Up / Down or tap a row', 'Select a measured disk.'],
      [
        'A',
        'Open its last fill in the explorer, or retry a failed worker read.',
      ],
      ['B', 'Back to cartridges.'],
    ],
    notes: [
      'Source, chain timestamp and computation age describe the actual read. STALE, OFFLINE and PARTIAL are not new measurements.',
      'Partial fill history shows only observed SCORE; NET and DAMAGE stay unavailable. Empty and failed reads never substitute fixture rankings.',
    ],
  },
  '/gallery': {
    title: 'Primitives gallery',
    summary:
      'A developer view of interface parts at real size, using FIXTURE data.',
    keys: [
      ['Up / Down', 'Move the list cursor.'],
      ['Left / Right', 'Change the character.'],
      ['A', 'Toggle scanlines.'],
      ['START', 'Switch the tab.'],
    ],
    notes: ['B and SELECT do nothing here.'],
  },
}

/** Opt-in fixture routes deliberately describe simulation, not live actions. */
const FIXTURE_GUIDES: Record<string, ScreenGuide> = {
  '/card': {
    ...GUIDES['/card'],
    summary:
      'FIXTURE mode loads a sample card; no passkey is created or restored.',
    keys: [
      ['Up / Down', 'Choose INSERT CARD or NEW CARD.'],
      ['A or tap a row', 'Open the sample card and continue to fixture disks.'],
      ['B', 'Back to the title.'],
    ],
    notes: [
      'Both INSERT CARD and NEW CARD open the same committed fixture card. Nothing is signed.',
    ],
  },
  '/disks': {
    title: GUIDES['/disks'].title,
    summary: 'Choose a committed FIXTURE disk and its saved difficulty.',
    keys: [
      ['Up / Down', 'Select an existing disk; empty slots are skipped.'],
      ['A or tap a disk', 'Open it and continue to cartridges.'],
      ['B', 'Back to the sample card.'],
    ],
    notes: [
      'Empty slots cannot be created in fixture mode. These are not chain accounts or sealed saves.',
    ],
  },
  '/cartridges': {
    ...GUIDES['/cartridges'],
    summary:
      'Choose an unlocked sample cartridge and continue to fixture difficulty.',
    keys: [
      ['Left / Right', 'Choose a cartridge.'],
      ['A or tap a cartridge', 'Insert it and choose a difficulty.'],
      ['START', 'Open the live worker leaderboard, not fixture rankings.'],
      ['B', 'Back to fixture disks.'],
    ],
    notes: [
      'The cartridge shelf uses sample data; locked cartridges cannot be inserted.',
    ],
  },
  '/play/difficulty': {
    ...GUIDES['/play/difficulty'],
    keys: GUIDES['/play/difficulty'].keys.map(
      ([button, action]) =>
        [
          button,
          button === 'A'
            ? 'Confirm the tier and open the tracker, or change GOD MODE on its row.'
            : action,
        ] as const,
    ),
    notes: [
      GUIDES['/play/difficulty'].notes[0],
      'Pool filters and counts use committed FIXTURE data. No preferences are signed.',
    ],
  },
  '/play/tracker': {
    ...GUIDES['/play/tracker'],
    summary:
      'A FIXTURE pool map: Safety runs left to right, Heat bottom to top.',
    notes: [
      GUIDES['/play/tracker'].notes[0],
      'All pools are sample data. Any displayed fee-income estimate is not a promise or chain fill.',
    ],
  },
  '/play/range/$id': {
    title: 'Set your fixture range',
    summary: 'Choose a simulated deposit and range. No TESTNET tokens move.',
    keys: [
      ['Up / Down', `Choose HOW MUCH, HOW WIDE or ${brand.AUTOPILOT_NAME}.`],
      ['Left / Right', 'Adjust the selected amount, width or setting.'],
      [
        'A',
        'Start the simulation, or open the MANUAL range editor when selected.',
      ],
      [
        'SELECT',
        'Open the range editor: Up / Down choose an edge, Left / Right adjust, A applies, SELECT resets, B cancels.',
      ],
      ['START', 'Inspect fixture inputs; START or B closes them.'],
      ['B', 'Back to the fixture tracker.'],
    ],
    notes: [
      'Width uses sample volatility, not a prediction. Swap costs are simulated estimates.',
    ],
  },
  '/play/live/$id': {
    title: 'Fixture position',
    summary: 'A local simulation over sample data, not a chain position.',
    keys: [
      [
        'A',
        'Jump visually in range; OUT OF RANGE, manually re-center with simulated swap cost.',
      ],
      ['SELECT', 'Nudge the sample price toward an edge for the demo.'],
      ['START', 'Inspect fixture inputs; START or B closes them.'],
      ['B', 'Finish the simulation and open results.'],
    ],
    notes: [
      'When the feed is paused, SCORE freezes and A/SELECT stop; B still finishes the simulation.',
    ],
  },
  '/play/results/$id': {
    title: 'Fixture session over',
    summary: 'Review the local simulation result, not a sealed chain save.',
    keys: [
      ['A or B', 'Back to fixture disks.'],
      ['START', 'Inspect a finished session’s inputs; START or B closes them.'],
    ],
    notes: [
      'Time in range is the share of simulated ticks inside the range. Rebalanced counts manual A presses out of range.',
    ],
  },
}

/** Unknown routes stay honest; fixture mode uses the same flag as the routes. */
export function guideForRoute(
  routeId: string | undefined,
  fixtures = USE_FIXTURES,
): Guide {
  const route = routeId?.replace(/^\/_console(?=\/)/, '') ?? ''
  const guide = fixtures && Object.hasOwn(FIXTURE_GUIDES, route)
    ? FIXTURE_GUIDES[route]
    : Object.hasOwn(GUIDES, route) ? GUIDES[route] : {
      title: 'Console',
      summary:
        'Open a screen to see its actions. Controls explains the console buttons.',
      keys: [],
      notes: [],
    }
  return {
    ...guide,
    topics:
      fixtures && route !== '/leaderboard'
        ? ['testnet', 'fixture-score', 'fixture-recenter']
        : ['testnet', 'score', 'recenter'],
  }
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
