import type { ReactNode } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  PieChart, Pie, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useResourceList } from '#/hooks/use-resource-list'
import { useNodeMetrics } from '#/hooks/use-metrics'
import { usePrometheusStatus } from '#/hooks/use-prometheus'
import { usePollingInterval } from '#/hooks/use-polling'
import { api } from '#/api'
import { parseCpuToCores, parseMemoryToBytes, formatMemory } from '#/lib/resource-units'
import { relativeTime } from '#/lib/time'
import { Skeleton } from '#/components/ui/skeleton'
import { RefetchIndicator } from '#/components/ui/refetch-indicator'
import type { NodeMetricItem, PrometheusQueryResponse } from '#/api'

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

type ContainerState = { waiting?: { reason?: string }; terminated?: { reason?: string } }

const PROBLEM_REASONS = new Set([
  'CrashLoopBackOff',
  'ImagePullBackOff',
  'ErrImagePull',
  'CreateContainerConfigError',
  'OOMKilled',
])

function getPodIssues(pod: KubeItem): Record<string, number> {
  const status = pod as { status?: { containerStatuses?: Array<{ state?: ContainerState }> } }
  const issues: Record<string, number> = {}
  for (const cs of status.status?.containerStatuses ?? []) {
    const reason = cs.state?.waiting?.reason ?? cs.state?.terminated?.reason ?? ''
    if (PROBLEM_REASONS.has(reason)) {
      issues[reason] = (issues[reason] ?? 0) + 1
    }
  }
  return issues
}

function getPodStats(data: KubeListResponse | undefined) {
  const items = data?.items ?? []
  const total = items.length
  let running = 0
  let pending = 0
  let failed = 0
  let succeeded = 0
  const issues: Record<string, number> = {}

  for (const pod of items) {
    const phase = ((pod as { status?: { phase?: string } }).status?.phase ?? '').toLowerCase()
    if (phase === 'running') running++
    else if (phase === 'pending') pending++
    else if (phase === 'failed') failed++
    else if (phase === 'succeeded') succeeded++
    for (const [reason, count] of Object.entries(getPodIssues(pod))) {
      issues[reason] = (issues[reason] ?? 0) + count
    }
  }

  return { total, running, pending, failed, succeeded, issues }
}

function getNodeResourceInfo(data: KubeListResponse | undefined) {
  const items = data?.items ?? []
  let totalCpuCores = 0
  let totalMemoryBytes = 0

  for (const node of items) {
    const capacity = (node as { status?: NodeStatus }).status?.capacity
    if (capacity) {
      if (capacity.cpu) totalCpuCores += parseCpuToCores(capacity.cpu)
      if (capacity.memory) totalMemoryBytes += parseMemoryToBytes(capacity.memory)
    }
  }

  return { totalCpuCores, totalMemoryBytes }
}

function getMetricsUsage(items: NodeMetricItem[] | undefined) {
  if (!items?.length) return null
  let cpuCores = 0
  let memoryBytes = 0
  for (const node of items) {
    cpuCores += parseCpuToCores(node.usage.cpu)
    memoryBytes += parseMemoryToBytes(node.usage.memory)
  }
  return { cpuCores, memoryBytes }
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

function NodesCard({ data, isLoading, isError, isFetching }: { data: KubeListResponse | undefined; isLoading: boolean; isError: boolean; isFetching: boolean }) {
  if (isError) return <StatCardError />
  if (isLoading) return <StatCardSkeleton />

  const { total, ready } = getNodeStats(data)
  const percentage = total > 0 ? Math.round((ready / total) * 100) : 0

  return (
    <Link to="/nodes" className="block bg-surface-light dark:bg-surface-dark rounded-xl p-6 border border-border-light dark:border-border-dark shadow-sm hover:border-blue-500/40 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-200 cursor-pointer">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
          <span className="material-symbols-outlined">dns</span>
        </div>
        <div className="flex items-center gap-2">
          <RefetchIndicator fetching={isFetching} />
          {ready === total && total > 0 ? (
            <span className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">All Ready</span>
          ) : total > 0 ? (
            <span className="text-xs font-medium text-orange-500 bg-orange-500/10 px-2 py-1 rounded-full">{total - ready} Not Ready</span>
          ) : null}
        </div>
      </div>
      <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">Nodes Status</h3>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold">{ready}</span>
        <span className="text-sm text-slate-500 dark:text-slate-400">/ {total} Ready</span>
      </div>
      <div className="mt-4 h-1.5 w-full bg-slate-100 dark:bg-surface-highlight rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
      </div>
    </Link>
  )
}

function PodsCard({ data, isLoading, isError, isFetching }: { data: KubeListResponse | undefined; isLoading: boolean; isError: boolean; isFetching: boolean }) {
  if (isError) return <StatCardError />
  if (isLoading) return <StatCardSkeleton />

  const { total, running, pending, failed, issues } = getPodStats(data)
  const totalIssues = Object.values(issues).reduce((a, b) => a + b, 0)
  const topIssue = Object.entries(issues).sort((a, b) => b[1] - a[1])[0]
  const runningPct = total > 0 ? (running / total) * 100 : 0
  const pendingPct = total > 0 ? (pending / total) * 100 : 0
  const failedPct = total > 0 ? (failed / total) * 100 : 0
  const issuePct = total > 0 ? (totalIssues / total) * 100 : 0

  return (
    <Link to="/resources/$" params={{ _splat: 'v1/pods' }} className="block bg-surface-light dark:bg-surface-dark rounded-xl p-6 border border-border-light dark:border-border-dark shadow-sm hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-200 cursor-pointer">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
          <span className="material-symbols-outlined">deployed_code</span>
        </div>
        <div className="flex items-center gap-2">
          <RefetchIndicator fetching={isFetching} />
          {topIssue ? (
            <span className="text-xs font-medium text-red-500 bg-red-500/10 px-2 py-1 rounded-full">{topIssue[1]} {topIssue[0]}</span>
          ) : pending > 0 ? (
            <span className="text-xs font-medium text-orange-500 bg-orange-500/10 px-2 py-1 rounded-full">+{pending} Pending</span>
          ) : failed > 0 ? (
            <span className="text-xs font-medium text-red-500 bg-red-500/10 px-2 py-1 rounded-full">{failed} Failed</span>
          ) : total > 0 ? (
            <span className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">Healthy</span>
          ) : null}
        </div>
      </div>
      <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Pods</h3>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold">{total}</span>
        <span className="text-sm text-slate-500 dark:text-slate-400">Active</span>
      </div>
      <div className="mt-4 flex h-1.5 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-surface-highlight">
        <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${runningPct}%` }} />
        <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${pendingPct}%` }} />
        <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${failedPct}%` }} />
        {issuePct > 0 && <div className="h-full bg-red-600 transition-all duration-500" style={{ width: `${issuePct}%` }} />}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
        <span>Running</span>
        <span>Pending</span>
        <span>Failed</span>
        {totalIssues > 0 && <span className="text-red-400">Issues</span>}
      </div>
    </Link>
  )
}

function CpuCard({ data, isLoading, isError, metricsItems, isFetching }: { data: KubeListResponse | undefined; isLoading: boolean; isError: boolean; metricsItems: NodeMetricItem[] | undefined; isFetching: boolean }) {
  if (isError) return <StatCardError />
  if (isLoading) return <StatCardSkeleton />

  const { totalCpuCores } = getNodeResourceInfo(data)
  const usage = getMetricsUsage(metricsItems)
  const pct = usage && totalCpuCores > 0 ? Math.round((usage.cpuCores / totalCpuCores) * 100) : null

  return (
    <Link to="/nodes" className="block bg-surface-light dark:bg-surface-dark rounded-xl p-6 border border-border-light dark:border-border-dark shadow-sm hover:border-orange-500/40 hover:-translate-y-1 hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-200 cursor-pointer">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
          <span className="material-symbols-outlined">memory</span>
        </div>
        <div className="flex items-center gap-2">
          <RefetchIndicator fetching={isFetching} />
          {pct !== null ? (
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${pct > 80 ? 'text-red-500 bg-red-500/10' : pct > 50 ? 'text-amber-500 bg-amber-500/10' : 'text-emerald-500 bg-emerald-500/10'}`}>{pct}% Used</span>
          ) : (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Capacity</span>
          )}
        </div>
      </div>
      <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">CPU</h3>
      <div className="mt-2 flex items-baseline gap-2">
        {usage ? (
          <>
            <span className="text-3xl font-bold">{usage.cpuCores.toFixed(1)}</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">/ {totalCpuCores} Cores</span>
          </>
        ) : (
          <>
            <span className="text-3xl font-bold">{totalCpuCores}</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">Cores</span>
          </>
        )}
      </div>
      <div className="mt-4 h-1.5 w-full bg-slate-100 dark:bg-surface-highlight rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-500" style={{ width: pct !== null ? `${pct}%` : '100%' }} />
      </div>
    </Link>
  )
}

function MemoryCard({ data, isLoading, isError, metricsItems, isFetching }: { data: KubeListResponse | undefined; isLoading: boolean; isError: boolean; metricsItems: NodeMetricItem[] | undefined; isFetching: boolean }) {
  if (isError) return <StatCardError />
  if (isLoading) return <StatCardSkeleton />

  const { totalMemoryBytes } = getNodeResourceInfo(data)
  const usage = getMetricsUsage(metricsItems)
  const pct = usage && totalMemoryBytes > 0 ? Math.round((usage.memoryBytes / totalMemoryBytes) * 100) : null

  return (
    <Link to="/nodes" className="block bg-surface-light dark:bg-surface-dark rounded-xl p-6 border border-border-light dark:border-border-dark shadow-sm hover:border-pink-500/40 hover:-translate-y-1 hover:shadow-lg hover:shadow-pink-500/10 transition-all duration-200 cursor-pointer">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 rounded-lg bg-pink-500/10 text-pink-500">
          <span className="material-symbols-outlined">hard_drive</span>
        </div>
        <div className="flex items-center gap-2">
          <RefetchIndicator fetching={isFetching} />
          {pct !== null ? (
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${pct > 80 ? 'text-red-500 bg-red-500/10' : pct > 50 ? 'text-amber-500 bg-amber-500/10' : 'text-emerald-500 bg-emerald-500/10'}`}>{pct}% Used</span>
          ) : (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Capacity</span>
          )}
        </div>
      </div>
      <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">Memory</h3>
      <div className="mt-2 flex items-baseline gap-2">
        {usage ? (
          <>
            <span className="text-3xl font-bold">{formatMemory(usage.memoryBytes)}</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">/ {formatMemory(totalMemoryBytes)}</span>
          </>
        ) : (
          <>
            <span className="text-3xl font-bold">{formatMemory(totalMemoryBytes)}</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">Total</span>
          </>
        )}
      </div>
      <div className="mt-4 h-1.5 w-full bg-slate-100 dark:bg-surface-highlight rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-pink-400 to-pink-600 rounded-full transition-all duration-500" style={{ width: pct !== null ? `${pct}%` : '100%' }} />
      </div>
    </Link>
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

function RecentEventsTable({ data, isLoading, isError, isFetching }: { data: KubeListResponse | undefined; isLoading: boolean; isError: boolean; isFetching: boolean }) {
  const events = getRecentEvents(data)
  const totalCount = (data?.items ?? []).length

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
      <div className="p-6 border-b border-border-light dark:border-border-dark flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold">Recent Events</h3>
          <RefetchIndicator fetching={isFetching} />
        </div>
        <Link to="/events" className="text-sm text-primary hover:text-primary/80 font-medium transition-colors">
          View All Events
        </Link>
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
              <tr className="border-b border-border-light dark:border-border-dark bg-slate-50 dark:bg-surface-highlight/50">
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
                    className="group hover:bg-slate-50 dark:hover:bg-surface-hover/30 transition-colors"
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

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(15,23,42,0.95)',
  border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: '8px',
  fontSize: '12px',
  color: '#e2e8f0',
} as const

function getNamespacePodCounts(data: KubeListResponse | undefined) {
  const items = data?.items ?? []
  const counts: Record<string, number> = {}
  for (const pod of items) {
    const ns = ((pod as { metadata?: { namespace?: string } }).metadata?.namespace) ?? 'unknown'
    counts[ns] = (counts[ns] ?? 0) + 1
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

function getNodeResourceData(
  nodes: KubeListResponse | undefined,
  metricsItems: NodeMetricItem[] | undefined,
) {
  const items = nodes?.items ?? []
  const metricsMap = new Map<string, NodeMetricItem>()
  for (const m of metricsItems ?? []) {
    metricsMap.set(m.metadata.name, m)
  }
  return items.map((node) => {
    const name = ((node as { metadata?: { name?: string } }).metadata?.name) ?? 'unknown'
    const capacity = (node as { status?: NodeStatus }).status?.capacity
    const metrics = metricsMap.get(name)

    const cpuCap = capacity?.cpu ? parseCpuToCores(capacity.cpu) : 0
    const memCapBytes = capacity?.memory ? parseMemoryToBytes(capacity.memory) : 0
    const cpuUsed = metrics ? parseCpuToCores(metrics.usage.cpu) : 0
    const memUsedBytes = metrics ? parseMemoryToBytes(metrics.usage.memory) : 0

    return {
      name: name.length > 15 ? name.slice(0, 13) + '..' : name,
      cpuUsed: Math.round(cpuUsed * 100) / 100,
      cpuCap: Math.round(cpuCap * 100) / 100,
      cpuPct: cpuCap > 0 ? Math.round((cpuUsed / cpuCap) * 100) : 0,
      memUsedGi: Math.round((memUsedBytes / 1024 ** 3) * 10) / 10,
      memCapGi: Math.round((memCapBytes / 1024 ** 3) * 10) / 10,
      memPct: memCapBytes > 0 ? Math.round((memUsedBytes / memCapBytes) * 100) : 0,
    }
  }).sort((a, b) => b.cpuPct - a.cpuPct)
}

function transformTrendData(response: PrometheusQueryResponse | undefined): Array<{ time: number; value: number }> {
  if (!response?.data?.result?.[0]?.values) return []
  return response.data.result[0].values.map(([ts, val]) => ({
    time: ts,
    value: parseFloat(val),
  }))
}

function formatTrendTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatCpuChart(cores: number): string {
  if (cores < 0.01) return `${(cores * 1000).toFixed(0)}m`
  return `${cores.toFixed(2)}`
}

function formatMemChart(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GiB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MiB`
  return `${(bytes / 1024).toFixed(0)} KiB`
}

function useClusterCpuTrend(enabled: boolean) {
  const interval = usePollingInterval(60_000)
  return useQuery<PrometheusQueryResponse>({
    queryKey: ['overview', 'cpu-trend'],
    queryFn: () => {
      const now = Math.floor(Date.now() / 1000)
      return api.prometheusQueryRange({
        query: 'sum(rate(container_cpu_usage_seconds_total{container!="",container!="POD"}[5m]))',
        start: now - 3600,
        end: now,
        step: '60s',
      })
    },
    enabled,
    staleTime: 30_000,
    refetchInterval: interval,
  })
}

function useClusterMemoryTrend(enabled: boolean) {
  const interval = usePollingInterval(60_000)
  return useQuery<PrometheusQueryResponse>({
    queryKey: ['overview', 'memory-trend'],
    queryFn: () => {
      const now = Math.floor(Date.now() / 1000)
      return api.prometheusQueryRange({
        query: 'sum(container_memory_working_set_bytes{container!="",container!="POD"})',
        start: now - 3600,
        end: now,
        step: '60s',
      })
    },
    enabled,
    staleTime: 30_000,
    refetchInterval: interval,
  })
}

function ChartCard({ title, icon, iconColor, isFetching, children }: { title: string; icon: string; iconColor: string; isFetching?: boolean; children: ReactNode }) {
  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className={`material-symbols-outlined text-[20px] ${iconColor}`}>{icon}</span>
        <h3 className="font-semibold">{title}</h3>
        {isFetching && <RefetchIndicator fetching />}
      </div>
      {children}
    </div>
  )
}

function ChartCardSkeleton({ title }: { title: string }) {
  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-5 w-5 rounded" />
        <span className="font-semibold">{title}</span>
      </div>
      <Skeleton className="h-56 w-full rounded-lg" />
    </div>
  )
}

function PodStatusChart({ data, isLoading, isError, isFetching }: { data: KubeListResponse | undefined; isLoading: boolean; isError: boolean; isFetching: boolean }) {
  if (isError) return <StatCardError />
  if (isLoading) return <ChartCardSkeleton title="Pod Status" />

  const { running, pending, failed, succeeded, issues } = getPodStats(data)
  const chartData = [
    { name: 'Running', value: running, fill: '#10b981' },
    { name: 'Pending', value: pending, fill: '#f59e0b' },
    { name: 'Failed', value: failed, fill: '#ef4444' },
    { name: 'Succeeded', value: succeeded, fill: '#6b7280' },
    ...Object.entries(issues).map(([reason, count]) => ({
      name: reason, value: count, fill: '#dc2626',
    })),
  ].filter(d => d.value > 0)

  if (chartData.length === 0) return null

  return (
    <ChartCard title="Pod Status Distribution" icon="donut_large" iconColor="text-emerald-500" isFetching={isFetching}>
      <div className="h-56 flex items-center">
        <div className="flex-1 h-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                strokeWidth={0}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-1.5 min-w-[120px]">
          {chartData.map((d) => (
            <div key={d.name} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{d.name}</span>
              <span className="text-xs font-semibold ml-auto">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  )
}

function NamespacePodChart({ data, isLoading, isError, isFetching }: { data: KubeListResponse | undefined; isLoading: boolean; isError: boolean; isFetching: boolean }) {
  if (isError) return <StatCardError />
  if (isLoading) return <ChartCardSkeleton title="Pods by Namespace" />

  const nsCounts = getNamespacePodCounts(data)
  if (nsCounts.length === 0) return null

  return (
    <ChartCard title="Pods by Namespace" icon="folder" iconColor="text-blue-500" isFetching={isFetching}>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={nsCounts} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(148,163,184,0.1)' }} />
            <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

function NodeResourceChart({ nodes, metricsItems, isLoading, isError, isFetching }: {
  nodes: KubeListResponse | undefined
  metricsItems: NodeMetricItem[] | undefined
  isLoading: boolean
  isError: boolean
  isFetching: boolean
}) {
  if (isError) return <StatCardError />
  if (isLoading) return <ChartCardSkeleton title="Node Resource Usage" />

  const nodeData = getNodeResourceData(nodes, metricsItems)
  if (nodeData.length === 0 || !metricsItems?.length) return null

  return (
    <ChartCard title="Node Resource Usage" icon="dns" iconColor="text-blue-500" isFetching={isFetching}>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={nodeData} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={nodeData.length > 6 ? -35 : 0}
              textAnchor={nodeData.length > 6 ? 'end' : 'middle'}
              height={nodeData.length > 6 ? 60 : 30}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              unit="%"
              width={45}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              cursor={{ fill: 'rgba(148,163,184,0.1)' }}
              formatter={(value) => [`${value ?? 0}%`, '']}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="cpuPct" name="CPU" fill="#f97316" radius={[3, 3, 0, 0]} maxBarSize={24} />
            <Bar dataKey="memPct" name="Memory" fill="#ec4899" radius={[3, 3, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

function TrendChart({ title, icon, iconColor, data, isLoading, isFetching, formatValue, color, unit }: {
  title: string
  icon: string
  iconColor: string
  data: Array<{ time: number; value: number }>
  isLoading: boolean
  isFetching: boolean
  formatValue: (v: number) => string
  color: string
  unit: string
}) {
  if (isLoading) return <ChartCardSkeleton title={title} />

  if (data.length === 0) {
    return (
      <ChartCard title={title} icon={icon} iconColor={iconColor} isFetching={isFetching}>
        <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
          No data available
        </div>
      </ChartCard>
    )
  }

  const gradientId = `trend-${title.replace(/\s/g, '')}`

  return (
    <ChartCard title={title} icon={icon} iconColor={iconColor} isFetching={isFetching}>
      <div className="flex items-center gap-2 -mt-2 mb-2">
        <span className="text-xs text-slate-500">Last 1 hour</span>
        <span className="text-xs text-slate-400 ml-auto">{unit}</span>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
            <XAxis
              dataKey="time"
              tickFormatter={formatTrendTime}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatValue}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={(label) => formatTrendTime(label as number)}
              formatter={(value) => [formatValue(value as number), '']}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={`url(#${gradientId})`}
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

function ClusterOverview() {
  const queryClient = useQueryClient()

  const nodesQuery = useNodes()
  const podsQuery = usePods()
  const namespacesQuery = useNamespaces()
  const deploymentsQuery = useDeployments()
  const eventsQuery = useEvents()
  const metricsQuery = useNodeMetrics()
  const metricsItems = metricsQuery.data?.available ? metricsQuery.data.items : undefined

  const promStatus = usePrometheusStatus()
  const promAvailable = promStatus.data?.available ?? false
  const cpuTrend = useClusterCpuTrend(promAvailable)
  const memTrend = useClusterMemoryTrend(promAvailable)
  const cpuTrendData = transformTrendData(cpuTrend.data)
  const memTrendData = transformTrendData(memTrend.data)

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
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark hover:bg-slate-50 dark:hover:bg-surface-hover text-sm font-medium transition-colors"
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
          isFetching={nodesQuery.isFetching}
        />
        <PodsCard
          data={podsQuery.data as KubeListResponse | undefined}
          isLoading={podsQuery.isLoading}
          isError={podsQuery.isError}
          isFetching={podsQuery.isFetching}
        />
        <CpuCard
          data={nodesQuery.data as KubeListResponse | undefined}
          isLoading={nodesQuery.isLoading}
          isError={nodesQuery.isError}
          metricsItems={metricsItems}
          isFetching={nodesQuery.isFetching || metricsQuery.isFetching}
        />
        <MemoryCard
          data={nodesQuery.data as KubeListResponse | undefined}
          isLoading={nodesQuery.isLoading}
          isError={nodesQuery.isError}
          metricsItems={metricsItems}
          isFetching={nodesQuery.isFetching || metricsQuery.isFetching}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PodStatusChart
          data={podsQuery.data as KubeListResponse | undefined}
          isLoading={podsQuery.isLoading}
          isError={podsQuery.isError}
          isFetching={podsQuery.isFetching}
        />
        <NamespacePodChart
          data={podsQuery.data as KubeListResponse | undefined}
          isLoading={podsQuery.isLoading}
          isError={podsQuery.isError}
          isFetching={podsQuery.isFetching}
        />
      </div>

      <NodeResourceChart
        nodes={nodesQuery.data as KubeListResponse | undefined}
        metricsItems={metricsItems}
        isLoading={nodesQuery.isLoading || metricsQuery.isLoading}
        isError={nodesQuery.isError}
        isFetching={nodesQuery.isFetching || metricsQuery.isFetching}
      />

      {promAvailable && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <TrendChart
            title="CPU Trend"
            icon="show_chart"
            iconColor="text-orange-500"
            data={cpuTrendData}
            isLoading={cpuTrend.isLoading}
            isFetching={cpuTrend.isFetching}
            formatValue={formatCpuChart}
            color="#f97316"
            unit="cores"
          />
          <TrendChart
            title="Memory Trend"
            icon="show_chart"
            iconColor="text-pink-500"
            data={memTrendData}
            isLoading={memTrend.isLoading}
            isFetching={memTrend.isFetching}
            formatValue={formatMemChart}
            color="#ec4899"
            unit="bytes"
          />
        </div>
      )}

      <RecentEventsTable
        data={eventsQuery.data as KubeListResponse | undefined}
        isLoading={eventsQuery.isLoading}
        isError={eventsQuery.isError}
        isFetching={eventsQuery.isFetching}
      />
    </div>
  )
}
