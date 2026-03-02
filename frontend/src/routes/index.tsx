import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useResourceList } from '#/hooks/use-resource-list'
import { relativeTime } from '#/lib/time'
import { Skeleton } from '#/components/ui/skeleton'
import { QueryError } from '#/components/QueryError'

export const Route = createFileRoute('/')({ component: ClusterOverview })

type KubeItem = Record<string, unknown>

type KubeListResponse = {
  items?: KubeItem[]
  metadata?: {
    continue?: string
    resourceVersion?: string
  }
}

type NodeCondition = {
  type: string
  status: string
}

type NodeStatus = {
  conditions?: NodeCondition[]
  capacity?: Record<string, string>
  allocatable?: Record<string, string>
}

type KubeEvent = {
  type?: string
  reason?: string
  message?: string
  lastTimestamp?: string
  eventTime?: string
  metadata?: {
    name?: string
    namespace?: string
    creationTimestamp?: string
  }
  involvedObject?: {
    kind?: string
    name?: string
    namespace?: string
  }
}

function useNodes() {
  return useResourceList({
    group: '',
    version: 'v1',
    name: 'nodes',
    namespaced: false,
  })
}

function usePods() {
  return useResourceList({
    group: '',
    version: 'v1',
    name: 'pods',
    namespaced: true,
  })
}

function useNamespaces() {
  return useResourceList({
    group: '',
    version: 'v1',
    name: 'namespaces',
    namespaced: false,
  })
}

function useDeployments() {
  return useResourceList({
    group: 'apps',
    version: 'v1',
    name: 'deployments',
    namespaced: true,
  })
}

function useEvents() {
  return useResourceList({
    group: '',
    version: 'v1',
    name: 'events',
    namespaced: true,
    limit: 50,
  })
}

function getNodeStats(data: KubeListResponse | undefined) {
  const items = data?.items ?? []
  const total = items.length
  const ready = items.filter((node) => {
    const status = (node as { status?: NodeStatus }).status
    return status?.conditions?.some(
      (c) => c.type === 'Ready' && c.status === 'True'
    )
  }).length
  return { total, ready }
}

function getPodStats(data: KubeListResponse | undefined) {
  const items = data?.items ?? []
  const total = items.length
  let running = 0
  let pending = 0
  let failed = 0
  let succeeded = 0

  for (const pod of items) {
    const phase = ((pod as { status?: { phase?: string } }).status?.phase ?? '').toLowerCase()
    if (phase === 'running') running++
    else if (phase === 'pending') pending++
    else if (phase === 'failed') failed++
    else if (phase === 'succeeded') succeeded++
  }

  return { total, running, pending, failed, succeeded }
}

function getNodeResourceInfo(data: KubeListResponse | undefined) {
  const items = data?.items ?? []
  let totalCpuCores = 0
  let totalMemoryBytes = 0

  for (const node of items) {
    const capacity = (node as { status?: NodeStatus }).status?.capacity
    if (capacity) {
      const cpu = capacity.cpu
      if (cpu) {
        totalCpuCores += cpu.endsWith('m')
          ? parseInt(cpu, 10) / 1000
          : parseInt(cpu, 10)
      }
      const memory = capacity.memory
      if (memory) {
        totalMemoryBytes += parseMemoryToBytes(memory)
      }
    }
  }

  return { totalCpuCores, totalMemoryGiB: Math.round(totalMemoryBytes / (1024 * 1024 * 1024)) }
}

function parseMemoryToBytes(mem: string): number {
  if (mem.endsWith('Ki')) return parseInt(mem, 10) * 1024
  if (mem.endsWith('Mi')) return parseInt(mem, 10) * 1024 * 1024
  if (mem.endsWith('Gi')) return parseInt(mem, 10) * 1024 * 1024 * 1024
  return parseInt(mem, 10)
}

function getRecentEvents(data: KubeListResponse | undefined): KubeEvent[] {
  const items = (data?.items ?? []) as unknown as KubeEvent[]
  return [...items]
    .sort((a, b) => {
      const timeA = a.lastTimestamp || a.eventTime || a.metadata?.creationTimestamp || ''
      const timeB = b.lastTimestamp || b.eventTime || b.metadata?.creationTimestamp || ''
      return new Date(timeB).getTime() - new Date(timeA).getTime()
    })
    .slice(0, 8)
}

function StatCardSkeleton() {
  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 border border-border-light dark:border-border-dark shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-24 mb-2" />
      <Skeleton className="h-9 w-20 mt-2" />
      <Skeleton className="h-1.5 w-full mt-4 rounded-full" />
    </div>
  )
}

function StatCardError() {
  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 border border-red-500/30 shadow-sm">
      <div className="flex flex-col items-center justify-center py-2 text-center">
        <span className="material-symbols-outlined text-2xl text-red-500 mb-2">error</span>
        <p className="text-sm text-red-300/80">Failed to load</p>
      </div>
    </div>
  )
}

function NodesCard({ data, isLoading, isError }: { data: KubeListResponse | undefined; isLoading: boolean; isError: boolean }) {
  if (isError) return <StatCardError />
  if (isLoading) return <StatCardSkeleton />

  const { total, ready } = getNodeStats(data)
  const percentage = total > 0 ? Math.round((ready / total) * 100) : 0

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 border border-border-light dark:border-border-dark shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
          <span className="material-symbols-outlined">dns</span>
        </div>
        {ready === total && total > 0 ? (
          <span className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">All Ready</span>
        ) : total > 0 ? (
          <span className="text-xs font-medium text-orange-500 bg-orange-500/10 px-2 py-1 rounded-full">{total - ready} Not Ready</span>
        ) : null}
      </div>
      <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">Nodes Status</h3>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold">{ready}</span>
        <span className="text-sm text-slate-500 dark:text-slate-400">/ {total} Ready</span>
      </div>
      <div className="mt-4 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}

function PodsCard({ data, isLoading, isError }: { data: KubeListResponse | undefined; isLoading: boolean; isError: boolean }) {
  if (isError) return <StatCardError />
  if (isLoading) return <StatCardSkeleton />

  const { total, running, pending, failed } = getPodStats(data)
  const runningPct = total > 0 ? (running / total) * 100 : 0
  const pendingPct = total > 0 ? (pending / total) * 100 : 0
  const failedPct = total > 0 ? (failed / total) * 100 : 0

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 border border-border-light dark:border-border-dark shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
          <span className="material-symbols-outlined">deployed_code</span>
        </div>
        {pending > 0 ? (
          <span className="text-xs font-medium text-orange-500 bg-orange-500/10 px-2 py-1 rounded-full">+{pending} Pending</span>
        ) : failed > 0 ? (
          <span className="text-xs font-medium text-red-500 bg-red-500/10 px-2 py-1 rounded-full">{failed} Failed</span>
        ) : total > 0 ? (
          <span className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">Healthy</span>
        ) : null}
      </div>
      <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Pods</h3>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold">{total}</span>
        <span className="text-sm text-slate-500 dark:text-slate-400">Active</span>
      </div>
      <div className="mt-4 flex h-1.5 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
        <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${runningPct}%` }} />
        <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${pendingPct}%` }} />
        <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${failedPct}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
        <span>Running</span>
        <span>Pending</span>
        <span>Failed</span>
      </div>
    </div>
  )
}

function CpuCard({ data, isLoading, isError }: { data: KubeListResponse | undefined; isLoading: boolean; isError: boolean }) {
  if (isError) return <StatCardError />
  if (isLoading) return <StatCardSkeleton />

  const { totalCpuCores } = getNodeResourceInfo(data)

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 border border-border-light dark:border-border-dark shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
          <span className="material-symbols-outlined">memory</span>
        </div>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Capacity</span>
      </div>
      <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">CPU Capacity</h3>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold">{totalCpuCores}</span>
        <span className="text-sm text-slate-500 dark:text-slate-400">Cores</span>
      </div>
      <div className="mt-4 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full" style={{ width: '100%' }} />
      </div>
    </div>
  )
}

function MemoryCard({ data, isLoading, isError }: { data: KubeListResponse | undefined; isLoading: boolean; isError: boolean }) {
  if (isError) return <StatCardError />
  if (isLoading) return <StatCardSkeleton />

  const { totalMemoryGiB } = getNodeResourceInfo(data)

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 border border-border-light dark:border-border-dark shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 rounded-lg bg-pink-500/10 text-pink-500">
          <span className="material-symbols-outlined">hard_drive</span>
        </div>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Capacity</span>
      </div>
      <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">Memory Capacity</h3>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold">{totalMemoryGiB}</span>
        <span className="text-sm text-slate-500 dark:text-slate-400">GiB Total</span>
      </div>
      <div className="mt-4 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-pink-400 to-pink-600 rounded-full" style={{ width: '100%' }} />
      </div>
    </div>
  )
}

function EventTypeIcon({ type }: { type: string | undefined }) {
  if (type === 'Warning') {
    return <span className="material-symbols-outlined text-orange-400 text-[20px]" title="Warning">warning</span>
  }
  return <span className="material-symbols-outlined text-emerald-500 text-[20px]" title="Normal">check_circle</span>
}

function EventsTableSkeleton() {
  return (
    <div className="divide-y divide-border-light dark:divide-border-dark">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-64 flex-1" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}

function RecentEventsTable({ data, isLoading, isError }: { data: KubeListResponse | undefined; isLoading: boolean; isError: boolean }) {
  const events = getRecentEvents(data)
  const totalCount = (data?.items ?? []).length

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
      <div className="p-6 border-b border-border-light dark:border-border-dark flex items-center justify-between">
        <h3 className="text-lg font-bold">Recent Events</h3>
      </div>
      {isError ? (
        <div className="p-8 text-center text-red-400">
          <span className="material-symbols-outlined text-4xl mb-2 block">error</span>
          <p className="text-sm">Failed to load events</p>
        </div>
      ) : isLoading ? (
        <EventsTableSkeleton />
      ) : events.length === 0 ? (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
          <span className="material-symbols-outlined text-4xl mb-2 block">event_busy</span>
          <p className="text-sm">No events found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-800/50">
                <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-12">Type</th>
                <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Object</th>
                <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Reason</th>
                <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Message</th>
                <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-32">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark text-sm">
              {events.map((event) => {
                const objectKind = event.involvedObject?.kind?.toLowerCase() ?? ''
                const objectName = event.involvedObject?.name ?? ''
                const objectLabel = objectKind && objectName ? `${objectKind}/${objectName}` : objectName
                const timestamp = event.lastTimestamp || event.eventTime || event.metadata?.creationTimestamp || ''

                return (
                  <tr
                    key={event.metadata?.name}
                    className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="p-4">
                      <EventTypeIcon type={event.type} />
                    </td>
                    <td className="p-4 font-medium max-w-[200px] truncate">{objectLabel}</td>
                    <td className="p-4">{event.reason}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-400 max-w-[400px] truncate">{event.message}</td>
                    <td className="p-4 text-slate-500">{timestamp ? relativeTime(timestamp) : '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {!isLoading && totalCount > 0 && (
        <div className="p-4 border-t border-border-light dark:border-border-dark">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Showing {Math.min(events.length, 8)} of {totalCount} events
          </span>
        </div>
      )}
    </div>
  )
}

function ClusterOverview() {
  const queryClient = useQueryClient()

  const nodesQuery = useNodes()
  const podsQuery = usePods()
  const namespacesQuery = useNamespaces()
  const deploymentsQuery = useDeployments()
  const eventsQuery = useEvents()

  const namespaceCount = ((namespacesQuery.data as KubeListResponse | undefined)?.items ?? []).length
  const deploymentCount = ((deploymentsQuery.data as KubeListResponse | undefined)?.items ?? []).length

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['resources'] })
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Cluster Health</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Real-time overview of your cluster resources and status.
            {namespaceCount > 0 && (
              <span className="ml-2 text-slate-600 dark:text-slate-300">
                {namespaceCount} namespaces, {deploymentCount} deployments
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <NodesCard
          data={nodesQuery.data as KubeListResponse | undefined}
          isLoading={nodesQuery.isLoading}
          isError={nodesQuery.isError}
        />
        <PodsCard
          data={podsQuery.data as KubeListResponse | undefined}
          isLoading={podsQuery.isLoading}
          isError={podsQuery.isError}
        />
        <CpuCard
          data={nodesQuery.data as KubeListResponse | undefined}
          isLoading={nodesQuery.isLoading}
          isError={nodesQuery.isError}
        />
        <MemoryCard
          data={nodesQuery.data as KubeListResponse | undefined}
          isLoading={nodesQuery.isLoading}
          isError={nodesQuery.isError}
        />
      </div>

      <RecentEventsTable
        data={eventsQuery.data as KubeListResponse | undefined}
        isLoading={eventsQuery.isLoading}
        isError={eventsQuery.isError}
      />
    </div>
  )
}
