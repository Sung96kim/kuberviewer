import { useEffect, useRef, useState, useCallback } from 'react'

type LogStreamParams = {
  namespace: string
  pod: string
  container?: string
  tailLines?: number
  sinceSeconds?: number
  timestamps?: boolean
  follow?: boolean
  previous?: boolean
}

type LogStreamState = {
  lines: string[]
  connected: boolean
  error: string | null
}

const MAX_LINES = 10_000
const RECONNECT_DELAY = 3000
const MAX_RECONNECTS = 5

export function useLogStream(params: LogStreamParams, enabled: boolean) {
  const [state, setState] = useState<LogStreamState>({
    lines: [],
    connected: false,
    error: null,
  })
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectCountRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hadDataRef = useRef(false)
  const lastIdentityRef = useRef('')

  const clear = useCallback(() => {
    setState((prev) => ({ lines: [], connected: prev.connected, error: null }))
  }, [])

  const follow = params.follow ?? true
  const identity = `${params.namespace}\0${params.pod}\0${params.container ?? ''}`

  useEffect(() => {
    if (!lastIdentityRef.current) {
      lastIdentityRef.current = identity
      return
    }
    if (lastIdentityRef.current !== identity) {
      lastIdentityRef.current = identity
      setState({ lines: [], connected: false, error: null })
      hadDataRef.current = false
    }
  }, [identity])

  useEffect(() => {
    function cleanup() {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }

    if (!enabled || !params.namespace || !params.pod || !follow) {
      cleanup()
      setState((prev) => ({ ...prev, connected: false }))
      return cleanup
    }

    cleanup()
    reconnectCountRef.current = 0

    function connect() {
      const qs = new URLSearchParams({
        namespace: params.namespace,
        pod: params.pod,
        follow: 'true',
        timestamps: String(params.timestamps ?? false),
        previous: String(params.previous ?? false),
      })
      if (params.container) qs.set('container', params.container)
      if (params.tailLines !== undefined) qs.set('tailLines', String(params.tailLines))
      if (params.sinceSeconds !== undefined) qs.set('sinceSeconds', String(params.sinceSeconds))

      const es = new EventSource(`/api/logs?${qs}`)
      eventSourceRef.current = es

      es.onopen = () => {
        reconnectCountRef.current = 0
        setState((prev) => ({ ...prev, connected: true, error: null }))
      }

      es.onmessage = (event) => {
        hadDataRef.current = true
        setState((prev) => {
          const newLines = [...prev.lines, event.data]
          if (newLines.length > MAX_LINES) {
            newLines.splice(0, newLines.length - MAX_LINES)
          }
          return { ...prev, lines: newLines }
        })
      }

      es.onerror = () => {
        es.close()
        eventSourceRef.current = null
        setState((prev) => ({ ...prev, connected: false }))

        if (reconnectCountRef.current < MAX_RECONNECTS) {
          reconnectCountRef.current++
          reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY)
        } else if (!hadDataRef.current) {
          setState((prev) => ({ ...prev, error: 'Failed to connect to log stream' }))
        }
      }
    }

    connect()

    return cleanup
  }, [
    enabled,
    params.namespace,
    params.pod,
    params.container,
    params.tailLines,
    params.sinceSeconds,
    params.timestamps,
    follow,
    params.previous,
  ])

  return { ...state, clear }
}
