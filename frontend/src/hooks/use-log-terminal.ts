import { useRef, useCallback, useState } from 'react'
import type { Terminal } from 'xterm'

type LogTerminalParams = {
  namespace: string
  pod: string
  container?: string
  tailLines?: number
  timestamps?: boolean
}

const MAX_RECONNECTS = 5
const RECONNECT_DELAY = 3000

export function useLogTerminal(params: LogTerminalParams) {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const reconnectCountRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    const terminal = termRef.current
    if (!terminal) return

    cleanup()

    const qs = new URLSearchParams({
      namespace: params.namespace,
      pod: params.pod,
      follow: 'true',
      timestamps: String(params.timestamps ?? false),
    })
    if (params.container) qs.set('container', params.container)
    if (params.tailLines !== undefined) qs.set('tailLines', String(params.tailLines))

    const es = new EventSource(`/api/logs?${qs}`)
    esRef.current = es

    es.onopen = () => {
      reconnectCountRef.current = 0
      setConnected(true)
      setError(null)
      terminal.write('\x1b[2m[Connected]\x1b[0m\r\n')
    }

    es.onmessage = (event) => {
      terminal.write(event.data + '\r\n')
    }

    es.onerror = () => {
      es.close()
      esRef.current = null
      setConnected(false)

      if (reconnectCountRef.current < MAX_RECONNECTS) {
        reconnectCountRef.current++
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY)
      } else {
        setError('Failed to connect to log stream')
        terminal.write('\x1b[31m[Connection lost]\x1b[0m\r\n')
      }
    }
  }, [params.namespace, params.pod, params.container, params.tailLines, params.timestamps, cleanup])

  const start = useCallback((terminal: Terminal) => {
    termRef.current = terminal
    reconnectCountRef.current = 0
    setError(null)
    connect()
  }, [connect])

  const disconnect = useCallback(() => {
    cleanup()
    termRef.current = null
    setConnected(false)
  }, [cleanup])

  return { start, disconnect, connected, error }
}
