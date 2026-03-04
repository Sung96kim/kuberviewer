import { memo, useMemo, useState, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { useResourceList } from '#/hooks/use-resource-list'
import { useResource } from '#/hooks/use-resource'
import { LogTerminalView } from '#/components/logs/LogTerminalView'
import { getStatusClasses } from '#/lib/resource-helpers'
import { TruncatedCell } from '#/components/ui/truncated-cell'
import { relativeTime } from '#/lib/time'

type CronJobPodsTabProps = {
  namespace: string
  cronJobName: string
}

type KubeItem = Record<string, unknown>

function getPodPhase(item: KubeItem): string {
  const status = item.status as { phase?: string; containerStatuses?: Array<{ state?: Record<string, { reason?: string }> }> } | undefined
  if (!status) return 'Unknown'
  for (const cs of status.containerStatuses ?? []) {
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

export const CronJobPodsTab = memo(function CronJobPodsTab({
  namespace,
  cronJobName,
}: CronJobPodsTabProps) {
  const [selectedPod, setSelectedPod] = useState<string | null>(null)

  const { data: jobsData, isLoading: jobsLoading } = useResourceList({
    group: 'batch',
    version: 'v1',
    name: 'jobs',
    namespaced: true,
    namespace,
  })

  const jobNames = useMemo(() => {
    const items: KubeItem[] = (jobsData as { items?: KubeItem[] })?.items ?? []
    return new Set(
      items
        .filter((item) => {
          const ownerRefs = ((item.metadata as Record<string, unknown>)?.ownerReferences as Array<{ name: string; kind: string }>) ?? []
          return ownerRefs.some((ref) => ref.kind === 'CronJob' && ref.name === cronJobName)
        })
        .map((item) => ((item.metadata as Record<string, unknown>)?.name as string) ?? '')
        .filter(Boolean)
    )
  }, [jobsData, cronJobName])

  const { data: podsData, isLoading: podsLoading } = useResourceList({
    group: '',
    version: 'v1',
    name: 'pods',
    namespaced: true,
    namespace,
  })

  const pods = useMemo(() => {
    const items: KubeItem[] = (podsData as { items?: KubeItem[] })?.items ?? []
    return items
      .filter((item) => {
        const labels = (item.metadata as Record<string, unknown>)?.labels as Record<string, string> | undefined
        return labels?.['job-name'] && jobNames.has(labels['job-name'])
      })
      .sort((a, b) => {
        const aTime = ((a.metadata as Record<string, unknown>)?.creationTimestamp as string) ?? ''
        const bTime = ((b.metadata as Record<string, unknown>)?.creationTimestamp as string) ?? ''
        return bTime.localeCompare(aTime)
      })
  }, [podsData, jobNames])

  const isLoading = jobsLoading || podsLoading

  if (isLoading) {
    return <div className="text-sm text-slate-400 py-8 text-center">Loading pods...</div>
  }

  if (pods.length === 0) {
    return (
      <div className="text-sm text-slate-400 py-8 text-center">
        <span className="material-symbols-outlined text-[32px] block mb-2">deployed_code</span>
        No pods found for this CronJob
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border-light dark:border-border-dark">
              <th className="px-5 py-3 text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-semibold">Name</th>
              <th className="px-5 py-3 text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-semibold">Job</th>
              <th className="px-5 py-3 text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-semibold">Status</th>
              <th className="px-5 py-3 text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-semibold">Restarts</th>
              <th className="px-5 py-3 text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-semibold">Age</th>
              <th className="px-5 py-3 text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-semibold">Node</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light dark:divide-border-dark">
            {pods.map((item) => {
              const meta = item.metadata as { name?: string; creationTimestamp?: string; labels?: Record<string, string> } | undefined
              const spec = item.spec as { nodeName?: string } | undefined
              const phase = getPodPhase(item)
              const restarts = getPodRestarts(item)
              const classes = getStatusClasses(phase)
              const jobName = meta?.labels?.['job-name'] ?? '-'
              const isSelected = meta?.name === selectedPod

              return (
                <tr
                  key={meta?.name}
                  onClick={() => setSelectedPod(isSelected ? null : (meta?.name ?? null))}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-500/10 hover:bg-blue-500/15'
                      : 'hover:bg-slate-50 dark:hover:bg-surface-hover/30'
                  }`}
                >
                  <td className="px-5 py-3 max-w-[250px]">
                    <TruncatedCell>
                      <Link
                        to="/resources/$"
                        params={{ _splat: `v1/pods/${namespace}/${meta?.name}` }}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                      >
                        {meta?.name}
                      </Link>
                    </TruncatedCell>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-400 max-w-[200px]">
                    <TruncatedCell>{jobName}</TruncatedCell>
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
                  <td className="px-5 py-3 max-w-[250px]">
                    <TruncatedCell>{spec?.nodeName ?? '-'}</TruncatedCell>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selectedPod && (
        <PodLogPanel
          namespace={namespace}
          podName={selectedPod}
          onClose={() => setSelectedPod(null)}
        />
      )}
    </div>
  )
})

type PodLogPanelProps = {
  namespace: string
  podName: string
  onClose: () => void
}

const PodLogPanel = memo(function PodLogPanel({
  namespace,
  podName,
  onClose,
}: PodLogPanelProps) {
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

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border-light dark:border-border-dark">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-blue-400">deployed_code</span>
          <h3 className="text-sm font-bold">{podName}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-hover text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      {isLoading ? (
        <div className="px-5 py-12 text-center text-sm text-slate-500">Loading...</div>
      ) : (
        <div style={{ height: expanded ? 'calc(100vh - 300px)' : '400px' }}>
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
      )}
    </div>
  )
})
