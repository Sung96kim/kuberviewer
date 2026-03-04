import { memo, useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useLogTerminal } from '#/hooks/use-log-terminal'
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

type LogTerminalViewProps = {
  namespace: string
  podName: string
  containers: string[]
  selectedContainer: string
  onContainerChange: (container: string) => void
  toolbarExtra?: React.ReactNode
  expanded?: boolean
  onExpandToggle?: () => void
}

function safeFit(fitAddon: FitAddon) {
  try { fitAddon.fit() } catch { /* container may not have dimensions yet */ }
}

function createTerminal(el: HTMLElement, xtermTheme: typeof XTERM_DARK) {
  const terminal = new Terminal({
    cursorBlink: false,
    disableStdin: true,
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    theme: xtermTheme,
    scrollback: 10000,
    convertEol: true,
  })

  const fitAddon = new FitAddon()
  const searchAddon = new SearchAddon()
  const webLinksAddon = new WebLinksAddon()
  terminal.loadAddon(fitAddon)
  terminal.loadAddon(searchAddon)
  terminal.loadAddon(webLinksAddon)
  terminal.open(el)
  safeFit(fitAddon)

  return { terminal, fitAddon, searchAddon }
}

export const LogTerminalView = memo(function LogTerminalView({
  namespace,
  podName,
  containers,
  selectedContainer,
  onContainerChange,
  toolbarExtra,
  expanded,
  onExpandToggle,
}: LogTerminalViewProps) {
  const { theme } = useTheme()
  const xtermTheme = theme === 'dark' ? XTERM_DARK : XTERM_LIGHT
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const searchRef = useRef<SearchAddon | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [follow, setFollow] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const logHook = useLogTerminal(
    { namespace, pod: podName, container: selectedContainer || undefined, tailLines: 1000 },
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const { terminal, fitAddon, searchAddon } = createTerminal(el, xtermTheme)
    terminalRef.current = terminal
    fitRef.current = fitAddon
    searchRef.current = searchAddon

    terminal.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true
      if (e.key === 'Home') { terminal.scrollToTop(); return false }
      if (e.key === 'End') { terminal.scrollToBottom(); return false }
      return true
    })

    logHook.start(terminal)

    const observer = new ResizeObserver(() => safeFit(fitAddon))
    observer.observe(el)

    return () => {
      observer.disconnect()
      logHook.disconnect()
      terminal.dispose()
      terminalRef.current = null
      fitRef.current = null
      searchRef.current = null
    }
  }, [namespace, podName, selectedContainer])

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.options.theme = xtermTheme
    requestAnimationFrame(() => fitRef.current?.fit())
  }, [theme])

  const handleClear = useCallback(() => {
    terminalRef.current?.clear()
  }, [])

  const handleFollowToggle = useCallback(() => {
    if (!follow) {
      terminalRef.current?.scrollToBottom()
    }
    setFollow((prev) => !prev)
  }, [follow])

  const openSearch = useCallback(() => {
    setSearchOpen(true)
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }, [])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setSearchQuery('')
    searchRef.current?.clearDecorations()
  }, [])

  const searchNext = useCallback(() => {
    if (searchQuery) searchRef.current?.findNext(searchQuery)
  }, [searchQuery])

  const searchPrev = useCallback(() => {
    if (searchQuery) searchRef.current?.findPrevious(searchQuery)
  }, [searchQuery])

  useEffect(() => {
    if (!searchOpen) return
    if (searchQuery) {
      searchRef.current?.findNext(searchQuery)
    } else {
      searchRef.current?.clearDecorations()
    }
  }, [searchQuery, searchOpen])

  useEffect(() => {
    const el = containerRef.current?.parentElement
    if (!el) return
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        e.stopPropagation()
        openSearch()
      }
    }
    el.addEventListener('keydown', handler, true)
    return () => el.removeEventListener('keydown', handler, true)
  }, [openSearch])

  return (
    <div className="flex flex-col h-full min-h-0 rounded-lg overflow-hidden bg-slate-50 dark:bg-[#0f172a] border border-border-light dark:border-slate-700">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-900/80 border-b border-border-light dark:border-slate-700 shrink-0">
        <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${logHook.connected ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-500'}`} />
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0">Logs</span>

        {containers.length > 1 && (
          <select
            value={selectedContainer}
            onChange={(e) => onContainerChange(e.target.value)}
            className="ml-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-border-light dark:border-slate-600 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {containers.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
        {containers.length === 1 && (
          <span className="text-xs text-slate-500 ml-1">{selectedContainer}</span>
        )}

        <div className="ml-auto flex items-center gap-1 shrink-0">
          {toolbarExtra}

          <button
            onClick={openSearch}
            className="p-1 rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            title="Search (Ctrl+F)"
          >
            <span className="material-symbols-outlined text-[16px]">search</span>
          </button>
          <button
            onClick={handleFollowToggle}
            className={`p-1 rounded transition-colors ${follow ? 'text-emerald-400 hover:bg-slate-200 dark:hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
            title={follow ? 'Following (click to pause)' : 'Paused (click to follow)'}
          >
            <span className="material-symbols-outlined text-[16px]">
              {follow ? 'vertical_align_bottom' : 'pause'}
            </span>
          </button>
          {onExpandToggle && (
            <button
              onClick={onExpandToggle}
              className="p-1 rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              title={expanded ? 'Collapse' : 'Expand'}
            >
              <span className="material-symbols-outlined text-[16px]">
                {expanded ? 'close_fullscreen' : 'open_in_full'}
              </span>
            </button>
          )}
          <button
            onClick={handleClear}
            className="p-1 rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            title="Clear logs"
          >
            <span className="material-symbols-outlined text-[16px]">delete</span>
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800/90 border-b border-border-light dark:border-slate-700 shrink-0">
          <span className="material-symbols-outlined text-[14px] text-slate-400">search</span>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (e.shiftKey) searchPrev()
                else searchNext()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                closeSearch()
              }
            }}
            placeholder="Search logs..."
            className="flex-1 text-xs bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-border-light dark:border-slate-600 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          <button onClick={searchPrev} className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" title="Previous (Shift+Enter)">
            <span className="material-symbols-outlined text-[14px]">expand_less</span>
          </button>
          <button onClick={searchNext} className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" title="Next (Enter)">
            <span className="material-symbols-outlined text-[14px]">expand_more</span>
          </button>
          <button onClick={closeSearch} className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" title="Close (Esc)">
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
      )}

      {logHook.error && (
        <div className="px-3 py-1.5 text-xs text-red-400 bg-red-500/10 border-b border-border-light dark:border-slate-700 shrink-0">{logHook.error}</div>
      )}

      <div className="flex-1 min-h-[100px] relative">
        <div ref={containerRef} className="absolute inset-0" />
      </div>
    </div>
  )
})
