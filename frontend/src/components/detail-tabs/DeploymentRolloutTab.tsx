import { memo, useMemo } from 'react'
import { useResourceList } from '#/hooks/use-resource-list'
import { relativeTime } from '#/lib/time'

type DeploymentRolloutTabProps = {
  namespace: string
  deploymentName: string
  resource: Record<string, unknown>
}

type KubeItem = Record<string, unknown>

type ReplicaSetInfo = {
  name: string
  revision: string
  replicas: number
  readyReplicas: number
  age: string
  isCurrent: boolean
}

export const DeploymentRolloutTab = memo(function DeploymentRolloutTab({
  namespace,
  deploymentName,
  resource,
}: DeploymentRolloutTabProps) {
  const { data, isLoading } = useResourceList({
    group: 'apps',
    version: 'v1',
    name: 'replicasets',
    namespaced: true,
    namespace,
  })

  const items: KubeItem[] = (data as { items?: KubeItem[] })?.items ?? []
  const spec = resource.spec as { replicas?: number } | undefined
  const status = resource.status as {
    replicas?: number
    readyReplicas?: number
    updatedReplicas?: number
    availableReplicas?: number
    conditions?: Array<{ type: string; status: string; reason?: string; message?: string }>
  } | undefined

  const replicaSets = useMemo(() => {
    return items
      .filter((item) => {
        const ownerRefs = ((item.metadata as Record<string, unknown>)?.ownerReferences as Array<{ name: string; kind: string }>) ?? []
        return ownerRefs.some((ref) => ref.kind === 'Deployment' && ref.name === deploymentName)
      })
      .map((item): ReplicaSetInfo => {
        const meta = item.metadata as { name?: string; creationTimestamp?: string; annotations?: Record<string, string> } | undefined
        const rsStatus = item.status as { replicas?: number; readyReplicas?: number } | undefined
        return {
          name: meta?.name ?? '',
          revision: meta?.annotations?.['deployment.kubernetes.io/revision'] ?? '-',
          replicas: rsStatus?.replicas ?? 0,
          readyReplicas: rsStatus?.readyReplicas ?? 0,
          age: meta?.creationTimestamp ? relativeTime(meta.creationTimestamp) : '-',
          isCurrent: (rsStatus?.replicas ?? 0) > 0,
        }
      })
      .sort((a, b) => Number(b.revision) - Number(a.revision))
  }, [items, deploymentName])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Desired" value={spec?.replicas ?? 0} />
        <StatCard label="Current" value={status?.replicas ?? 0} />
        <StatCard label="Ready" value={status?.readyReplicas ?? 0} />
        <StatCard label="Updated" value={status?.updatedReplicas ?? 0} />
      </div>

      {status?.conditions && status.conditions.length > 0 && (
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
          <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
            <h3 className="text-base font-bold">Rollout Status</h3>
          </div>
          <div className="divide-y divide-border-light dark:divide-border-dark">
            {status.conditions.map((c) => (
              <div key={c.type} className="px-6 py-3 flex items-center gap-3">
                <span className={`material-symbols-outlined text-[18px] ${c.status === 'True' ? 'text-emerald-500' : 'text-slate-400'}`}>
                  {c.status === 'True' ? 'check_circle' : 'cancel'}
                </span>
                <div>
                  <span className="text-sm font-medium">{c.type}</span>
                  {c.message && <span className="text-xs text-slate-500 ml-2">{c.message}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
        <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
          <h3 className="text-base font-bold">Revision History</h3>
        </div>
        {isLoading ? (
          <div className="px-6 py-8 text-center text-sm text-slate-400">Loading replica sets...</div>
        ) : replicaSets.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-400">No replica sets found</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-surface-highlight/50 text-xs uppercase font-semibold text-slate-500 tracking-wider">
              <tr>
                <th className="px-6 py-3">Revision</th>
                <th className="px-6 py-3">ReplicaSet</th>
                <th className="px-6 py-3">Replicas</th>
                <th className="px-6 py-3">Ready</th>
                <th className="px-6 py-3">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {replicaSets.map((rs) => (
                <tr key={rs.name} className={rs.isCurrent ? 'bg-primary/5' : ''}>
                  <td className="px-6 py-3 font-mono text-xs">
                    {rs.revision}
                    {rs.isCurrent && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary">
                        CURRENT
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 font-medium text-primary">{rs.name}</td>
                  <td className="px-6 py-3">{rs.replicas}</td>
                  <td className="px-6 py-3">{rs.readyReplicas}</td>
                  <td className="px-6 py-3 font-mono text-xs">{rs.age}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
})

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
    </div>
  )
}
