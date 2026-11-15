import { useEffect, useState } from 'react'
import { useLogsWebSocket } from '@kite-dev/plugin-sdk/observability'

import type { Source, SourceStatus, TimeRange } from './model'

export function SourceStream({
  source,
  range,
  onLine,
  onStatus,
}: {
  source: Source
  range: TimeRange
  onLine: (source: Source, line: string) => void
  onStatus: (id: string, status: SourceStatus) => void
}) {
  const [ended, setEnded] = useState(false)
  const [follow] = useState(range !== 'previous' && !source.terminated)
  const [logSource] = useState(
    range === 'previous'
      ? {
          ...source,
          restartCount: source.restartCount - 1,
          instance: `${source.id}/${source.restartCount - 1}`,
        }
      : source
  )
  const [streamError, setStreamError] = useState<Error | null>(null)
  const { error, isConnected, isLoading } = useLogsWebSocket(
    source.namespace,
    source.pod,
    {
      container: source.container,
      timestamps: true,
      tailLines: range === 'tail' ? 100 : range === 'live' ? 0 : -1,
      sinceSeconds: ['300', '900', '3600'].includes(range)
        ? Number(range)
        : undefined,
      previous: range === 'previous',
      follow,
      enabled: !ended && !streamError,
      onNewLog: (line) => onLine(logSource, line),
      onStreamError: setStreamError,
      onStreamEnd: () => setEnded(true),
    }
  )
  const message = (streamError ?? error)?.message
  const state = message
    ? 'error'
    : ended
      ? 'ended'
      : isConnected
        ? 'streaming'
        : isLoading
          ? 'connecting'
          : 'disconnected'
  useEffect(() => {
    onStatus(source.instance, { state, error: message })
  }, [source.instance, state, message, onStatus])
  return null
}
