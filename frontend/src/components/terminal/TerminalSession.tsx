import { useEffect, useRef, memo } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import { useExecTerminal } from '#/hooks/use-exec-terminal'
import { useTheme } from '#/hooks/use-theme'

const XTERM_DARK = {
  background: '#0f172a', foreground: '#e2e8f0', cursor: '#818cf8',
  selectionBackground: '#334155', black: '#1e293b', red: '#f87171',
  green: '#4ade80', yellow: '#facc15', blue: '#60a5fa',
  magenta: '#c084fc', cyan: '#22d3ee', white: '#f1f5f9',
}

const XTERM_LIGHT = {
  background: '#f8fafc', foreground: '#334155', cursor: '#6366f1',
  selectionBackground: '#bfdbfe', black: '#f1f5f9', red: '#dc2626',
  green: '#16a34a', yellow: '#ca8a04', blue: '#2563eb',
  magenta: '#9333ea', cyan: '#0891b2', white: '#1e293b',
}

type TerminalSessionProps = {
  namespace: string
  pod: string
  container?: string
  isVisible: boolean
}

export const TerminalSessionView = memo(function TerminalSessionView({
  namespace,
  pod,
  container,
  isVisible,
}: TerminalSessionProps) {
  const { theme } = useTheme()
  const xtermTheme = theme === 'dark' ? XTERM_DARK : XTERM_LIGHT
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const visibleRef = useRef(isVisible)
  const { attach, disconnect } = useExecTerminal({ namespace, pod, container })

  visibleRef.current = isVisible

  useEffect(() => {
    if (!containerRef.current) return

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      theme: xtermTheme,
      scrollback: 10000,
      convertEol: true,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    const searchAddon = new SearchAddon()

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)
    terminal.loadAddon(searchAddon)

    terminal.open(containerRef.current)
    fitAddon.fit()
    terminal.focus()
    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    terminal.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true
      if (e.ctrlKey && e.key === 'c' && terminal.hasSelection()) {
        navigator.clipboard.writeText(terminal.getSelection())
        terminal.clearSelection()
        return false
      }
      if (e.ctrlKey && e.key === 'v') {
        navigator.clipboard.readText().then((text) => {
          if (text) terminal.paste(text)
        })
        return false
      }
      return true
    })

    attach(terminal)

    const resizeObserver = new ResizeObserver(() => {
      if (visibleRef.current) {
        fitAddon.fit()
      }
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      disconnect()
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [namespace, pod, container])

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.options.theme = xtermTheme
    requestAnimationFrame(() => fitAddonRef.current?.fit())
  }, [theme])

  useEffect(() => {
    if (isVisible && fitAddonRef.current) {
      fitAddonRef.current.fit()
      terminalRef.current?.focus()
    }
  }, [isVisible])

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
    />
  )
})
