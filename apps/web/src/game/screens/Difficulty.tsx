import { useEffect, useState } from 'react'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { characters } from '../../config/brand'
import { fixtureGates, passingCount, scoredPools } from '../fixtures'
import { ageInDays, compactUsd } from '../../lib/format'
import { GodModeGate } from '../GodModeGate'
import { Meter, PixelText, Row, Sprite, Toggle } from '../../ui'
import type { CharacterId } from '../../config/brand'
import type { Difficulty as DifficultyTier, GateSet } from '../../types/domain'

export interface DifficultyProps {
  difficulty: DifficultyTier
  godMode: boolean
  onChange: (difficulty: DifficultyTier) => void
  onConfirm: (difficulty: DifficultyTier, godMode: boolean) => void
  onBack: () => void
}

const CHARACTER_BY_DIFFICULTY: Record<DifficultyTier, CharacterId> = {
  easy: 'molandak',
  normal: 'moyaki',
  hard: 'mouch',
}

const TIER_ORDER: ReadonlyArray<DifficultyTier> = ['easy', 'normal', 'hard']

const DESCRIPTIONS: Record<DifficultyTier, { tagline: string; body: string }> =
  {
    easy: {
      tagline: 'MOLANDAK curls up when things get scary.',
      body: 'deep pools only. been around a while. paired with money you know.',
    },
    normal: {
      tagline: 'MOYAKI rides the current and stays balanced.',
      body: 'solid pools, not brand new, paired with money people trust.',
    },
    hard: {
      tagline: 'MOUCH is a prankster who loves the chaos.',
      body: 'looser rules. newer pools allowed. still avoids junk pairs.',
    },
  }

const TOTAL_POOLS = scoredPools('easy').length

function gateRows(gates: GateSet): Array<{ label: string; value: string }> {
  return [
    { label: 'Pools deeper than', value: compactUsd(gates.minTvlUsd) },
    { label: 'Older than', value: ageInDays(gates.minAgeSeconds) },
    { label: 'Paired with', value: gates.allowedQuoteSymbols.join(', ') },
    { label: 'Safety at least', value: `${gates.minSafety}` },
    { label: 'Calmer than', value: `${gates.maxHeat} heat` },
  ]
}

type Focus = 'tier' | 'godmode'

export function Difficulty({
  difficulty,
  godMode,
  onChange,
  onConfirm,
  onBack,
}: DifficultyProps) {
  const [focus, setFocus] = useState<Focus>('tier')

  const [godModeOn, setGodModeOn] = useState(godMode)
  const [overlayOpen, setOverlayOpen] = useState(false)

  useEffect(() => {
    if (difficulty !== 'hard') {
      setFocus('tier')
      setGodModeOn(false)
    }
  }, [difficulty])

  const gates = fixtureGates(difficulty)
  const description = DESCRIPTIONS[difficulty]

  function activateGodMode() {
    setFocus('godmode')
    if (difficulty !== 'hard') return
    if (godModeOn) {

      setGodModeOn(false)
    } else {
      setOverlayOpen(true)
    }
  }

  useConsoleIntent((intent) => {

    if (overlayOpen) return

    if (intent === 'B') {
      onBack()
      return
    }
    if (intent === 'A') {
      if (focus === 'godmode') {
        activateGodMode()
        return
      }
      onConfirm(difficulty, godModeOn)
      return
    }
    if (intent === 'LEFT' || intent === 'RIGHT') {
      if (focus !== 'tier') return

      const index = TIER_ORDER.indexOf(difficulty)
      const nextIndex = intent === 'RIGHT' ? index + 1 : index - 1
      if (nextIndex >= 0 && nextIndex < TIER_ORDER.length) {
        onChange(TIER_ORDER[nextIndex])
      }
      return
    }
    if (intent === 'UP' || intent === 'DOWN') {

      if (difficulty !== 'hard') return
      setFocus((current) => (current === 'tier' ? 'godmode' : 'tier'))
    }
  })

  return (
    
    <div className="bg-screen relative flex h-full w-full flex-col gap-1 p-2">
      <div className="flex items-baseline justify-between">
        <PixelText role="title" upper>
          Choose your Monanimal
        </PixelText>
        <PixelText role="micro" tone="dim" upper>
          FIXTURE
        </PixelText>
      </div>

      <div className="flex items-end justify-between gap-1">
        {TIER_ORDER.map((tier) => {
          const characterId = CHARACTER_BY_DIFFICULTY[tier]
          const character = characters[characterId]
          const selected = tier === difficulty
          return (
            <div key={tier} className="flex flex-1 flex-col items-center gap-1">
              <Sprite
                character={characterId}
                animation="idle"
                size={selected ? 64 : 32}
              />

              <div
                className={`flex items-baseline gap-1 px-2 py-1 ${
                  selected ? 'bg-accent' : ''
                }`}
              >
                <PixelText role="body" tone={selected ? 'invert' : 'ink'} upper>
                  {character.label}
                </PixelText>
                <PixelText
                  role="micro"
                  tone={selected ? 'invert' : 'dim'}
                  upper
                >
                  {character.tier}
                </PixelText>
              </div>
            </div>
          )
        })}
      </div>

      <div className="border-edge bg-panel flex flex-col border p-1">
        <PixelText role="body">{description.tagline}</PixelText>
        <PixelText role="micro" tone="dim">
          {description.body}
        </PixelText>
      </div>

      <div className="border-edge bg-sunk flex flex-col border p-1">
        {gateRows(gates).map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-2"
          >
            <PixelText role="micro" tone="dim" upper>
              {row.label}
            </PixelText>
            <PixelText role="micro" className="tabular-nums" upper>
              {row.value}
            </PixelText>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        {TIER_ORDER.map((tier) => {
          const passing = passingCount(tier, false)
          const selected = tier === difficulty
          return (
            <div key={tier} className="flex flex-1 items-center gap-1">
              <PixelText role="micro" tone={selected ? 'ink' : 'dim'} upper>
                {characters[CHARACTER_BY_DIFFICULTY[tier]].tier}
              </PixelText>
              <Meter value={passing} max={TOTAL_POOLS} segments={5} />
              
              <PixelText role="micro" tone="dim" className="tabular-nums">
                {passing} of {TOTAL_POOLS}
              </PixelText>
            </div>
          )
        })}
      </div>

      <Row
        selected={focus === 'godmode'}
        disabled={difficulty !== 'hard'}
        onSelect={activateGodMode}
      >
        <Toggle on={godModeOn} label="God mode" />
        <PixelText role="micro" tone="dim" upper>
          hard only
        </PixelText>
      </Row>

      <div className="mt-auto flex items-center justify-between">
        
        <PixelText role="micro" upper>
          {'◄►'} Select
        </PixelText>
        <PixelText role="micro" upper>
          A Confirm
        </PixelText>
        <PixelText role="micro" upper>
          B Back
        </PixelText>
      </div>

      {overlayOpen ? (
        <div className="absolute inset-0">
          <GodModeGate
            onConfirm={() => {
              setGodModeOn(true)
              setOverlayOpen(false)
            }}
            onCancel={() => setOverlayOpen(false)}
          />
        </div>
      ) : null}
    </div>
  )
}
