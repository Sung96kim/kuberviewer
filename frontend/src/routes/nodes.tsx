import { useState, useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useResourceList } from '#/hooks/use-resource-list'
import { relativeTime } from '#/lib/time'
import { Skeleton } from '#/components/ui/skeleton'
import { QueryError } from '#/components/QueryError'
import { Breadcrumb } from '#/components/layout/Breadcrumb'

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

type ResourceValues = {
  allocatable: number
  capacity: number
  percentage: number
  allocatableDisplay: string
  capacityDisplay: string
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

function parseCpuValue(value: string): number {
  if (value.endsWith('m')) {
    return parseInt(value, 10) / 1000
  }
  if (value.endsWith('n')) {
    return parseInt(value, 10) / 1_000_000_000
  }
  return parseFloat(value)
}

function parseMemoryBytes(value: string): number {
  const units: Record<string, number> = {
    Ki: 1024,
    Mi: 1024 ** 2,
    Gi: 1024 ** 3,
    Ti: 1024 ** 4,
    K: 1000,
    M: 1000 ** 2,
    G: 1000 ** 3,
    T: 1000 ** 4,
  }
  for (const [suffix, multiplier] of Object.entries(units)) {
    if (value.endsWith(suffix)) {
      return parseFloat(value.replace(suffix, '')) * multiplier
    }
  }
  return parseFloat(value)
}

function formatMemoryGi(bytes: number): string {
  const gi = bytes / (1024 ** 3)
  return gi >= 1 ? `${gi.toFixed(1)} GiB` : `${(bytes / (1024 ** 2)).toFixed(0)} MiB`
}

function getCpuValues(node: KubeNode): ResourceValues | null {
  const capacityRaw = node.status?.capacity?.cpu
  const allocatableRaw = node.status?.allocatable?.cpu
  if (!capacityRaw || !allocatableRaw) return null
  const capacity = parseCpuValue(capacityRaw)
  const allocatable = parseCpuValue(allocatableRaw)
  const percentage = capacity > 0 ? Math.round((allocatable / capacity) * 100) : 0
  return {
    allocatable,
    capacity,
    percentage,
    allocatableDisplay: `${allocatable.toFixed(1)}`,
    capacityDisplay: `${capacity} Cores`,
  }
}

function getMemoryValues(node: KubeNode): ResourceValues | null {
  const capacityRaw = node.status?.capacity?.memory
  const allocatableRaw = node.status?.allocatable?.memory
  if (!capacityRaw || !allocatableRaw) return null
  const capacity = parseMemoryBytes(capacityRaw)
  const allocatable = parseMemoryBytes(allocatableRaw)
  const percentage = capacity > 0 ? Math.round((allocatable / capacity) * 100) : 0
  return {
    allocatable,
    capacity,
    percentage,
    allocatableDisplay: formatMemoryGi(allocatable),
    capacityDisplay: formatMemoryGi(capacity),
  }
}

function getBarColor(percentage: number): { bar: string; bg: string; text: string } {
  if (percentage >= 80) return { bar: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-500' }
  if (percentage >= 50) return { bar: 'bg-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-500' }
  return { bar: 'bg-red-500', bg: 'bg-red-500/10', text: 'text-red-500' }
}

function ResourceBar({ values, icon }: { values: ResourceValues | null; icon: string }) {
  if (!values) {
    return <span className="text-xs text-slate-400">-</span>
  }

  const color = getBarColor(values.percentage)

  return (
    <div className="min-w-[180px] space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className={`material-symbols-outlined text-[14px] ${color.text}`}>{icon}</span>
          <span className={`font-semibold ${color.text}`}>{values.percentage}%</span>
        </div>
        <span className="text-slate-500 dark:text-slate-400">
          {values.allocatableDisplay} / {values.capacityDisplay}
        </span>
      </div>
      <div className={`h-2 rounded-full ${color.bg} overflow-hidden`}>
        <div
          className={`h-full rounded-full ${color.bar} transition-all duration-500`}
          style={{ width: `${Math.min(values.percentage, 100)}%` }}
        />
      </div>
    </div>
  )
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
      <td className="px-6 py-4">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-2 w-44 rounded-full" />
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-2 w-44 rounded-full" />
        </div>
      </td>
      <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
      <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
    </tr>
  )
}

function NodesPage() {
  const [roleFilter, setRoleFilter] = useState<string>('All')
  const [statusFilter, setStatusFilter] = useState<string>('All')

  const queryClient = useQueryClient()
  const { data, isLoading, isError, error } = useResourceList({
    group: '',
    version: 'v1',
    name: 'nodes',
    namespaced: false,
  })

  const listData = data as KubeListResponse | undefined
  const nodes: KubeNode[] = (listData?.items ?? []) as KubeNode[]

  const allRoles = useMemo(() => {
    const roleSet = new Set<string>()
    for (const node of nodes) {
      for (const role of getNodeRoles(node)) {
        roleSet.add(role)
      }
    }
    return [...roleSet].sort()
  }, [nodes])

  const allStatuses = useMemo(() => {
    const statusSet = new Set<string>()
    for (const node of nodes) {
      statusSet.add(getNodeStatus(node))
    }
    return [...statusSet].sort()
  }, [nodes])

  const filteredNodes = useMemo(() => {
    return nodes
      .filter((node) => {
        if (roleFilter === 'All') return true
        return getNodeRoles(node).includes(roleFilter)
      })
      .filter((node) => {
        if (statusFilter === 'All') return true
        return getNodeStatus(node) === statusFilter
      })
  }, [nodes, roleFilter, statusFilter])

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <Breadcrumb items={[{ label: 'Cluster', href: '/' }, { label: 'Nodes' }]} />
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

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 bg-surface-light dark:bg-slate-800 border border-border-light dark:border-border-dark rounded-lg text-sm font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none"
        >
          <option value="All">All Roles</option>
          {allRoles.map((role) => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-surface-light dark:bg-slate-800 border border-border-light dark:border-border-dark rounded-lg text-sm font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none"
        >
          <option value="All">All Statuses</option>
          {allStatuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {!isLoading && (
          <span className="text-sm text-slate-500 dark:text-slate-400 ml-auto">
            {filteredNodes.length} node{filteredNodes.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {!isError && <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Roles</th>
                <th className="px-6 py-4">CPU (Alloc / Capacity)</th>
                <th className="px-6 py-4">Memory (Alloc / Capacity)</th>
                <th className="px-6 py-4">Version</th>
                <th className="px-6 py-4">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <NodeRowSkeleton key={i} />)
              ) : filteredNodes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <span className="material-symbols-outlined text-4xl text-slate-500 dark:text-slate-600 mb-2 block">dns</span>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">No nodes found</p>
                  </td>
                </tr>
              ) : (
                filteredNodes.map((node) => {
                  const status = getNodeStatus(node)
                  const roles = getNodeRoles(node)
                  const version = node.status?.nodeInfo?.kubeletVersion ?? '-'
                  const cpuValues = getCpuValues(node)
                  const memoryValues = getMemoryValues(node)

                  return (
                    <tr key={node.metadata.name} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            <span className="material-symbols-outlined text-[20px]">dns</span>
                          </div>
                          <Link
                            to="/nodes/$name"
                            params={{ name: node.metadata.name }}
                            className="font-medium text-slate-900 dark:text-white hover:text-primary transition-colors"
                          >
                            {node.metadata.name}
                          </Link>
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
                      <td className="px-6 py-4">
                        <ResourceBar values={cpuValues} icon="memory" />
                      </td>
                      <td className="px-6 py-4">
                        <ResourceBar values={memoryValues} icon="storage" />
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
