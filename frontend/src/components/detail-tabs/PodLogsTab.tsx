import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { useLogStream } from '#/hooks/use-log-stream'

type PodLogsTabProps = {
  namespace: string
  podName: string
  containers: string[]
}

type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'UNKNOWN'

function detectLogLevel(line: string): LogLevel {
  const upper = line.toUpperCase()
  if (upper.includes('ERROR') || upper.includes('FATAL') || upper.includes('PANIC')) return 'ERROR'
  if (upper.includes('WARN')) return 'WARN'
  if (upper.includes('DEBUG') || upper.includes('TRACE')) return 'DEBUG'
  if (upper.includes('INFO')) return 'INFO'
  return 'UNKNOWN'
}

const LOG_LEVEL_CLASSES: Record<LogLevel, string> = {
  ERROR: 'text-red-400',
  WARN: 'text-yellow-400',
  INFO: 'text-slate-700 dark:text-slate-300',
  DEBUG: 'text-slate-500',
  UNKNOWN: 'text-slate-500 dark:text-slate-400',
}

function LogLine({ line, lineNumber, showTimestamps }: { line: string; lineNumber: number; showTimestamps: boolean }) {
  const level = detectLogLevel(line)
  const colorClass = LOG_LEVEL_CLASSES[level]

  let timestamp = ''
  let content = line
  if (showTimestamps && line.length > 30 && line[4] === '-') {
    const spaceIdx = line.indexOf(' ')
    if (spaceIdx > 20 && spaceIdx < 35) {
      timestamp = line.slice(0, spaceIdx)
      content = line.slice(spaceIdx + 1)
    }
  }

  return (
    <div className="flex hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
      <span className="shrink-0 w-14 text-right pr-3 text-slate-400 dark:text-slate-600 select-none text-xs leading-5 group-hover:text-slate-500">
        {lineNumber}
      </span>
      {showTimestamps && timestamp && (
        <span className="shrink-0 w-56 pr-3 text-slate-400 dark:text-slate-600 text-xs leading-5 font-mono truncate">
          {timestamp}
        </span>
      )}
      <span className={`flex-1 whitespace-pre-wrap break-all text-xs leading-5 ${colorClass}`}>
        {content}
      </span>
    </div>
  )
}

export const PodLogsTab = memo(function PodLogsTab({ namespace, podName, containers }: PodLogsTabProps) {
  const [selectedContainer, setSelectedContainer] = useState(containers[0] ?? '')
  const [follow, setFollow] = useState(true)
  const [showTimestamps, setShowTimestamps] = useState(false)
  const [tailLines] = useState(1000)
  const [wrapLines, setWrapLines] = useState(true)
  const [filterText, setFilterText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const { lines, connected, error, clear } = useLogStream(
    {
      namespace,
      pod: podName,
      container: selectedContainer || undefined,
      tailLines,
      timestamps: showTimestamps,
      follow,
    },
    !!selectedContainer,
  )

  const filteredLines = filterText
    ? lines.filter((l) => l.toLowerCase().includes(filterText.toLowerCase()))
    : lines

  useEffect(() => {
    if (follow && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [filteredLines.length, follow])

  const handleWheel = useCallback(() => {
    if (!scrollRef.current || !follow) return
    setTimeout(() => {
      if (!scrollRef.current) return
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
      if (!isAtBottom) setFollow(false)
    }, 0)
  }, [follow])

  const handleDownload = useCallback(() => {
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${podName}-${selectedContainer}-logs.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [lines, podName, selectedContainer])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {containers.length > 1 && (
          <select
            value={selectedContainer}
            onChange={(e) => setSelectedContainer(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-sm text-slate-900 dark:text-white"
          >
            {containers.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
        {containers.length === 1 && (
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Container: <span className="font-medium text-slate-900 dark:text-white">{selectedContainer}</span>
          </span>
        )}

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[16px]">
            search
          </span>
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter logs..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-background-dark border border-border-light dark:border-border-dark rounded-md text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <ToggleButton
            active={follow}
            onClick={() => setFollow(!follow)}
            icon="vertical_align_bottom"
            label="Follow"
          />
          <ToggleButton
            active={showTimestamps}
            onClick={() => setShowTimestamps(!showTimestamps)}
            icon="schedule"
            label="Timestamps"
          />
          <ToggleButton
            active={wrapLines}
            onClick={() => setWrapLines(!wrapLines)}
            icon="wrap_text"
            label="Wrap"
          />
          <button
            onClick={clear}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:bg-slate-50 dark:hover:bg-slate-800 text-sm transition-colors"
            title="Clear logs"
          >
            <span className="material-symbols-outlined text-[16px]">delete</span>
          </button>
          <button
            onClick={handleDownload}
            disabled={lines.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:bg-slate-50 dark:hover:bg-slate-800 text-sm transition-colors disabled:opacity-50"
            title="Download logs"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-500'}`} />
        {connected ? 'Streaming' : 'Disconnected'}
        {lines.length > 0 && (
          <span className="ml-2">{filteredLines.length.toLocaleString()} lines</span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div
        ref={scrollRef}
        onWheel={handleWheel}
        className={`bg-white dark:bg-slate-950 rounded-lg border border-border-light dark:border-border-dark overflow-auto font-mono h-[600px] p-2 ${wrapLines ? '' : 'whitespace-nowrap'}`}
      >
        {filteredLines.length === 0 && !error && (
          <div className="flex items-center justify-center h-full text-slate-600 text-sm">
            {connected ? 'Waiting for log output...' : 'No logs available'}
          </div>
        )}
        {filteredLines.map((line, i) => (
          <LogLine
            key={i}
            line={line}
            lineNumber={i + 1}
            showTimestamps={showTimestamps}
          />
        ))}
      </div>
    </div>
  )
})

function ToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: string
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm transition-colors ${
        active
          ? 'border-primary/50 bg-primary/10 text-primary'
          : 'border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
      }`}
      title={label}
    >
      <span className="material-symbols-outlined text-[16px]">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
