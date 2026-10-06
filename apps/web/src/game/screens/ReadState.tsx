import { useConsoleIntent } from '../../console/useConsoleInput'
import { Panel, PixelText } from '../../ui'
import type { NotReady } from '../../lib/worker/queries'
import type { WorkerReadError } from '../../lib/worker/client'

/**
 * The state of a worker read that has nothing to show.
 *
 * Every one of these is terminal and says what happened: loading is the only
 * transient one, and even it is bounded by the read's timeout. None of them
 * borrows a number from anywhere else.
 */
export type ReadStateView =
  | NotReady
  /** The read worked and the answer is that there is nothing. */
  | { kind: 'empty'; title: string; message: string }

export interface ReadStateProps {
  /** What was being read, in the player's words: "pool tracker". */
  subject: string
  view: ReadStateView
  onBack: () => void
}

function failureHint(error: WorkerReadError): string {
  switch (error.kind) {
    case 'network':
    case 'timeout':
      return 'Nothing is shown from memory. Try again when the connection is back.'
    case 'http':
      return 'The worker is up but refused the read.'
    case 'invalid-response':
      return 'The answer is not trusted, so none of it is shown.'
    case 'unconfigured':
      return 'This build has no worker address.'
  }
}

export function describeReadState(
  subject: string,
  view: ReadStateView,
): { title: string; message: string } {
  switch (view.kind) {
    case 'unconfigured':
      return {
        title: 'Worker not set',
        message: `No worker address is configured for this build, so the ${subject} cannot be read. Set VITE_WORKER_URL and rebuild.`,
      }
    case 'loading':
      return {
        title: `Reading ${subject}`,
        message: 'Asking the worker. This stops with an error if it does not answer.',
      }
    case 'offline':
      return {
        title: 'You are offline',
        message: `The device has no connection, so the ${subject} cannot be read. Nothing is shown from memory.`,
      }
    case 'failed':
      return {
        title: `Could not read ${subject}`,
        message: `${view.error.message} ${failureHint(view.error)}`,
      }
    case 'empty':
      return { title: view.title, message: view.message }
  }
}

export function ReadState({ subject, view, onBack }: ReadStateProps) {
  const retry = view.kind === 'failed' ? view.retry : null

  useConsoleIntent((intent) => {
    if (intent === 'B') onBack()
    else if (intent === 'A' && retry) retry()
  })

  const { title, message } = describeReadState(subject, view)

  return (
    <div
      className="screen-readstate bg-screen flex h-full w-full flex-col gap-3 p-4"
      data-read-state={view.kind}
    >
      <div className="flex flex-1 items-center justify-center">
        <Panel className="flex flex-col gap-2">
          <PixelText role="title" upper>
            {title}
          </PixelText>
          <PixelText as="p" role="body">
            {message}
          </PixelText>
        </Panel>
      </div>
      <div className="screen-footer flex items-center justify-between gap-2">
        {retry ? (
          <button type="button" onClick={retry} className="pressable">
            <PixelText role="micro" upper>
              A Retry
            </PixelText>
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={onBack} className="pressable">
          <PixelText role="micro" upper>
            B Back
          </PixelText>
        </button>
      </div>
    </div>
  )
}
