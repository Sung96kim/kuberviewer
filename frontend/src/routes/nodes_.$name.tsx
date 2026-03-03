import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useResource } from '#/hooks/use-resource'
import { useResourceList } from '#/hooks/use-resource-list'
import { useNodeMetricsByName } from '#/hooks/use-metrics'
import { relativeTime } from '#/lib/time'
import { parseCpuToCores, parseMemoryToBytes, formatCpu, formatMemory, getUsageBarColor, getAllocatableBarColor } from '#/lib/resource-units'
import { Skeleton } from '#/components/ui/skeleton'
import { Breadcrumb } from '#/components/layout/Breadcrumb'
import { ResourceYAMLEditor } from '#/components/resources/ResourceYAMLEditor'

export const Route = createFileRoute('/nodes_/$name')({ component: NodeDetailPage })

type KubeNode = {
  metadata: {
    name: string
    creationTimestamp: string
    labels?: Record<string, string>
    uid?: string
    resourceVersion?: string
  }
  status: {
    conditions?: Array<{
      type: string
      status: string
      reason?: string
      message?: string
      lastTransitionTime?: string
    }>
    nodeInfo?: {
      kubeletVersion: string
      kubeProxyVersion: string
      osImage: string
      architecture: string
      containerRuntimeVersion: string
      operatingSystem: string
      kernelVersion: string
      machineID: string
      bootID: string
    }
    capacity?: Record<string, string>
    allocatable?: Record<string, string>
    addresses?: Array<{ type: string; address: string }>
  }
}

type KubePod = {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
  }
  status: {
    phase: string
  }
}

type KubeListResponse = {
  items?: KubePod[]
}

type TabId = 'overview' | 'yaml'

type ResourceBarData = {
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

function ConditionBadge({ status }: { status: string }) {
  const isTrue = status === 'True'
  const bgClass = isTrue ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${bgClass}`}>
      {status}
    </span>
  )
}

function ResourceProgressBar({ label, icon, values }: { label: string; icon: string; values: ResourceBarData | null }) {
  if (!values) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">{label}</span>
          <span className="text-slate-400">-</span>
        </div>
      </div>
    )
  }

  const color = values.mode === 'usage' ? getUsageBarColor(values.percentage) : getAllocatableBarColor(values.percentage)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className={`material-symbols-outlined text-[18px] ${color.text}`}>{icon}</span>
          <span className="text-slate-700 dark:text-slate-200 font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${color.text}`}>{values.percentage}%</span>
          <span className="text-slate-500 dark:text-slate-400 text-xs">
            {values.usedDisplay} / {values.totalDisplay}
          </span>
        </div>
      </div>
      <div className={`h-2.5 rounded-full ${color.bg} overflow-hidden`}>
        <div
          className={`h-full rounded-full ${color.bar} transition-all duration-500`}
          style={{ width: `${Math.min(values.percentage, 100)}%` }}
        />
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start py-3 border-b border-border-light dark:border-border-dark last:border-b-0">
      <span className="text-sm text-slate-500 dark:text-slate-400 shrink-0">{label}</span>
      <span className="text-sm font-medium text-slate-900 dark:text-white text-right ml-4 break-all font-mono">{value}</span>
    </div>
  )
}

function NodeDetailSkeleton() {
  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <Skeleton className="h-4 w-64 mb-4" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl lg:col-span-2" />
      </div>
    </div>
  )
}

function NodeDetailPage() {
  const { name } = Route.useParams()
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  const { data: nodeData, isLoading: nodeLoading, error: nodeError } = useResource({
    group: '',
    version: 'v1',
    name: 'nodes',
    namespaced: false,
    resourceName: name,
  })

  const { data: podsData, isLoading: podsLoading } = useResourceList({
    group: '',
    version: 'v1',
    name: 'pods',
    namespaced: true,
    fieldSelector: `spec.nodeName=${name}`,
  })
  const { data: metricsData } = useNodeMetricsByName(name)

  const node = nodeData as KubeNode | undefined
  const podsList = podsData as KubeListResponse | undefined
  const pods: KubePod[] = (podsList?.items ?? []) as KubePod[]

  if (nodeError) {
    return (
      <div className="max-w-[1600px] mx-auto">
        <Breadcrumb items={[{ label: 'Cluster', href: '/' }, { label: 'Nodes', href: '/nodes' }, { label: name }]} />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <span className="material-symbols-outlined text-5xl text-red-500 mb-4 block">error</span>
            <h2 className="text-xl font-bold mb-2">Failed to Load Node</h2>
            <p className="text-slate-500 dark:text-slate-400">{(nodeError as Error).message}</p>
          </div>
        </div>
      </div>
    )
  }

  if (nodeLoading || !node) {
    return <NodeDetailSkeleton />
  }

  const status = getNodeStatus(node)
  const conditions = node.status?.conditions ?? []
  const nodeInfo = node.status?.nodeInfo
  const addresses = node.status?.addresses ?? []
  const internalIP = addresses.find((a) => a.type === 'InternalIP')?.address ?? '-'
  const metricsUsage = metricsData?.available ? metricsData.usage : undefined
  const hasMetrics = !!metricsUsage

  let cpuValues: ResourceBarData | null = null
  const cpuCapacityRaw = node.status?.capacity?.cpu
  if (cpuCapacityRaw) {
    const capacityCores = parseCpuToCores(cpuCapacityRaw)
    if (metricsUsage) {
      const usedCores = parseCpuToCores(metricsUsage.cpu)
      const pct = capacityCores > 0 ? Math.round((usedCores / capacityCores) * 100) : 0
      cpuValues = { percentage: pct, usedDisplay: formatCpu(usedCores * 1000), totalDisplay: `${capacityCores} Cores`, mode: 'usage' }
    } else {
      const allocRaw = node.status?.allocatable?.cpu
      if (allocRaw) {
        const allocCores = parseCpuToCores(allocRaw)
        const pct = capacityCores > 0 ? Math.round((allocCores / capacityCores) * 100) : 0
        cpuValues = { percentage: pct, usedDisplay: `${allocCores.toFixed(1)}`, totalDisplay: `${capacityCores} Cores`, mode: 'allocatable' }
      }
    }
  }

  let memoryValues: ResourceBarData | null = null
  const memCapacityRaw = node.status?.capacity?.memory
  if (memCapacityRaw) {
    const capacityBytes = parseMemoryToBytes(memCapacityRaw)
    if (metricsUsage) {
      const usedBytes = parseMemoryToBytes(metricsUsage.memory)
      const pct = capacityBytes > 0 ? Math.round((usedBytes / capacityBytes) * 100) : 0
      memoryValues = { percentage: pct, usedDisplay: formatMemory(usedBytes), totalDisplay: formatMemory(capacityBytes), mode: 'usage' }
    } else {
      const allocRaw = node.status?.allocatable?.memory
      if (allocRaw) {
        const allocBytes = parseMemoryToBytes(allocRaw)
        const pct = capacityBytes > 0 ? Math.round((allocBytes / capacityBytes) * 100) : 0
        memoryValues = { percentage: pct, usedDisplay: formatMemory(allocBytes), totalDisplay: formatMemory(capacityBytes), mode: 'allocatable' }
      }
    }
  }

  let ephemeralValues: ResourceBarData | null = null
  const ephemeralCapacityRaw = node.status?.capacity?.['ephemeral-storage']
  const ephemeralAllocatableRaw = node.status?.allocatable?.['ephemeral-storage']
  if (ephemeralCapacityRaw && ephemeralAllocatableRaw) {
    const capacity = parseMemoryToBytes(ephemeralCapacityRaw)
    const allocatable = parseMemoryToBytes(ephemeralAllocatableRaw)
    const percentage = capacity > 0 ? Math.round((allocatable / capacity) * 100) : 0
    ephemeralValues = { percentage, usedDisplay: formatMemory(allocatable), totalDisplay: formatMemory(capacity), mode: 'allocatable' }
  }

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'yaml', label: 'YAML' },
  ]

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <Breadcrumb items={[{ label: 'Cluster', href: '/' }, { label: 'Nodes', href: '/nodes' }, { label: name }]} />

      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold">{node.metadata.name}</h1>
          <StatusBadge status={status} />
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">schedule</span>
            Age: <span className="text-slate-700 dark:text-slate-300">{relativeTime(node.metadata.creationTimestamp)}</span>
          </span>
          {internalIP !== '-' && (
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">lan</span>
              IP: <span className="text-slate-700 dark:text-slate-300 font-mono text-xs">{internalIP}</span>
            </span>
          )}
        </div>
      </div>

      <div className="border-b border-border-light dark:border-border-dark">
        <nav className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
              <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-primary">bar_chart</span>
                  {hasMetrics ? 'Resource Usage' : 'Allocated Resources'}
                </h3>
              </div>
              <div className="p-6 space-y-5">
                <ResourceProgressBar label={hasMetrics ? 'CPU Usage' : 'CPU Allocatable'} icon="memory" values={cpuValues} />
                <ResourceProgressBar label={hasMetrics ? 'Memory Usage' : 'Memory Allocatable'} icon="storage" values={memoryValues} />
                <ResourceProgressBar label="Ephemeral Storage" icon="hard_drive" values={ephemeralValues} />
              </div>
            </div>

            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
              <div className="px-6 py-4 border-b border-border-light dark:border-border-dark flex items-center justify-between">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-primary">deployed_code</span>
                  Scheduled Pods
                </h3>
                {!podsLoading && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {pods.length} pod{pods.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                    <tr>
                      <th className="px-6 py-3">Pod Name</th>
                      <th className="px-6 py-3">Namespace</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Age</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light dark:divide-border-dark">
                    {podsLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          <td className="px-6 py-3"><Skeleton className="h-4 w-48" /></td>
                          <td className="px-6 py-3"><Skeleton className="h-4 w-24" /></td>
                          <td className="px-6 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                          <td className="px-6 py-3"><Skeleton className="h-4 w-16" /></td>
                        </tr>
                      ))
                    ) : pods.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                          No pods scheduled on this node
                        </td>
                      </tr>
                    ) : (
                      pods.slice(0, 20).map((pod) => {
                        const phase = pod.status?.phase ?? 'Unknown'
                        const phaseColor: Record<string, string> = {
                          Running: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
                          Succeeded: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
                          Pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
                          Failed: 'bg-red-500/10 text-red-400 border-red-500/20',
                        }
                        const phaseClasses = phaseColor[phase] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20'

                        return (
                          <tr key={`${pod.metadata.namespace}/${pod.metadata.name}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-3">
                              <Link
                                to="/resources/$"
                                params={{ _splat: `v1/pods/${pod.metadata.namespace}/${pod.metadata.name}` }}
                                className="font-medium text-primary hover:underline"
                              >
                                {pod.metadata.name}
                              </Link>
                            </td>
                            <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{pod.metadata.namespace}</td>
                            <td className="px-6 py-3">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${phaseClasses}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                {phase}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{relativeTime(pod.metadata.creationTimestamp)}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
                {pods.length > 20 && (
                  <div className="px-6 py-3 border-t border-border-light dark:border-border-dark text-center">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      Showing 20 of {pods.length} pods
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
              <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-primary">monitor_heart</span>
                  Node Conditions
                </h3>
              </div>
              <div className="divide-y divide-border-light dark:divide-border-dark">
                {conditions.length === 0 ? (
                  <div className="px-6 py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                    No conditions reported
                  </div>
                ) : (
                  conditions.map((condition) => {
                    const isTrue = condition.status === 'True'
                    const isHealthy = condition.type === 'Ready' ? isTrue : !isTrue
                    const iconBg = isHealthy
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'bg-red-500/10 text-red-500'
                    const icon = isHealthy ? 'check_circle' : 'warning'

                    return (
                      <div key={condition.type} className="px-6 py-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded ${iconBg}`}>
                            <span className="material-symbols-outlined text-[18px]">{icon}</span>
                          </div>
                          <span className="text-sm font-medium">{condition.type}</span>
                        </div>
                        <ConditionBadge status={condition.status} />
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
              <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-primary">info</span>
                  System Info
                </h3>
              </div>
              <div className="px-6">
                <InfoRow label="Architecture" value={nodeInfo?.architecture ?? '-'} />
                <InfoRow label="OS" value={nodeInfo?.operatingSystem ?? '-'} />
                <InfoRow label="OS Image" value={nodeInfo?.osImage ?? '-'} />
                <InfoRow label="Kernel" value={nodeInfo?.kernelVersion ?? '-'} />
                <InfoRow label="Container Runtime" value={nodeInfo?.containerRuntimeVersion ?? '-'} />
                <InfoRow label="Kubelet Version" value={nodeInfo?.kubeletVersion ?? '-'} />
                <InfoRow label="Kube-Proxy Version" value={nodeInfo?.kubeProxyVersion ?? '-'} />
                <InfoRow label="Internal IP" value={internalIP} />
                <InfoRow label="Machine ID" value={nodeInfo?.machineID ?? '-'} />
                <InfoRow label="Boot ID" value={nodeInfo?.bootID ?? '-'} />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'yaml' && (
        <ResourceYAMLEditor
          resource={nodeData as Record<string, unknown>}
          group=""
          version="v1"
          resourceType="nodes"
          namespaced={false}
        />
      )}
    </div>
  )
}
