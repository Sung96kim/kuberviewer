import { memo, useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogTitle } from '#/components/ui/dialog'
import { useResource } from '#/hooks/use-resource'
import { useLogStream } from '#/hooks/use-log-stream'
import { TerminalSessionView } from '#/components/terminal/TerminalSession'
import { relativeTime } from '#/lib/time'

type PodInspectModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  namespace: string
  podName: string
}

function getContainerNames(resource: Record<string, unknown>): string[] {
  const spec = resource.spec as { containers?: Array<{ name: string }>; initContainers?: Array<{ name: string }> } | undefined
  const names: string[] = []
  if (spec?.initContainers) {
    for (const c of spec.initContainers) names.push(c.name)
  }
  if (spec?.containers) {
    for (const c of spec.containers) names.push(c.name)
  }
  return names
}

export const PodInspectModal = memo(function PodInspectModal({
  open,
  onOpenChange,
  namespace,
  podName,
}: PodInspectModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[90vw] w-[90vw] h-[85vh] p-0 gap-0 bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark overflow-hidden"
      >
        <DialogTitle className="sr-only">Pod Inspector: {podName}</DialogTitle>
        {open && (
          <PodInspectContent
            namespace={namespace}
            podName={podName}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
})

type PodInspectContentProps = {
  namespace: string
  podName: string
  onClose: () => void
}

const PodInspectContent = memo(function PodInspectContent({
  namespace,
  podName,
  onClose,
}: PodInspectContentProps) {
  const { data: podData, isLoading } = useResource({
    group: '',
    version: 'v1',
    name: 'pods',
    namespaced: true,
    namespace,
    resourceName: podName,
  })

  const pod = podData as Record<string, unknown> | undefined
  const containers = useMemo(() => pod ? getContainerNames(pod) : [], [pod])
  const [selectedContainer, setSelectedContainer] = useState('')

  useEffect(() => {
    if (containers.length > 0 && !selectedContainer) {
      setSelectedContainer(containers.find((c) => !c.startsWith('init-')) ?? containers[0])
    }
  }, [containers, selectedContainer])

  const metadata = pod?.metadata as {
    name?: string
    namespace?: string
    creationTimestamp?: string
    uid?: string
    labels?: Record<string, string>
  } | undefined

  const status = pod?.status as {
    phase?: string
    podIP?: string
    hostIP?: string
    startTime?: string
    containerStatuses?: Array<{
      name: string
      image: string
      ready: boolean
      restartCount: number
      state?: Record<string, { reason?: string; startedAt?: string }>
    }>
  } | undefined

  const spec = pod?.spec as {
    nodeName?: string
    serviceAccountName?: string
  } | undefined

  const [showTerminal, setShowTerminal] = useState(false)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [leftWidth, setLeftWidth] = useState(25)
  const [logRatio, setLogRatio] = useState(60)
  const panelRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<'horizontal' | 'vertical' | 'both' | null>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return

      if (draggingRef.current === 'horizontal' && panelRef.current) {
        const rect = panelRef.current.getBoundingClientRect()
        const pct = ((e.clientX - rect.left) / rect.width) * 100
        if (pct < 8) {
          setLeftCollapsed(true)
        } else {
          setLeftCollapsed(false)
          setLeftWidth(Math.min(40, Math.max(15, pct)))
        }
      } else if (draggingRef.current === 'vertical' && rightPanelRef.current) {
        const rect = rightPanelRef.current.getBoundingClientRect()
        const pct = ((e.clientY - rect.top) / rect.height) * 100
        setLogRatio(Math.min(80, Math.max(30, pct)))
      } else if (draggingRef.current === 'both' && panelRef.current && rightPanelRef.current) {
        const hRect = panelRef.current.getBoundingClientRect()
        const hPct = ((e.clientX - hRect.left) / hRect.width) * 100
        if (hPct < 8) {
          setLeftCollapsed(true)
        } else {
          setLeftCollapsed(false)
          setLeftWidth(Math.min(40, Math.max(15, hPct)))
        }
        const vRect = rightPanelRef.current.getBoundingClientRect()
        const vPct = ((e.clientY - vRect.top) / vRect.height) * 100
        setLogRatio(Math.min(80, Math.max(30, vPct)))
      }
    }

    const handleMouseUp = () => {
      if (draggingRef.current) {
        draggingRef.current = null
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

  const startHorizontalDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    draggingRef.current = 'horizontal'
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const startVerticalDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    draggingRef.current = 'vertical'
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const startBothDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    draggingRef.current = 'both'
    document.body.style.cursor = 'move'
    document.body.style.userSelect = 'none'
  }, [])

  const phase = status?.phase ?? 'Unknown'
  const containerStatuses = status?.containerStatuses ?? []

  return (
    <div className="flex flex-col h-[85vh]">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border-light dark:border-border-dark shrink-0">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-blue-400">deployed_code</span>
          <h3 className="text-sm font-bold">{podName}</h3>
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
            phase === 'Running' ? 'bg-emerald-500/10 text-emerald-400' :
            phase === 'Succeeded' ? 'bg-emerald-500/10 text-emerald-400' :
            phase === 'Failed' ? 'bg-red-500/10 text-red-400' :
            'bg-yellow-500/10 text-yellow-400'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {phase}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      {isLoading ? (
        <div className="px-5 py-16 text-center text-sm text-slate-500">Loading pod details...</div>
      ) : (
        <div ref={panelRef} className="flex flex-1 min-h-0">
          {leftCollapsed ? (
            <button
              onClick={() => setLeftCollapsed(false)}
              className="w-7 shrink-0 flex flex-col items-center justify-center border-r border-border-light dark:border-border-dark hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              title="Expand panel"
            >
              <span className="material-symbols-outlined text-[14px] text-slate-400">chevron_right</span>
            </button>
          ) : (
            <>
              <div className="overflow-y-auto p-4 space-y-4 min-w-0" style={{ flex: leftWidth }}>
                <div className="flex items-center justify-end -mb-2">
                  <button
                    onClick={() => setLeftCollapsed(true)}
                    className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Collapse panel"
                  >
                    <span className="material-symbols-outlined text-[14px] text-slate-400">chevron_left</span>
                  </button>
                </div>

                <DetailSection title="Info">
                  <DetailRow label="Namespace" value={metadata?.namespace ?? '-'} />
                  <DetailRow label="Node" value={spec?.nodeName ?? '-'} />
                  <DetailRow label="Pod IP" value={status?.podIP ?? '-'} />
                  <DetailRow label="Host IP" value={status?.hostIP ?? '-'} />
                  <DetailRow label="Service Account" value={spec?.serviceAccountName ?? '-'} />
                  <DetailRow label="Age" value={metadata?.creationTimestamp ? relativeTime(metadata.creationTimestamp) : '-'} />
                </DetailSection>

                <DetailSection title="Containers">
                  {containerStatuses.map((cs) => {
                    const stateKey = Object.keys(cs.state ?? {})[0] ?? 'unknown'
                    return (
                      <div key={cs.name} className="py-2 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${cs.ready ? 'bg-emerald-500' : 'bg-yellow-500'}`} />
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{cs.name}</span>
                        </div>
                        <div className="ml-4 mt-1 space-y-0.5">
                          <p className="text-[10px] text-slate-600 dark:text-slate-500">State: <span className="text-slate-500 dark:text-slate-400">{stateKey}</span></p>
                          <p className="text-[10px] text-slate-600 dark:text-slate-500">Restarts: <span className="text-slate-500 dark:text-slate-400">{cs.restartCount}</span></p>
                          <p className="text-[10px] text-slate-600 dark:text-slate-500 truncate" title={cs.image}>Image: <span className="text-slate-500 dark:text-slate-400">{cs.image.split('/').pop()}</span></p>
                        </div>
                      </div>
                    )
                  })}
                  {containerStatuses.length === 0 && (
                    <p className="text-xs text-slate-500">No container status</p>
                  )}
                </DetailSection>

                {metadata?.labels && Object.keys(metadata.labels).length > 0 && (
                  <DetailSection title="Labels">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(metadata.labels).map(([k, v]) => (
                        <span key={k} className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 border border-border-light dark:border-border-dark text-slate-500 dark:text-slate-400 truncate max-w-full" title={`${k}=${v}`}>
                          {k.split('/').pop()}={v}
                        </span>
                      ))}
                    </div>
                  </DetailSection>
                )}
              </div>

              {showTerminal ? (
                <div className="w-1 shrink-0 flex flex-col border-x border-border-light dark:border-border-dark">
                  <div
                    className="cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
                    style={{ flex: logRatio }}
                    onMouseDown={startHorizontalDrag}
                    onDoubleClick={() => setLeftCollapsed(true)}
                  />
                  <div className="relative shrink-0 h-1">
                    <div
                      className="absolute -left-1.5 -top-1.5 w-4 h-4 cursor-move z-10 rounded-sm hover:bg-primary/40 active:bg-primary/60 transition-colors"
                      onMouseDown={startBothDrag}
                    />
                  </div>
                  <div
                    className="cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
                    style={{ flex: 100 - logRatio }}
                    onMouseDown={startHorizontalDrag}
                    onDoubleClick={() => setLeftCollapsed(true)}
                  />
                </div>
              ) : (
                <div
                  className="w-1 shrink-0 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors border-x border-border-light dark:border-border-dark"
                  onMouseDown={startHorizontalDrag}
                  onDoubleClick={() => setLeftCollapsed(true)}
                />
              )}
            </>
          )}

          <div ref={rightPanelRef} className="flex flex-col min-h-0 min-w-0" style={{ flex: leftCollapsed ? 1 : 100 - leftWidth }}>
            <div className="flex flex-col min-h-0" style={{ flex: showTerminal ? logRatio : 1 }}>
              <LogViewer
                namespace={namespace}
                podName={podName}
                containers={containers}
                selectedContainer={selectedContainer}
                onContainerChange={setSelectedContainer}
                showTerminal={showTerminal}
                onToggleTerminal={() => setShowTerminal((v) => !v)}
              />
            </div>
            {showTerminal && selectedContainer && (
              <>
                <div
                  className="h-1 shrink-0 cursor-row-resize hover:bg-primary/30 active:bg-primary/50 transition-colors border-y border-border-light dark:border-border-dark"
                  onMouseDown={startVerticalDrag}
                />
                <div className="flex flex-col min-h-0" style={{ flex: 100 - logRatio }}>
                  <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border-light dark:border-border-dark shrink-0">
                    <span className="material-symbols-outlined text-[14px] text-emerald-400">terminal</span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Terminal</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">{selectedContainer}</span>
                    <button
                      onClick={() => setShowTerminal(false)}
                      className="ml-auto p-1 rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                  <div className="flex-1 min-h-0">
                    <TerminalSessionView
                      namespace={namespace}
                      pod={podName}
                      container={selectedContainer}
                      isVisible={showTerminal}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
})

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-semibold mb-2">{title}</h4>
      {children}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline py-1">
      <span className="text-[11px] text-slate-600 dark:text-slate-500">{label}</span>
      <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 text-right ml-2 truncate max-w-[60%]" title={value}>{value}</span>
    </div>
  )
}

const LogViewer = memo(function LogViewer({
  namespace,
  podName,
  containers,
  selectedContainer,
  onContainerChange,
  showTerminal,
  onToggleTerminal,
}: {
  namespace: string
  podName: string
  containers: string[]
  selectedContainer: string
  onContainerChange: (container: string) => void
  showTerminal: boolean
  onToggleTerminal: () => void
}) {
  const [follow, setFollow] = useState(true)
  const [wrapLines, setWrapLines] = useState(true)
  const [filterText, setFilterText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const { lines, connected, error, clear } = useLogStream(
    {
      namespace,
      pod: podName,
      container: selectedContainer || undefined,
      tailLines: 500,
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

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border-light dark:border-border-dark shrink-0 overflow-hidden">
        <span className="material-symbols-outlined text-[16px] text-slate-500 dark:text-slate-400 shrink-0">terminal</span>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0">Logs</span>

        {containers.length > 1 && (
          <select
            value={selectedContainer}
            onChange={(e) => onContainerChange(e.target.value)}
            className="ml-2 px-2 py-1 rounded border border-border-light dark:border-border-dark bg-surface-light dark:bg-background-dark text-xs text-slate-700 dark:text-slate-300 shrink-0"
          >
            {containers.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
        {containers.length === 1 && (
          <span className="text-xs text-slate-500 ml-2 shrink-0">{selectedContainer}</span>
        )}

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <div className="relative w-[160px]">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-[13px] text-slate-400" style={{ fontVariationSettings: "'opsz' 20, 'wght' 300" }}>search</span>
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter..."
              className="w-full pl-7 pr-3 py-1 bg-slate-50 dark:bg-background-dark border border-border-light dark:border-border-dark rounded text-xs text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-500'}`} />
            <button
              onClick={() => setFollow(!follow)}
              className={`p-1 rounded transition-colors ${follow ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              title={follow ? 'Following' : 'Follow'}
            >
              <span className="material-symbols-outlined text-[14px]">vertical_align_bottom</span>
            </button>
            <button
              onClick={() => setWrapLines(!wrapLines)}
              className={`p-1 rounded transition-colors ${wrapLines ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              title={wrapLines ? 'Wrap on' : 'Wrap off'}
            >
              <span className="material-symbols-outlined text-[14px]">wrap_text</span>
            </button>
            <button
              onClick={clear}
              className="p-1 rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              title="Clear"
            >
              <span className="material-symbols-outlined text-[14px]">delete</span>
            </button>
            <button
              onClick={onToggleTerminal}
              className={`p-1 rounded transition-colors ${showTerminal ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              title={showTerminal ? 'Hide terminal' : 'Open terminal'}
            >
              <span className="material-symbols-outlined text-[14px]">terminal</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-red-400 bg-red-500/10 border-b border-border-light dark:border-border-dark shrink-0">{error}</div>
      )}

      <div
        ref={scrollRef}
        onWheel={handleWheel}
        className="flex-1 overflow-auto bg-white dark:bg-slate-950 font-mono text-xs p-2 min-h-0"
      >
        {filteredLines.length === 0 && !error && (
          <div className="flex items-center justify-center h-full text-slate-600 text-xs">
            {connected ? 'Waiting for log output...' : lines.length === 0 ? 'No logs available' : 'No lines match filter'}
          </div>
        )}
        {filteredLines.map((line, i) => (
          <LogLine key={i} line={line} lineNumber={i + 1} wrapLines={wrapLines} />
        ))}
      </div>
    </div>
  )
})

function LogLine({ line, lineNumber, wrapLines }: { line: string; lineNumber: number; wrapLines: boolean }) {
  const upper = line.toUpperCase()
  const isError = upper.includes('ERROR') || upper.includes('FATAL') || upper.includes('PANIC')
  const isWarn = upper.includes('WARN')
  const colorClass = isError ? 'text-red-400' : isWarn ? 'text-yellow-400' : 'text-slate-700 dark:text-slate-300'

  return (
    <div className="flex hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
      <span className="shrink-0 w-10 text-right pr-2 text-slate-400 dark:text-slate-600 select-none leading-5 group-hover:text-slate-500">
        {lineNumber}
      </span>
      <span className={`flex-1 leading-5 ${wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'} ${colorClass}`}>
        {line}
      </span>
    </div>
  )
}
