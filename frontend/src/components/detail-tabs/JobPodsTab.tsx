import { memo, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useResourceList } from '#/hooks/use-resource-list'
import { getStatusClasses } from '#/lib/resource-helpers'
import { TruncatedCell } from '#/components/ui/truncated-cell'
import { relativeTime } from '#/lib/time'
import { PodLogPanel } from '#/components/detail-tabs/PodLogPanel'

type JobPodsTabProps = {
  namespace: string
  jobName: string
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

export const JobPodsTab = memo(function JobPodsTab({
  namespace,
  jobName,
}: JobPodsTabProps) {
  const [selectedPod, setSelectedPod] = useState<string | null>(null)

  const { data: podsData, isLoading } = useResourceList({
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
        return labels?.['job-name'] === jobName
      })
      .sort((a, b) => {
        const aTime = ((a.metadata as Record<string, unknown>)?.creationTimestamp as string) ?? ''
        const bTime = ((b.metadata as Record<string, unknown>)?.creationTimestamp as string) ?? ''
        return bTime.localeCompare(aTime)
      })
  }, [podsData, jobName])

  if (isLoading) {
    return <div className="text-sm text-slate-400 py-8 text-center">Loading pods...</div>
  }

  if (pods.length === 0) {
    return (
      <div className="text-sm text-slate-400 py-8 text-center">
        <span className="material-symbols-outlined text-[32px] block mb-2">deployed_code</span>
        No pods found for this Job
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
              <th className="px-5 py-3 text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-semibold">Status</th>
              <th className="px-5 py-3 text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-semibold">Restarts</th>
              <th className="px-5 py-3 text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-semibold">Age</th>
              <th className="px-5 py-3 text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider font-semibold">Node</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light dark:divide-border-dark">
            {pods.map((item) => {
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

