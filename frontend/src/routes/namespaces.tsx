import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useResourceList } from '#/hooks/use-resource-list'
import { relativeTime } from '#/lib/time'
import { Skeleton } from '#/components/ui/skeleton'
import { QueryError } from '#/components/QueryError'

export const Route = createFileRoute('/namespaces')({ component: NamespacesPage })

type KubeNamespace = {
  metadata: {
    name: string
    creationTimestamp: string
    labels?: Record<string, string>
  }
  status: {
    phase: string
  }
}

type KubeListResponse = {
  items?: KubeNamespace[]
}

function getStatusBadge(phase: string) {
  if (phase === 'Active') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        Active
      </span>
    )
  }
  if (phase === 'Terminating') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
        Terminating
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
      {phase}
    </span>
  )
}

function getNamespaceIcon(name: string): { bg: string; icon: string; color: string } {
  if (name.startsWith('kube-')) return { bg: 'bg-purple-500/20', icon: 'settings_system_daydream', color: 'text-purple-400' }
  if (name === 'default') return { bg: 'bg-primary/20', icon: 'folder_open', color: 'text-primary' }
  if (name.includes('monitoring') || name.includes('observability')) return { bg: 'bg-blue-500/20', icon: 'monitoring', color: 'text-blue-400' }
  if (name.includes('ingress') || name.includes('nginx') || name.includes('gateway')) return { bg: 'bg-orange-500/20', icon: 'router', color: 'text-orange-400' }
  if (name.includes('dev') || name.includes('staging')) return { bg: 'bg-pink-500/20', icon: 'code', color: 'text-pink-400' }
  return { bg: 'bg-slate-500/20', icon: 'folder', color: 'text-slate-400' }
}

function NamespaceRowSkeleton() {
  return (
    <tr>
      <td className="px-6 py-4"><Skeleton className="h-9 w-48" /></td>
      <td className="px-6 py-4"><Skeleton className="h-5 w-16 rounded-full" /></td>
      <td className="px-6 py-4"><Skeleton className="h-5 w-32" /></td>
      <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
    </tr>
  )
}

function NamespacesPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, isError, error } = useResourceList({
    group: '',
    version: 'v1',
    name: 'namespaces',
    namespaced: false,
  })

  const listData = data as KubeListResponse | undefined
  const namespaces: KubeNamespace[] = (listData?.items ?? []) as KubeNamespace[]
  const activeCount = namespaces.filter((ns) => ns.status?.phase === 'Active').length

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Namespaces</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage and monitor the virtual clusters within your environment.
          </p>
        </div>
      </div>

      {isError && (
        <QueryError error={error} onRetry={() => queryClient.invalidateQueries({ queryKey: ['resources', '', 'v1', 'namespaces'] })} />
      )}

      {!isLoading && !isError && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Total</span>
              <p className="text-2xl font-bold">{namespaces.length}</p>
            </div>
            <div className="size-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              <span className="material-symbols-outlined">layers</span>
            </div>
          </div>
          <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Active</span>
              <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
            </div>
            <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <span className="material-symbols-outlined">check_circle</span>
            </div>
          </div>
        </div>
      )}

      {!isError && <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Labels</th>
                <th className="px-6 py-4">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <NamespaceRowSkeleton key={i} />)
              ) : namespaces.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <span className="material-symbols-outlined text-4xl text-slate-500 dark:text-slate-600 mb-2 block">layers</span>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">No namespaces found</p>
                  </td>
                </tr>
              ) : (
                namespaces.map((ns) => {
                  const icon = getNamespaceIcon(ns.metadata.name)
                  const labels = ns.metadata.labels ?? {}
                  const displayLabels = Object.entries(labels)
                    .filter(([k]) => !k.startsWith('kubernetes.io/'))
                    .slice(0, 3)

                  return (
                    <tr key={ns.metadata.name} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex-shrink-0 size-9 ${icon.bg} rounded-lg flex items-center justify-center ${icon.color}`}>
                            <span className="material-symbols-outlined text-[20px] leading-none">{icon.icon}</span>
                          </div>
                          <span className="font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                            {ns.metadata.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(ns.status?.phase ?? 'Unknown')}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {displayLabels.map(([k, v]) => (
                            <span
                              key={k}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-border-light dark:border-border-dark"
                            >
                              {k}={v}
                            </span>
                          ))}
                          {displayLabels.length === 0 && (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                        {relativeTime(ns.metadata.creationTimestamp)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>}
    </div>
  )
}
