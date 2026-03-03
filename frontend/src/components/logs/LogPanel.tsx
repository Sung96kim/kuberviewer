import { useEffect, useRef, useState, useCallback, memo, forwardRef, useImperativeHandle } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useLogTerminal } from '#/hooks/use-log-terminal'
import { useExecTerminal } from '#/hooks/use-exec-terminal'
import { Button } from '#/components/ui/button'

export type LogPanelHandle = {
  clear: () => void
  toggleShell: () => void
  openSearch: () => void
}

type LogPanelProps = {
  id: string
  namespace: string
  pod: string
  container: string
  containers: string[]
  active: boolean
  focused: boolean
  onClose: (id: string) => void
  onContainerChange: (id: string, container: string) => void
  onFocus: (id: string | null) => void
  onActivate: (id: string) => void
}

function createTerminal(el: HTMLElement, interactive: boolean) {
  const terminal = new Terminal({
    cursorBlink: interactive,
    disableStdin: !interactive,
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    theme: {
      background: '#0f172a',
      foreground: '#e2e8f0',
      cursor: '#818cf8',
      selectionBackground: '#334155',
      black: '#1e293b',
      red: '#f87171',
      green: '#4ade80',
      yellow: '#facc15',
      blue: '#60a5fa',
      magenta: '#c084fc',
      cyan: '#22d3ee',
      white: '#f1f5f9',
    },
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
  fitAddon.fit()

  return { terminal, fitAddon, searchAddon }
}

export const LogPanel = memo(forwardRef<LogPanelHandle, LogPanelProps>(function LogPanel({
  id,
  namespace,
  pod,
  container,
  containers,
  active,
  focused,
  onClose,
  onContainerChange,
  onFocus,
  onActivate,
}, ref) {
  const panelRef = useRef<HTMLDivElement>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const execContainerRef = useRef<HTMLDivElement>(null)
  const logTerminalRef = useRef<Terminal | null>(null)
  const execTerminalRef = useRef<Terminal | null>(null)
  const logFitRef = useRef<FitAddon | null>(null)
  const execFitRef = useRef<FitAddon | null>(null)
  const logSearchRef = useRef<SearchAddon | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const draggingRef = useRef(false)
  const [follow, setFollow] = useState(true)
  const [shellOpen, setShellOpen] = useState(false)
  const [execStarted, setExecStarted] = useState(false)
  const [logRatio, setLogRatio] = useState(60)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const logHook = useLogTerminal(
    { namespace, pod, container, tailLines: 1000 },
  )

  const execHook = useExecTerminal({ namespace, pod, container })

  useEffect(() => {
    if (!logContainerRef.current) return

    const { terminal, fitAddon, searchAddon } = createTerminal(logContainerRef.current, false)
    logTerminalRef.current = terminal
    logFitRef.current = fitAddon
    logSearchRef.current = searchAddon

    terminal.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true
      if (e.key === 'Home') { terminal.scrollToTop(); return false }
      if (e.key === 'End') { terminal.scrollToBottom(); return false }
      return true
    })

    logHook.start(terminal)

    const observer = new ResizeObserver(() => fitAddon.fit())
    observer.observe(logContainerRef.current)

    return () => {
      observer.disconnect()
      logHook.disconnect()
      terminal.dispose()
      logTerminalRef.current = null
      logFitRef.current = null
      logSearchRef.current = null
    }
  }, [namespace, pod, container])

  useEffect(() => {
    if (!execStarted || !execContainerRef.current) return

    const { terminal, fitAddon } = createTerminal(execContainerRef.current, true)
    execTerminalRef.current = terminal
    execFitRef.current = fitAddon

    execHook.attach(terminal)
    terminal.focus()

    const observer = new ResizeObserver(() => fitAddon.fit())
    observer.observe(execContainerRef.current)

    return () => {
      observer.disconnect()
      execHook.disconnect()
      terminal.dispose()
      execTerminalRef.current = null
      execFitRef.current = null
    }
  }, [namespace, pod, container, execStarted])

  useEffect(() => {
    requestAnimationFrame(() => {
      logFitRef.current?.fit()
      if (shellOpen) {
        execFitRef.current?.fit()
        execTerminalRef.current?.focus()
      }
    })
  }, [shellOpen])

  // Drag handler for shell split
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current || !panelRef.current) return
      const rect = panelRef.current.getBoundingClientRect()
      const pct = ((e.clientY - rect.top) / rect.height) * 100
      setLogRatio(Math.min(80, Math.max(20, pct)))
    }

    const handleMouseUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    draggingRef.current = true
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const openSearch = useCallback(() => {
    setSearchOpen(true)
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }, [])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setSearchQuery('')
    logSearchRef.current?.clearDecorations()
  }, [])

  const searchNext = useCallback(() => {
    if (searchQuery) logSearchRef.current?.findNext(searchQuery)
  }, [searchQuery])

  const searchPrev = useCallback(() => {
    if (searchQuery) logSearchRef.current?.findPrevious(searchQuery)
  }, [searchQuery])

  useEffect(() => {
    if (!searchOpen) return
    if (searchQuery) {
      logSearchRef.current?.findNext(searchQuery)
    } else {
      logSearchRef.current?.clearDecorations()
    }
  }, [searchQuery, searchOpen])

  useEffect(() => {
    const el = panelRef.current
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

  useImperativeHandle(ref, () => ({
    clear: () => logTerminalRef.current?.clear(),
    toggleShell: () => {
      if (!shellOpen) {
        if (!execStarted) setExecStarted(true)
        setShellOpen(true)
        return
      }
      const textarea = execTerminalRef.current?.textarea
      if (textarea && document.activeElement !== textarea) {
        textarea.focus()
        return
      }
      textarea?.blur()
      setShellOpen(false)
    },
    openSearch,
  }), [shellOpen, execStarted, openSearch])

  const handleClear = () => {
    logTerminalRef.current?.clear()
  }

  const handleFollowToggle = () => {
    if (!follow) {
      logTerminalRef.current?.scrollToBottom()
    }
    setFollow((prev) => !prev)
  }

  const handleShellToggle = () => {
    if (!shellOpen && !execStarted) {
      setExecStarted(true)
    }
    if (shellOpen) {
      execTerminalRef.current?.textarea?.blur()
    }
    setShellOpen((prev) => !prev)
  }

  return (
    <div ref={panelRef} onMouseDown={() => onActivate(id)} className={`flex flex-col h-full rounded-lg overflow-hidden bg-[#0f172a] border ${active ? 'border-amber-400/50 ring-1 ring-amber-400/20' : 'border-slate-700'} transition-[border-color,box-shadow] duration-200`}>
      {/* Log header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border-b border-slate-700 shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className={`inline-block h-2 w-2 rounded-full shrink-0 ${logHook.connected ? 'bg-emerald-500' : 'bg-slate-500'}`}
          />
          <span className="text-xs text-slate-400 truncate">
            {namespace}/{pod}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {containers.length > 1 && (
            <select
              value={container}
              onChange={(e) => onContainerChange(id, e.target.value)}
              className="text-xs bg-slate-800 text-slate-300 border border-slate-600 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {containers.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleFollowToggle}
            className={follow ? 'text-emerald-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-800'}
            title={follow ? 'Following (click to pause)' : 'Paused (click to follow)'}
          >
            <span className="material-symbols-outlined text-[16px]">
              {follow ? 'vertical_align_bottom' : 'pause'}
            </span>
          </Button>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleShellToggle}
            className={shellOpen ? 'text-violet-400 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}
            title={shellOpen ? 'Close Terminal' : 'Open Terminal'}
          >
            <span className="material-symbols-outlined text-[16px]">terminal</span>
          </Button>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onFocus(focused ? null : id)}
            className={focused ? 'text-amber-400 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}
            title={focused ? 'Unfocus' : 'Focus'}
          >
            <span className="material-symbols-outlined text-[16px]">
              {focused ? 'close_fullscreen' : 'open_in_full'}
            </span>
          </Button>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleClear}
            className="text-slate-500 hover:text-slate-300 hover:bg-slate-800"
            title="Clear logs"
          >
            <span className="material-symbols-outlined text-[16px]">delete</span>
          </Button>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onClose(id)}
            className="text-slate-500 hover:text-red-400 hover:bg-slate-800"
            title="Close"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </Button>
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/90 border-b border-slate-700 shrink-0">
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
            className="flex-1 text-xs bg-slate-900 text-slate-200 border border-slate-600 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-slate-500"
          />
          <Button variant="ghost" size="icon-xs" onClick={searchPrev} className="text-slate-400 hover:text-slate-200 hover:bg-slate-700" title="Previous (Shift+Enter)">
            <span className="material-symbols-outlined text-[14px]">expand_less</span>
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={searchNext} className="text-slate-400 hover:text-slate-200 hover:bg-slate-700" title="Next (Enter)">
            <span className="material-symbols-outlined text-[14px]">expand_more</span>
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={closeSearch} className="text-slate-400 hover:text-slate-200 hover:bg-slate-700" title="Close (Esc)">
            <span className="material-symbols-outlined text-[14px]">close</span>
          </Button>
        </div>
      )}

      {/* Log terminal */}
      <div
        ref={logContainerRef}
        className="min-h-0"
        style={shellOpen ? { flex: `${logRatio} 0 0%` } : { flex: '1 1 0%' }}
      />

      {/* Shell handle bar — draggable when open */}
      {execStarted && (
        <div
          onMouseDown={shellOpen ? startDrag : undefined}
          onClick={shellOpen ? undefined : handleShellToggle}
          className={`flex items-center gap-2 px-3 py-1 bg-slate-900/80 border-t border-slate-700 shrink-0 transition-colors ${
            shellOpen
              ? 'cursor-row-resize hover:bg-primary/20 active:bg-primary/30'
              : 'cursor-pointer hover:bg-slate-800/80'
          }`}
        >
          <span className="material-symbols-outlined text-[14px] text-violet-400">terminal</span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex-1">Shell</span>
          {shellOpen ? (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation()
                handleShellToggle()
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="text-slate-500 hover:text-slate-300 hover:bg-slate-800"
              title="Collapse Shell"
            >
              <span className="material-symbols-outlined text-[14px]">expand_more</span>
            </Button>
          ) : (
            <span className="material-symbols-outlined text-[14px] text-slate-500">expand_less</span>
          )}
        </div>
      )}

      {/* Exec terminal — single persistent element */}
      {execStarted && (
        <div
          ref={execContainerRef}
          data-terminal="exec"
          className={shellOpen ? 'min-h-0 border-t border-slate-700' : 'h-0 overflow-hidden'}
          style={shellOpen ? { flex: `${100 - logRatio} 0 0%` } : undefined}
        />
      )}
    </div>
  )
}))
