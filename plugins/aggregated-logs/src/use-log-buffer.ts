import { useCallback, useEffect, useRef, useState } from 'react'

import { MAX_BYTES, MAX_LINES, type LogEntry, type Source } from './model'

export function useLogBuffer() {
  const buffer = useRef<{
    entries: LogEntry[]
    bytes: number
    total: number
    trimmed: number
  }>({ entries: [], bytes: 0, total: 0, trimmed: 0 })
  const pending = useRef<LogEntry[]>([])
  const pendingBytes = useRef(0)
  const sequence = useRef(0)
  const dirty = useRef(false)
  const encoder = useRef(new TextEncoder())
  const [snapshot, setSnapshot] = useState(buffer.current)
  const append = useCallback((source: Source, line: string) => {
    const separator = line.indexOf(' ')
    const timestamp = line.slice(0, separator)
    const parsedTime = separator > 0 ? Date.parse(timestamp) : NaN
    const hasTimestamp = Number.isFinite(parsedTime)
    const message = hasTimestamp ? line.slice(separator + 1) : line
    const bytes = encoder.current.encode(line).byteLength
    sequence.current++
    dirty.current = true
    if (bytes > MAX_BYTES) {
      buffer.current.trimmed++
      buffer.current.total++
      return
    }
    pending.current.push({
      id: sequence.current,
      source,
      timestamp: hasTimestamp ? parsedTime : undefined,
      time: hasTimestamp ? parsedTime : Date.now(),
      message,
      bytes,
    })
    pendingBytes.current += bytes
    // Bound the incoming batch as well as the retained history.
    while (
      pendingBytes.current > MAX_BYTES ||
      pending.current.length > MAX_LINES
    ) {
      const removed = pending.current.splice(
        0,
        Math.ceil(pending.current.length / 2)
      )
      pendingBytes.current -= removed.reduce(
        (sum, entry) => sum + entry.bytes,
        0
      )
      buffer.current.trimmed += removed.length
      buffer.current.total += removed.length
    }
  }, [])
  useEffect(() => {
    const timer = setInterval(() => {
      if (!dirty.current) return
      dirty.current = false
      const current = buffer.current
      let entries = [...current.entries, ...pending.current]
      let bytes = current.bytes + pendingBytes.current
      const total = current.total + pending.current.length
      pending.current = []
      pendingBytes.current = 0
      let removed = 0
      while (entries.length - removed > MAX_LINES || bytes > MAX_BYTES) {
        bytes -= entries[removed++].bytes
      }
      entries = entries.slice(removed)
      buffer.current = {
        entries,
        bytes,
        total,
        trimmed: current.trimmed + removed,
      }
      setSnapshot(buffer.current)
    }, 100)
    return () => clearInterval(timer)
  }, [])
  const clear = useCallback(() => {
    dirty.current = false
    pending.current = []
    pendingBytes.current = 0
    buffer.current = { entries: [], bytes: 0, total: 0, trimmed: 0 }
    setSnapshot(buffer.current)
  }, [])
  return { ...snapshot, append, clear }
}
