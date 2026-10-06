import { useRef, useState } from 'react'
import { useConsoleIntent } from '../../console/useConsoleInput'
import { duration } from '../../lib/format'
import { ageNowMs } from '../../lib/worker/queries'
import { LEADERBOARD_WINDOWS } from '../../lib/worker/schemas'
import {
  LEADERBOARD_STALE_MS,
  cleanTag,
  explorerTxUrl,
  quoteAmount,
  rowScore,
  shortAddress,
} from '../data/leaderboard'
import { utcStamp } from '../data/provenance'
import { Panel, PixelText } from '../../ui'
import { describeReadState } from './ReadState'
import type { ReactNode } from 'react'
import type { TextTone } from '../../ui'
import type { ReadView } from '../../lib/worker/queries'
import type {
  LeaderboardReadout,
  LeaderboardRow,
  LeaderboardWindow,
} from '../../lib/worker/schemas'
import './leaderboard.css'

/**
 * S9, the leaderboard.
 *
 * A component, not a route: it takes the worker read as a `ReadView`, the
 * window being asked for, and callbacks. Every number on it was derived by the
 * worker from chain fills and mid samples; nothing here accepts, computes or
 * substitutes a score, and a read that did not happen is a message, not a row.
 *
 * SCORE, DAMAGE and NET share one type role and one size, in every layout.
 */
export interface LeaderboardProps {
  window: LeaderboardWindow
  onWindowChange: (window: LeaderboardWindow) => void
  view: ReadView<LeaderboardReadout>
  /** The client clock, so ages keep moving between reads. */
  now: number
  onBack: () => void
}

const WINDOW_LABEL: Record<LeaderboardWindow, string> = {
  '24h': '24h',
  '7d': '7d',
  all: 'All',
}

export function Leaderboard({ window, onWindowChange, view, now, onBack }: LeaderboardProps) {
  const [selected, setSelected] = useState(0)
  const rowRefs = useRef<Array<HTMLLIElement | null>>([])

  const ready = view.kind === 'ready' ? view : null
  const data = ready?.data ?? null
  const rows = data?.rows ?? []
  const current = Math.min(selected, Math.max(0, rows.length - 1))
  const ageMs = ready && data ? ageNowMs(data.ageMs, ready.receivedAt, now) : null
  const stale = ageMs !== null && ageMs > LEADERBOARD_STALE_MS

  function openLastFill(row: LeaderboardRow | undefined) {
    if (row?.lastFillTx) {
      globalThis.open(explorerTxUrl(row.lastFillTx), '_blank', 'noopener,noreferrer')
    }
  }

  function moveTo(index: number) {
    setSelected(index)
    rowRefs.current[index]?.scrollIntoView?.({ block: 'nearest' })
  }

  useConsoleIntent((intent) => {
    if (intent === 'B') {
      onBack()
      return
    }
    if (intent === 'LEFT' || intent === 'RIGHT') {
      const at = LEADERBOARD_WINDOWS.indexOf(window)
      const nextIndex = at + (intent === 'RIGHT' ? 1 : -1)
      // No wrap, the rule every selector in this product follows.
      if (nextIndex >= 0 && nextIndex < LEADERBOARD_WINDOWS.length) {
        setSelected(0)
        onWindowChange(LEADERBOARD_WINDOWS[nextIndex])
      }
      return
    }
    if (view.kind === 'failed') {
      if (intent === 'A') view.retry()
      return
    }
    if (!ready || rows.length === 0) return
    if (intent === 'UP') moveTo(Math.max(0, current - 1))
    else if (intent === 'DOWN') moveTo(Math.min(rows.length - 1, current + 1))
    else if (intent === 'A') openLastFill(rows[current])
  })

  return (
    <div className="screen-leaderboard bg-screen flex h-full w-full flex-col gap-1 p-2">
      <div className="lb-header flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-1">
          <PixelText role="title" upper>
            Leaderboard
          </PixelText>
          <PixelText role="micro" tone="dim" upper>
            Testnet
          </PixelText>
        </div>
        <div role="tablist" aria-label="Leaderboard window" className="lb-tabs flex gap-1">
          {LEADERBOARD_WINDOWS.map((option) => {
            const on = option === window
            return (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setSelected(0)
                  onWindowChange(option)
                }}
                className={`pressable border-edge border px-2 ${on ? 'bg-accent' : 'bg-panel'}`}
              >
                <PixelText role="micro" tone={on ? 'invert' : 'ink'} upper>
                  {WINDOW_LABEL[option]}
                </PixelText>
              </button>
            )
          })}
        </div>
      </div>

      <Provenance
        window={window}
        view={view}
        data={data}
        ageMs={ageMs}
        stale={stale}
      />

      {data && data.rows.length > 0 ? (
        <Rows
          rows={rows}
          current={current}
          partial={data.status !== 'complete'}
          rowRefs={rowRefs}
          onSelect={setSelected}
        />
      ) : (
        <StateBody view={view} data={data} />
      )}

      <div className="screen-footer mt-auto flex items-center justify-between gap-2">
        <PixelText role="micro" upper>
          {'◄►'} Window
        </PixelText>
        <button
          type="button"
          disabled={!rows[current]?.lastFillTx}
          onClick={() => openLastFill(rows[current])}
          className="pressable disabled:opacity-40"
        >
          <PixelText role="micro" upper>
            A Last fill
          </PixelText>
        </button>
        <button type="button" onClick={onBack} className="pressable">
          <PixelText role="micro" upper>
            B Back
          </PixelText>
        </button>
      </div>
    </div>
  )
}

/** Where every figure below came from and how old it is. Always drawn. */
function Provenance({
  window,
  view,
  data,
  ageMs,
  stale,
}: {
  window: LeaderboardWindow
  view: ReadView<LeaderboardReadout>
  data: LeaderboardReadout | null
  ageMs: number | null
  stale: boolean
}) {
  if (view.kind !== 'ready' || data === null) {
    return (
      <PixelText role="micro" tone="dim" upper>
        Source worker /v1/leaderboard · {WINDOW_LABEL[window]} window · no read yet
      </PixelText>
    )
  }
  const flags = [
    stale ? 'STALE' : null,
    data.status === 'partial' ? 'PARTIAL' : null,
    view.offline ? 'OFFLINE' : null,
  ].filter(Boolean)
  return (
    <div className="flex flex-col">
      <PixelText role="micro" tone="dim" upper>
        {[
          `Source ${data.source}`,
          `${WINDOW_LABEL[window]} window`,
          data.at === null ? 'no chain read' : `chain read ${utcStamp(data.at)}`,
          ageMs === null ? 'age unknown' : `computed ${duration(ageMs / 1000)} ago`,
          ...flags,
        ].join(' · ')}
      </PixelText>
      {view.refreshError ? (
        <PixelText role="micro" tone="loss">
          Refresh failed: {view.refreshError.message} Showing the last good read.
        </PixelText>
      ) : null}
      {data.status === 'partial' ? (
        <PixelText role="micro" tone="dim">
          Fill history is partial. SCORE is what was read so far, not a final total,
          and NET and DAMAGE are not read.
        </PixelText>
      ) : null}
    </div>
  )
}

/** Everything the screen says when there are no rows: each one a real state. */
function StateBody({
  view,
  data,
}: {
  view: ReadView<LeaderboardReadout>
  data: LeaderboardReadout | null
}) {
  let copy: { title: string; message: string }
  if (view.kind !== 'ready' || data === null) {
    copy = describeReadState('leaderboard', view as Exclude<typeof view, { kind: 'ready' }>)
  } else if (data.status === 'unavailable') {
    copy = {
      title: 'No leaderboard yet',
      message:
        'The worker has not computed one for this window. Nothing is shown in its place.',
    }
  } else if (data.status === 'no-market-configured') {
    copy = {
      title: 'No market configured',
      message:
        'The worker has no deployed TESTNET market to read fills from, so there is nothing to rank.',
    }
  } else {
    copy = {
      title: 'No disks found',
      message:
        'The worker read the TESTNET market and found no save disks to rank in this window.',
    }
  }
  return (
    <div className="flex flex-1 items-center justify-center">
      <Panel className="flex flex-col gap-2">
        <PixelText role="title" upper>
          {copy.title}
        </PixelText>
        <PixelText as="p" role="body">
          {copy.message}
        </PixelText>
        {view.kind === 'failed' ? (
          <PixelText role="micro" tone="dim" upper>
            A retry
          </PixelText>
        ) : null}
      </Panel>
    </div>
  )
}

function Rows({
  rows,
  current,
  partial,
  rowRefs,
  onSelect,
}: {
  rows: Array<LeaderboardRow>
  current: number
  partial: boolean
  rowRefs: { current: Array<HTMLLIElement | null> }
  onSelect: (index: number) => void
}) {
  return (
    <div className="lb-scroll">
      <ol className="lb-list" aria-label="Leaderboard rows">
        <li className="lb-row lb-head" aria-hidden="true">
          <HeadLabel area="rank">#</HeadLabel>
          <HeadLabel area="who">Disk</HeadLabel>
          <HeadLabel area="score">{partial ? 'Score so far' : 'Score'}</HeadLabel>
          <HeadLabel area="damage">Damage</HeadLabel>
          <HeadLabel area="net">Net</HeadLabel>
          <HeadLabel area="fills">Fills</HeadLabel>
          <HeadLabel area="range">In range</HeadLabel>
          <HeadLabel area="tx">Last fill</HeadLabel>
        </li>
        {rows.map((row, index) => (
          <Row
            key={row.disk}
            row={row}
            rank={index + 1}
            selected={index === current}
            refCallback={(el) => {
              rowRefs.current[index] = el
            }}
            onSelect={() => onSelect(index)}
          />
        ))}
      </ol>
      <PixelText as="p" role="micro" tone="dim">
        TESTNET quote units, read from chain fills and never reported by players.
        IN RANGE counts sampled prices only; a gap in samples is unknown time,
        not time in range.
      </PixelText>
    </div>
  )
}

function HeadLabel({ area, children }: { area: string; children: ReactNode }) {
  return (
    <span className={`lb-${area}`}>
      <PixelText role="micro" tone="dim" upper>
        {children}
      </PixelText>
    </span>
  )
}

function Row({
  row,
  rank,
  selected,
  refCallback,
  onSelect,
}: {
  row: LeaderboardRow
  rank: number
  selected: boolean
  refCallback: (el: HTMLLIElement | null) => void
  onSelect: () => void
}) {
  const tag = cleanTag(row.tag)
  const score = rowScore(row)

  return (
    <li
      ref={refCallback}
      aria-current={selected ? 'true' : undefined}
      onClick={onSelect}
      className={`lb-row ${selected ? 'lb-selected' : ''}`}
    >
      <span className="lb-rank">
        <PixelText role="body" tone="dim" className="tabular-nums">
          {rank}
        </PixelText>
      </span>
      <span className="lb-who" title={row.disk}>
        <PixelText role="body" upper>
          {tag ?? shortAddress(row.disk)}
        </PixelText>
        {tag ? (
          <PixelText role="micro" tone="dim">
            {shortAddress(row.disk)}
          </PixelText>
        ) : null}
      </span>
      <Figure
        area="score"
        label="Score"
        text={quoteAmount(score.value, 'plus-minus')}
        tone={score.value > 0 ? 'gain' : 'ink'}
        hint={score.final ? null : 'so far'}
      />
      <Figure
        area="damage"
        label="Damage"
        text={row.damage === null ? 'n/a' : quoteAmount(row.damage, 'minus')}
        tone={row.damage !== null && row.damage > 0 ? 'loss' : 'ink'}
        hint={row.damage === null ? 'not read' : null}
      />
      <Figure
        area="net"
        label="Net"
        text={row.net === null ? 'n/a' : quoteAmount(row.net, 'plus-minus')}
        tone={row.net === null || row.net === 0 ? 'ink' : row.net > 0 ? 'gain' : 'loss'}
        hint={row.net === null ? 'not read' : null}
      />
      <span className="lb-fills lb-cell">
        <span className="lb-label">
          <PixelText role="micro" tone="dim" upper>
            Fills
          </PixelText>
        </span>
        <PixelText role="body" className="tabular-nums">
          {row.fills}
        </PixelText>
      </span>
      <span className="lb-range lb-cell" title="Sampled prices only">
        <span className="lb-label">
          <PixelText role="micro" tone="dim" upper>
            In range (sampled)
          </PixelText>
        </span>
        <PixelText role="body" className="tabular-nums">
          {duration(row.secondsInRange)}
        </PixelText>
      </span>
      <span className="lb-tx">
        {row.lastFillTx ? (
          <a
            href={explorerTxUrl(row.lastFillTx)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Last fill of ${tag ?? shortAddress(row.disk)} on the explorer`}
          >
            <PixelText role="micro" tone="dim" upper>
              Explorer
            </PixelText>
          </a>
        ) : (
          <PixelText role="micro" tone="dim" upper>
            No fills
          </PixelText>
        )}
      </span>
    </li>
  )
}

function Figure({
  area,
  label,
  text,
  tone,
  hint,
}: {
  area: string
  label: string
  text: string
  tone: TextTone
  hint: string | null
}) {
  return (
    <span className={`lb-${area} lb-cell`}>
      <span className="lb-label">
        <PixelText role="micro" tone="dim" upper>
          {label}
        </PixelText>
      </span>
      <PixelText role="value" tone={tone} className="lb-figure tabular-nums">
        {text}
      </PixelText>
      {hint ? (
        <PixelText role="micro" tone="dim">
          {hint}
        </PixelText>
      ) : null}
    </span>
  )
}
