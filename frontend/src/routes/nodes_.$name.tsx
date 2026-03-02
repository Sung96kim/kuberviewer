import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { useResource } from '#/hooks/use-resource'
import { useResourceList } from '#/hooks/use-resource-list'
import { relativeTime } from '#/lib/time'
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

type ResourceValues = {
  allocatable: number
  capacity: number
  percentage: number
  allocatableDisplay: string
  capacityDisplay: string
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

function getNodeStatus(node: KubeNode): string {
  const ready = node.status?.conditions?.find((c) => c.type === 'Ready')
  if (!ready) return 'Unknown'
  return ready.status === 'True' ? 'Ready' : 'NotReady'
}

function getBarColor(percentage: number): { bar: string; bg: string; text: string } {
  if (percentage >= 80) return { bar: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-500' }
  if (percentage >= 50) return { bar: 'bg-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-500' }
  return { bar: 'bg-red-500', bg: 'bg-red-500/10', text: 'text-red-500' }
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

function ResourceProgressBar({ label, icon, values }: { label: string; icon: string; values: ResourceValues | null }) {
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

  const color = getBarColor(values.percentage)

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
            {values.allocatableDisplay} / {values.capacityDisplay}
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
  const cpuValues = getCpuValues(node)
  const memoryValues = getMemoryValues(node)
  const ephemeralCapacityRaw = node.status?.capacity?.['ephemeral-storage']
  const ephemeralAllocatableRaw = node.status?.allocatable?.['ephemeral-storage']
  let ephemeralValues: ResourceValues | null = null
  if (ephemeralCapacityRaw && ephemeralAllocatableRaw) {
    const capacity = parseMemoryBytes(ephemeralCapacityRaw)
    const allocatable = parseMemoryBytes(ephemeralAllocatableRaw)
    const percentage = capacity > 0 ? Math.round((allocatable / capacity) * 100) : 0
    ephemeralValues = {
      allocatable,
      capacity,
      percentage,
      allocatableDisplay: formatMemoryGi(allocatable),
      capacityDisplay: formatMemoryGi(capacity),
    }
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
                  Allocated Resources
                </h3>
              </div>
              <div className="p-6 space-y-5">
                <ResourceProgressBar label="CPU Requests" icon="memory" values={cpuValues} />
                <ResourceProgressBar label="Memory Requests" icon="storage" values={memoryValues} />
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
