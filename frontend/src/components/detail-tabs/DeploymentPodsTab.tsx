import { memo, useMemo, useState, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { useResourceList } from '#/hooks/use-resource-list'
import { useResource } from '#/hooks/use-resource'
import { LogTerminalView } from '#/components/logs/LogTerminalView'
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
                    <Link
                      to="/resources/$"
                      params={{ _splat: `v1/pods/${namespace}/${meta?.name}` }}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                    >
                      {meta?.name}
                    </Link>
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
  const [expanded, setExpanded] = useState(false)

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
        <div className="flex divide-x divide-border-light dark:divide-border-dark" style={{ height: expanded ? 'calc(100vh - 300px)' : '500px' }}>
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
            <LogTerminalView
              namespace={namespace}
              podName={podName}
              containers={containers}
              selectedContainer={selectedContainer}
              onContainerChange={setSelectedContainer}
              expanded={expanded}
              onExpandToggle={() => setExpanded((v) => !v)}
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

