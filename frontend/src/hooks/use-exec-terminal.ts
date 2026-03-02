import { useRef, useCallback, useEffect } from 'react'
import type { Terminal } from 'xterm'

type ExecTerminalParams = {
  namespace: string
  pod: string
  container?: string
}

export function useExecTerminal(params: ExecTerminalParams) {
  const wsRef = useRef<WebSocket | null>(null)
  const termRef = useRef<Terminal | null>(null)

  const attach = useCallback((terminal: Terminal) => {
    termRef.current = terminal

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const qs = new URLSearchParams({
      namespace: params.namespace,
      pod: params.pod,
    })
    if (params.container) qs.set('container', params.container)

    const ws = new WebSocket(`${protocol}//${window.location.host}/api/exec?${qs}`)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      terminal.clear()
      const { cols, rows } = terminal
      ws.send(JSON.stringify({ type: 'resize', cols, rows }))
    }

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        terminal.write(new Uint8Array(event.data))
      } else {
        terminal.write(event.data)
      }
    }

    ws.onclose = () => {
      terminal.write('\r\n\x1b[33m[Session ended]\x1b[0m\r\n')
    }

    ws.onerror = () => {
      terminal.write('\r\n\x1b[31m[Connection error]\x1b[0m\r\n')
    }

    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }))
      }
    })

    terminal.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }))
      }
    })
  }, [params.namespace, params.pod, params.container])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return { attach, disconnect }
}
