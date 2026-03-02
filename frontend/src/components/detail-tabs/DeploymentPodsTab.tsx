import { memo, useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { useResourceList } from '#/hooks/use-resource-list'
import { useResource } from '#/hooks/use-resource'
import { useLogStream } from '#/hooks/use-log-stream'
import { getStatusClasses } from '#/lib/resource-helpers'
import { relativeTime } from '#/lib/time'

type DeploymentPodsTabProps = {
  namespace: string
  deploymentName: string
  selector: Record<string, string>
}

type KubeItem = Record<string, unknown>

function getPodPhase(item: KubeItem): string {
  const status = item.status as { phase?: string; containerStatuses?: Array<{ state?: Record<string, { reason?: string }> }> } | undefined
  if (!status) return 'Unknown'
  const containerStatuses = status.containerStatuses ?? []
  for (const cs of containerStatuses) {
    if (cs.state?.waiting?.reason) return cs.state.waiting.reason
    if (cs.state?.terminated?.reason) return cs.state.terminated.reason
  }
  return status.phase ?? 'Unknown'
}

function getPodRestarts(item: KubeItem): number {
  const status = item.status as { containerStatuses?: Array<{ restartCount?: number }> } | undefined
  return (status?.containerStatuses ?? []).reduce((sum, cs) => sum + (cs.restartCount ?? 0), 0)
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

export const DeploymentPodsTab = memo(function DeploymentPodsTab({
  namespace,
  selector,
}: DeploymentPodsTabProps) {
  const [selectedPod, setSelectedPod] = useState<string | null>(null)

  const labelSelector = useMemo(
    () => Object.entries(selector).map(([k, v]) => `${k}=${v}`).join(','),
    [selector],
  )

  const { data, isLoading } = useResourceList({
    group: '',
    version: 'v1',
    name: 'pods',
    namespaced: true,
    namespace,
    labelSelector,
  })

  const items: KubeItem[] = (data as { items?: KubeItem[] })?.items ?? []

  if (isLoading) {
    return <div className="text-sm text-slate-400 py-8 text-center">Loading pods...</div>
  }

  if (items.length === 0) {
    return <div className="text-sm text-slate-400 py-8 text-center">No pods found</div>
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border-light dark:border-border-dark">
              <th className="px-5 py-3 text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-semibold">Name</th>
              <th className="px-5 py-3 text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-semibold">Status</th>
              <th className="px-5 py-3 text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-semibold">Restarts</th>
              <th className="px-5 py-3 text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-semibold">Age</th>
              <th className="px-5 py-3 text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-semibold">Node</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light dark:divide-border-dark">
            {items.map((item) => {
              const meta = item.metadata as { name?: string; creationTimestamp?: string } | undefined
              const spec = item.spec as { nodeName?: string } | undefined
              const phase = getPodPhase(item)
              const restarts = getPodRestarts(item)
              const classes = getStatusClasses(phase)
              const isSelected = meta?.name === selectedPod

              return (
                <tr
                  key={meta?.name}
                  onClick={() => setSelectedPod(isSelected ? null : (meta?.name ?? null))}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-500/10 hover:bg-blue-500/15'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <td className="px-5 py-3">
                    <span className="font-medium text-blue-400">{meta?.name}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${classes.dot}`} />
                      <span>{phase}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">{restarts}</td>
                  <td className="px-5 py-3 font-mono text-xs">
                    {meta?.creationTimestamp ? relativeTime(meta.creationTimestamp) : '-'}
                  </td>
                  <td className="px-5 py-3">{spec?.nodeName ?? '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selectedPod && (
        <PodDetailPanel
          namespace={namespace}
          podName={selectedPod}
          onClose={() => setSelectedPod(null)}
        />
      )}
    </div>
  )
})

type PodDetailPanelProps = {
  namespace: string
  podName: string
  onClose: () => void
}

const PodDetailPanel = memo(function PodDetailPanel({
  namespace,
  podName,
  onClose,
}: PodDetailPanelProps) {
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

  const phase = status?.phase ?? 'Unknown'
  const containerStatuses = status?.containerStatuses ?? []

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border-light dark:border-border-dark">
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
        <div className="px-5 py-12 text-center text-sm text-slate-500">Loading pod details...</div>
      ) : (
        <div className="flex divide-x divide-border-light dark:divide-border-dark" style={{ height: '500px' }}>
          <div className="w-1/4 overflow-y-auto p-4 space-y-4">
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

          <div className="w-3/4 flex flex-col">
            <PodLogViewer
              namespace={namespace}
              podName={podName}
              containers={containers}
              selectedContainer={selectedContainer}
              onContainerChange={setSelectedContainer}
            />
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

type PodLogViewerProps = {
  namespace: string
  podName: string
  containers: string[]
  selectedContainer: string
  onContainerChange: (container: string) => void
}

const PodLogViewer = memo(function PodLogViewer({
  namespace,
  podName,
  containers,
  selectedContainer,
  onContainerChange,
}: PodLogViewerProps) {
  const [follow, setFollow] = useState(true)
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
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border-light dark:border-border-dark">
        <span className="material-symbols-outlined text-[16px] text-slate-500 dark:text-slate-400">terminal</span>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Logs</span>

        {containers.length > 1 && (
          <select
            value={selectedContainer}
            onChange={(e) => onContainerChange(e.target.value)}
            className="ml-2 px-2 py-1 rounded border border-border-light dark:border-border-dark bg-surface-light dark:bg-background-dark text-xs text-slate-700 dark:text-slate-300"
          >
            {containers.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
        {containers.length === 1 && (
          <span className="text-xs text-slate-500 ml-2">{selectedContainer}</span>
        )}

        <div className="relative flex-1 max-w-[200px] ml-auto">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-[14px] text-slate-500">search</span>
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
            onClick={clear}
            className="p-1 rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            title="Clear"
          >
            <span className="material-symbols-outlined text-[14px]">delete</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-red-400 bg-red-500/10 border-b border-border-light dark:border-border-dark">{error}</div>
      )}

      <div
        ref={scrollRef}
        onWheel={handleWheel}
        className="flex-1 overflow-auto bg-white dark:bg-slate-950 font-mono text-xs p-2"
      >
        {filteredLines.length === 0 && !error && (
          <div className="flex items-center justify-center h-full text-slate-600 text-xs">
            {connected ? 'Waiting for log output...' : 'No logs available'}
          </div>
        )}
        {filteredLines.map((line, i) => (
          <LogLine key={i} line={line} lineNumber={i + 1} />
        ))}
      </div>
    </div>
  )
})

function LogLine({ line, lineNumber }: { line: string; lineNumber: number }) {
  const upper = line.toUpperCase()
  const isError = upper.includes('ERROR') || upper.includes('FATAL') || upper.includes('PANIC')
  const isWarn = upper.includes('WARN')
  const colorClass = isError ? 'text-red-400' : isWarn ? 'text-yellow-400' : 'text-slate-700 dark:text-slate-300'

  return (
    <div className="flex hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
      <span className="shrink-0 w-10 text-right pr-2 text-slate-400 dark:text-slate-600 select-none leading-5 group-hover:text-slate-500">
        {lineNumber}
      </span>
      <span className={`flex-1 whitespace-pre-wrap break-all leading-5 ${colorClass}`}>
        {line}
      </span>
    </div>
  )
}
