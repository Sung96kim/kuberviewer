import { useState, useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useResourceList } from '#/hooks/use-resource-list'
import { useNodeMetrics } from '#/hooks/use-metrics'
import { relativeTime } from '#/lib/time'
import { parseCpuToCores, parseMemoryToBytes, formatCpu, formatMemory, getUsageBarColor, getAllocatableBarColor } from '#/lib/resource-units'
import { Skeleton } from '#/components/ui/skeleton'
import { RefetchIndicator } from '#/components/ui/refetch-indicator'
import { PollingSettings } from '#/components/ui/polling-settings'
import { QueryError } from '#/components/QueryError'
import { Breadcrumb } from '#/components/layout/Breadcrumb'
import type { NodeMetricItem } from '#/api'

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

type ResourceBarData = {
  used: number
  total: number
  percentage: number
  usedDisplay: string
  totalDisplay: string
  mode: 'usage' | 'allocatable'
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

function getCpuBar(node: KubeNode, metricsUsage: { cpu: string; memory: string } | undefined): ResourceBarData | null {
  const capacityRaw = node.status?.capacity?.cpu
  if (!capacityRaw) return null
  const capacityCores = parseCpuToCores(capacityRaw)

  if (metricsUsage) {
    const usedCores = parseCpuToCores(metricsUsage.cpu)
    const percentage = capacityCores > 0 ? Math.round((usedCores / capacityCores) * 100) : 0
    return {
      used: usedCores,
      total: capacityCores,
      percentage,
      usedDisplay: formatCpu(usedCores * 1000),
      totalDisplay: `${capacityCores} Cores`,
      mode: 'usage',
    }
  }

  const allocatableRaw = node.status?.allocatable?.cpu
  if (!allocatableRaw) return null
  const allocatableCores = parseCpuToCores(allocatableRaw)
  const percentage = capacityCores > 0 ? Math.round((allocatableCores / capacityCores) * 100) : 0
  return {
    used: allocatableCores,
    total: capacityCores,
    percentage,
    usedDisplay: `${allocatableCores.toFixed(1)}`,
    totalDisplay: `${capacityCores} Cores`,
    mode: 'allocatable',
  }
}

function getMemoryBar(node: KubeNode, metricsUsage: { cpu: string; memory: string } | undefined): ResourceBarData | null {
  const capacityRaw = node.status?.capacity?.memory
  if (!capacityRaw) return null
  const capacityBytes = parseMemoryToBytes(capacityRaw)

  if (metricsUsage) {
    const usedBytes = parseMemoryToBytes(metricsUsage.memory)
    const percentage = capacityBytes > 0 ? Math.round((usedBytes / capacityBytes) * 100) : 0
    return {
      used: usedBytes,
      total: capacityBytes,
      percentage,
      usedDisplay: formatMemory(usedBytes),
      totalDisplay: formatMemory(capacityBytes),
      mode: 'usage',
    }
  }

  const allocatableRaw = node.status?.allocatable?.memory
  if (!allocatableRaw) return null
  const allocatableBytes = parseMemoryToBytes(allocatableRaw)
  const percentage = capacityBytes > 0 ? Math.round((allocatableBytes / capacityBytes) * 100) : 0
  return {
    used: allocatableBytes,
    total: capacityBytes,
    percentage,
    usedDisplay: formatMemory(allocatableBytes),
    totalDisplay: formatMemory(capacityBytes),
    mode: 'allocatable',
  }
}

function ResourceBar({ values, icon }: { values: ResourceBarData | null; icon: string }) {
  if (!values) {
    return <span className="text-xs text-slate-400">-</span>
  }

  const color = values.mode === 'usage' ? getUsageBarColor(values.percentage) : getAllocatableBarColor(values.percentage)

  return (
    <div className="min-w-[180px] space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className={`material-symbols-outlined text-[14px] ${color.text}`}>{icon}</span>
          <span className={`font-semibold ${color.text}`}>{values.percentage}%</span>
        </div>
        <span className="text-slate-500 dark:text-slate-400">
          {values.usedDisplay} / {values.totalDisplay}
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
  const { data, isLoading, isError, error, isFetching } = useResourceList({
    group: '',
    version: 'v1',
    name: 'nodes',
    namespaced: false,
  })
  const { data: metricsData, isFetching: metricsFetching } = useNodeMetrics()

  const listData = data as KubeListResponse | undefined
  const nodes: KubeNode[] = (listData?.items ?? []) as KubeNode[]

  const metricsMap = useMemo(() => {
    const map = new Map<string, NodeMetricItem['usage']>()
    if (metricsData?.available && metricsData.items) {
      for (const item of metricsData.items) {
        map.set(item.metadata.name, item.usage)
      }
    }
    return map
  }, [metricsData])

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
        <PollingSettings />
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
          <span className="text-sm text-slate-500 dark:text-slate-400 ml-auto flex items-center gap-1.5">
            <RefetchIndicator fetching={isFetching || metricsFetching} />
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
                <th className="px-6 py-4">{metricsData?.available ? 'CPU (Usage / Capacity)' : 'CPU (Alloc / Capacity)'}</th>
                <th className="px-6 py-4">{metricsData?.available ? 'Memory (Usage / Capacity)' : 'Memory (Alloc / Capacity)'}</th>
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
                  const nodeUsage = metricsMap.get(node.metadata.name)
                  const cpuValues = getCpuBar(node, nodeUsage)
                  const memoryValues = getMemoryBar(node, nodeUsage)

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
