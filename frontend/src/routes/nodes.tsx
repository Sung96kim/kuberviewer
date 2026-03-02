import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useResourceList } from '#/hooks/use-resource-list'
import { relativeTime } from '#/lib/time'
import { Skeleton } from '#/components/ui/skeleton'
import { QueryError } from '#/components/QueryError'

export const Route = createFileRoute('/nodes')({ component: NodesPage })

type KubeNode = {
  metadata: {
    name: string
    creationTimestamp: string
    labels?: Record<string, string>
  }
  status: {
    conditions?: Array<{ type: string; status: string }>
    nodeInfo?: {
      kubeletVersion: string
      osImage: string
      architecture: string
      containerRuntimeVersion: string
      operatingSystem: string
    }
    capacity?: Record<string, string>
    allocatable?: Record<string, string>
    addresses?: Array<{ type: string; address: string }>
  }
}

type KubeListResponse = {
  items?: KubeNode[]
}

function getNodeStatus(node: KubeNode): string {
  const ready = node.status?.conditions?.find((c) => c.type === 'Ready')
  if (!ready) return 'Unknown'
  return ready.status === 'True' ? 'Ready' : 'NotReady'
}

function getNodeRoles(node: KubeNode): string[] {
  const labels = node.metadata.labels ?? {}
  const roles: string[] = []
  for (const key of Object.keys(labels)) {
    if (key.startsWith('node-role.kubernetes.io/')) {
      roles.push(key.replace('node-role.kubernetes.io/', ''))
    }
  }
  return roles.length > 0 ? roles : ['worker']
}

function StatusBadge({ status }: { status: string }) {
  const isReady = status === 'Ready'
  const bgClass = isReady ? 'bg-emerald-500/10' : 'bg-red-500/10'
  const textClass = isReady ? 'text-emerald-500' : 'text-red-500'
  const borderClass = isReady ? 'border-emerald-500/20' : 'border-red-500/20'
  const dotClass = isReady ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'

  return (
    <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full ${bgClass} ${textClass} border ${borderClass}`}>
      <div className={`size-1.5 rounded-full ${dotClass}`} />
      <span className="text-xs font-semibold">{status}</span>
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  const isControlPlane = role === 'control-plane' || role === 'master'
  const bgClass = isControlPlane ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${bgClass}`}>
      {role}
    </span>
  )
}

function NodeRowSkeleton() {
  return (
    <tr>
      <td className="px-6 py-4"><Skeleton className="h-5 w-48" /></td>
      <td className="px-6 py-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
      <td className="px-6 py-4"><Skeleton className="h-6 w-20 rounded-md" /></td>
      <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
      <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
    </tr>
  )
}

function NodesPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, isError, error } = useResourceList({
    group: '',
    version: 'v1',
    name: 'nodes',
    namespaced: false,
  })

  const listData = data as KubeListResponse | undefined
  const nodes: KubeNode[] = (listData?.items ?? []) as KubeNode[]

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Nodes</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage and monitor the worker machines in your Kubernetes cluster.
          </p>
        </div>
      </div>

      {isError && (
        <QueryError error={error} onRetry={() => queryClient.invalidateQueries({ queryKey: ['resources', '', 'v1', 'nodes'] })} />
      )}

      {!isError && <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Roles</th>
                <th className="px-6 py-4">Version</th>
                <th className="px-6 py-4">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <NodeRowSkeleton key={i} />)
              ) : nodes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <span className="material-symbols-outlined text-4xl text-slate-500 dark:text-slate-600 mb-2 block">dns</span>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">No nodes found</p>
                  </td>
                </tr>
              ) : (
                nodes.map((node) => {
                  const status = getNodeStatus(node)
                  const roles = getNodeRoles(node)
                  const version = node.status?.nodeInfo?.kubeletVersion ?? '-'

                  return (
                    <tr key={node.metadata.name} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            <span className="material-symbols-outlined text-[20px]">dns</span>
                          </div>
                          <span className="font-medium text-slate-900 dark:text-white">{node.metadata.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={status} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1.5">
                          {roles.map((role) => (
                            <RoleBadge key={role} role={role} />
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-xs">
                        {version}
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                        {relativeTime(node.metadata.creationTimestamp)}
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
