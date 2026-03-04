import { useState, useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useResource } from '#/hooks/use-resource'
import { useResourceList } from '#/hooks/use-resource-list'
import { usePodMetrics } from '#/hooks/use-metrics'
import { relativeTime } from '#/lib/time'
import { parseCpuToMillicores, parseMemoryToBytes, formatCpu, formatMemory, getUsageBarColor } from '#/lib/resource-units'
import { Skeleton } from '#/components/ui/skeleton'
import { RefetchIndicator } from '#/components/ui/refetch-indicator'
import { PollingSettings } from '#/components/ui/polling-settings'
import { Breadcrumb } from '#/components/layout/Breadcrumb'

export const Route = createFileRoute('/namespaces_/$name')({ component: NamespaceDetailPage })

type KubeNamespace = {
  metadata: {
    name: string
    creationTimestamp: string
    labels?: Record<string, string>
    uid?: string
    resourceVersion?: string
  }
  status: {
    phase: string
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
    containerStatuses?: Array<{ state?: { waiting?: { reason?: string } } }>
  }
}

type KubeDeployment = {
  metadata: {
    name: string
    namespace: string
  }
  status: {
    replicas?: number
    readyReplicas?: number
  }
}

type KubeService = {
  metadata: {
    name: string
    namespace: string
  }
}

type KubeReplicaSet = {
  metadata: {
    name: string
    namespace: string
  }
  status: {
    replicas?: number
    readyReplicas?: number
  }
}

type KubeResourceQuota = {
  metadata: {
    name: string
    namespace: string
  }
  status: {
    hard?: Record<string, string>
    used?: Record<string, string>
  }
}

type KubeEvent = {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
  }
  type: string
  reason: string
  message: string
  involvedObject?: {
    kind: string
    name: string
    namespace?: string
  }
}

type KubeListResponse<T> = {
  items?: T[]
}

type EventFilter = 'All' | 'Warning' | 'Normal'

function formatCpuCores(cores: number): string {
  return formatCpu(cores * 1000)
}

function getResourceLinkPath(kind: string, name: string, namespace?: string): string {
  const kindMap: Record<string, { group: string; version: string; resource: string }> = {
    Pod: { group: '', version: 'v1', resource: 'pods' },
    Deployment: { group: 'apps', version: 'v1', resource: 'deployments' },
    ReplicaSet: { group: 'apps', version: 'v1', resource: 'replicasets' },
    Service: { group: '', version: 'v1', resource: 'services' },
    ConfigMap: { group: '', version: 'v1', resource: 'configmaps' },
    Secret: { group: '', version: 'v1', resource: 'secrets' },
    StatefulSet: { group: 'apps', version: 'v1', resource: 'statefulsets' },
    DaemonSet: { group: 'apps', version: 'v1', resource: 'daemonsets' },
    Job: { group: 'batch', version: 'v1', resource: 'jobs' },
    CronJob: { group: 'batch', version: 'v1', resource: 'cronjobs' },
  }

  const mapping = kindMap[kind]
  if (!mapping) return ''

  const groupVersion = mapping.group ? `${mapping.group}/${mapping.version}` : mapping.version
  return namespace
    ? `${groupVersion}/${mapping.resource}/${namespace}/${name}`
    : `${groupVersion}/${mapping.resource}/${name}`
}

function StatusBadge({ phase }: { phase: string }) {
  const isActive = phase === 'Active'
  const bgClass = isActive ? 'bg-emerald-500/10' : 'bg-yellow-500/10'
  const textClass = isActive ? 'text-emerald-500' : 'text-yellow-500'
  const borderClass = isActive ? 'border-emerald-500/20' : 'border-yellow-500/20'
  const dotClass = isActive ? 'bg-emerald-500 animate-pulse' : 'bg-yellow-500'

  return (
    <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full ${bgClass} ${textClass} border ${borderClass}`}>
      <div className={`size-1.5 rounded-full ${dotClass}`} />
      <span className="text-xs font-semibold">{phase}</span>
    </div>
  )
}

function StatCard({ icon, iconColor, iconBg, hoverBorderColor, title, mainValue, subValue, badge, to, namespace, isFetching }: {
  icon: string
  iconColor: string
  iconBg: string
  hoverBorderColor: string
  title: string
  mainValue: string
  subValue?: string
  badge?: { label: string; color: string }
  to?: string
  namespace?: string
  isFetching?: boolean
}) {
  const classes = `block bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-5 ${hoverBorderColor} hover:-translate-y-1 hover:shadow-lg transition-all duration-200 cursor-pointer`

  const content = (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className={`size-10 rounded-lg ${iconBg} flex items-center justify-center ${iconColor}`}>
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <RefetchIndicator fetching={isFetching ?? false} />
          {badge && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
              {badge.label}
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1">{title}</p>
      <p className="text-2xl font-bold">{mainValue}</p>
      {subValue && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subValue}</p>
      )}
    </>
  )

  if (to) {
    return (
      <Link
        to="/resources/$"
        params={{ _splat: to }}
        search={namespace ? { ns: namespace } : {}}
        className={classes}
      >
        {content}
      </Link>
    )
  }
  return <div className={classes}>{content}</div>
}

function QuotaProgressBar({ label, icon, usedValue: used, limitValue: limit, formatFn }: {
  label: string
  icon: string
  usedValue: number
  limitValue: number
  formatFn: (value: number) => string
}) {
  const percentage = limit > 0 ? Math.round((used / limit) * 100) : 0
  const color = getUsageBarColor(percentage)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className={`material-symbols-outlined text-[18px] ${color.text}`}>{icon}</span>
          <span className="text-slate-700 dark:text-slate-200 font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${color.text}`}>{percentage}%</span>
          <span className="text-slate-500 dark:text-slate-400 text-xs">
            {formatFn(used)} / {formatFn(limit)}
          </span>
        </div>
      </div>
      <div className={`h-2.5 rounded-full ${color.bg} overflow-hidden`}>
        <div
          className={`h-full rounded-full ${color.bar} transition-all duration-500`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  )
}

function EventTypeBadge({ type }: { type: string }) {
  const isWarning = type === 'Warning'
  const classes = isWarning
    ? 'bg-red-500/10 text-red-400 border-red-500/20'
    : 'bg-slate-500/10 text-slate-400 border-slate-500/20'

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${classes}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {type}
    </span>
  )
}

function NamespaceDetailSkeleton() {
  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <Skeleton className="h-4 w-64 mb-4" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

function NamespaceDetailPage() {
  const { name } = Route.useParams()
  const [eventFilter, setEventFilter] = useState<EventFilter>('All')

  const { data: nsData, isLoading: nsLoading, error: nsError } = useResource({
    group: '',
    version: 'v1',
    name: 'namespaces',
    namespaced: false,
    resourceName: name,
  })

  const { data: podsData, isLoading: podsLoading, isFetching: podsFetching } = useResourceList({
    group: '',
    version: 'v1',
    name: 'pods',
    namespaced: true,
    namespace: name,
  })

  const { data: deploymentsData, isLoading: deploymentsLoading, isFetching: deploymentsFetching } = useResourceList({
    group: 'apps',
    version: 'v1',
    name: 'deployments',
    namespaced: true,
    namespace: name,
  })

  const { data: servicesData, isLoading: servicesLoading, isFetching: servicesFetching } = useResourceList({
    group: '',
    version: 'v1',
    name: 'services',
    namespaced: true,
    namespace: name,
  })

  const { data: replicasetsData, isLoading: replicasetsLoading, isFetching: replicasetsFetching } = useResourceList({
    group: 'apps',
    version: 'v1',
    name: 'replicasets',
    namespaced: true,
    namespace: name,
  })

  const { data: quotasData, isLoading: quotasLoading, isFetching: quotasFetching } = useResourceList({
    group: '',
    version: 'v1',
    name: 'resourcequotas',
    namespaced: true,
    namespace: name,
  })

  const { data: eventsData, isLoading: eventsLoading, isFetching: eventsFetching } = useResourceList({
    group: '',
    version: 'v1',
    name: 'events',
    namespaced: true,
    namespace: name,
  })

  const { data: podMetricsData, isFetching: metricsFetching } = usePodMetrics(name)

  const namespace = nsData as KubeNamespace | undefined
  const pods = ((podsData as KubeListResponse<KubePod>)?.items ?? []) as KubePod[]
  const deployments = ((deploymentsData as KubeListResponse<KubeDeployment>)?.items ?? []) as KubeDeployment[]
  const services = ((servicesData as KubeListResponse<KubeService>)?.items ?? []) as KubeService[]
  const replicasets = ((replicasetsData as KubeListResponse<KubeReplicaSet>)?.items ?? []) as KubeReplicaSet[]
  const quotas = ((quotasData as KubeListResponse<KubeResourceQuota>)?.items ?? []) as KubeResourceQuota[]
  const events = ((eventsData as KubeListResponse<KubeEvent>)?.items ?? []) as KubeEvent[]

  const runningPods = pods.filter((p) => p.status?.phase === 'Running').length
  const problemReasons = new Set(['CrashLoopBackOff', 'ImagePullBackOff', 'ErrImagePull', 'CreateContainerConfigError', 'OOMKilled'])
  const issuePods = pods.filter((p) =>
    (p.status?.containerStatuses ?? []).some((cs) => {
      const reason = cs.state?.waiting?.reason ?? ''
      return problemReasons.has(reason)
    })
  ).length
  const readyDeployments = deployments.filter((d) => (d.status?.readyReplicas ?? 0) >= (d.status?.replicas ?? 0) && (d.status?.replicas ?? 0) > 0).length
  const readyReplicasets = replicasets.filter((r) => (r.status?.readyReplicas ?? 0) >= (r.status?.replicas ?? 0) && (r.status?.replicas ?? 0) > 0).length
  const allPodsHealthy = pods.length > 0 && runningPods === pods.length && issuePods === 0
  const allDeploymentsReady = deployments.length > 0 && readyDeployments === deployments.length

  const aggregatedCpu = quotas.reduce<{ used: number; hard: number }>((acc, q) => {
    const usedRaw = q.status?.used?.['requests.cpu'] ?? q.status?.used?.['cpu']
    const hardRaw = q.status?.hard?.['requests.cpu'] ?? q.status?.hard?.['cpu']
    if (usedRaw) acc.used += parseCpuToMillicores(usedRaw) / 1000
    if (hardRaw) acc.hard += parseCpuToMillicores(hardRaw) / 1000
    return acc
  }, { used: 0, hard: 0 })

  const aggregatedMemory = quotas.reduce<{ used: number; hard: number }>((acc, q) => {
    const usedRaw = q.status?.used?.['requests.memory'] ?? q.status?.used?.['memory']
    const hardRaw = q.status?.hard?.['requests.memory'] ?? q.status?.hard?.['memory']
    if (usedRaw) acc.used += parseMemoryToBytes(usedRaw)
    if (hardRaw) acc.hard += parseMemoryToBytes(hardRaw)
    return acc
  }, { used: 0, hard: 0 })

  const hasQuotas = quotas.length > 0 && (aggregatedCpu.hard > 0 || aggregatedMemory.hard > 0)

  const actualUsage = useMemo(() => {
    if (!podMetricsData?.available || !podMetricsData.items) return null
    let cpuMillicores = 0
    let memBytes = 0
    for (const pod of podMetricsData.items) {
      for (const container of pod.containers) {
        cpuMillicores += parseCpuToMillicores(container.usage.cpu)
        memBytes += parseMemoryToBytes(container.usage.memory)
      }
    }
    return { cpuMillicores, memBytes }
  }, [podMetricsData])

  const sortedEvents = [...events].sort((a, b) =>
    new Date(b.metadata.creationTimestamp).getTime() - new Date(a.metadata.creationTimestamp).getTime()
  )
  const filteredEvents = eventFilter === 'All'
    ? sortedEvents
    : sortedEvents.filter((e) => e.type === eventFilter)
  const displayEvents = filteredEvents.slice(0, 10)

  if (nsError) {
    return (
      <div className="max-w-[1600px] mx-auto">
        <Breadcrumb items={[{ label: 'Cluster', href: '/' }, { label: 'Namespaces', href: '/namespaces' }, { label: name }]} />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <span className="material-symbols-outlined text-5xl text-red-500 mb-4 block">error</span>
            <h2 className="text-xl font-bold mb-2">Failed to Load Namespace</h2>
            <p className="text-slate-500 dark:text-slate-400">{(nsError as Error).message}</p>
          </div>
        </div>
      </div>
    )
  }

  if (nsLoading || !namespace) {
    return <NamespaceDetailSkeleton />
  }

  const phase = namespace.status?.phase ?? 'Unknown'
  const labels = Object.entries(namespace.metadata.labels ?? {})

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <Breadcrumb items={[{ label: 'Cluster', href: '/' }, { label: 'Namespaces', href: '/namespaces' }, { label: name }]} />

      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold">{namespace.metadata.name}</h1>
          <StatusBadge phase={phase} />
          <div className="ml-auto"><PollingSettings /></div>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mb-3">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">schedule</span>
            Age: <span className="text-slate-700 dark:text-slate-300">{relativeTime(namespace.metadata.creationTimestamp)}</span>
          </span>
        </div>
        {labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {labels.map(([k, v]) => (
              <span
                key={k}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-surface-highlight text-slate-500 dark:text-slate-400 border border-border-light dark:border-border-dark"
              >
                {k}={v}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon="deployed_code"
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10"
          hoverBorderColor="hover:border-blue-500/40 hover:shadow-blue-500/10"
          title="Pods"
          mainValue={podsLoading ? '-' : `${runningPods} / ${pods.length}`}
          subValue={podsLoading ? undefined : issuePods > 0 ? `${issuePods} with issues` : `${runningPods} running`}
          badge={!podsLoading && allPodsHealthy ? { label: 'Healthy', color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' } : !podsLoading && issuePods > 0 ? { label: `${issuePods} Issues`, color: 'bg-red-500/10 text-red-400 border border-red-500/20' } : undefined}
          to="v1/pods"
          namespace={name}
          isFetching={podsFetching}
        />
        <StatCard
          icon="rocket_launch"
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
          hoverBorderColor="hover:border-emerald-500/40 hover:shadow-emerald-500/10"
          title="Deployments"
          mainValue={deploymentsLoading ? '-' : `${readyDeployments} / ${deployments.length}`}
          subValue={deploymentsLoading ? undefined : `${readyDeployments} ready`}
          badge={!deploymentsLoading && allDeploymentsReady ? { label: 'All Ready', color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' } : undefined}
          to="apps/v1/deployments"
          namespace={name}
          isFetching={deploymentsFetching}
        />
        <StatCard
          icon="dns"
          iconColor="text-purple-400"
          iconBg="bg-purple-500/10"
          hoverBorderColor="hover:border-purple-500/40 hover:shadow-purple-500/10"
          title="Services"
          mainValue={servicesLoading ? '-' : `${services.length}`}
          subValue={servicesLoading ? undefined : 'Active'}
          to="v1/services"
          namespace={name}
          isFetching={servicesFetching}
        />
        <StatCard
          icon="content_copy"
          iconColor="text-orange-400"
          iconBg="bg-orange-500/10"
          hoverBorderColor="hover:border-orange-500/40 hover:shadow-orange-500/10"
          title="ReplicaSets"
          mainValue={replicasetsLoading ? '-' : `${readyReplicasets} / ${replicasets.length}`}
          subValue={replicasetsLoading ? undefined : `${readyReplicasets} ready`}
          to="apps/v1/replicasets"
          namespace={name}
          isFetching={replicasetsFetching}
        />
      </div>

      {actualUsage && (
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
          <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
            <h3 className="text-base font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">monitoring</span>
              Actual Usage
              <RefetchIndicator fetching={metricsFetching} />
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-[18px] text-blue-400">memory</span>
                  <span className="text-slate-700 dark:text-slate-200 font-medium">CPU Usage</span>
                </div>
                <p className="text-2xl font-bold">{formatCpu(actualUsage.cpuMillicores)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">across {podMetricsData?.items?.length ?? 0} pods</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-[18px] text-purple-400">storage</span>
                  <span className="text-slate-700 dark:text-slate-200 font-medium">Memory Usage</span>
                </div>
                <p className="text-2xl font-bold">{formatMemory(actualUsage.memBytes)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">across {podMetricsData?.items?.length ?? 0} pods</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
        <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
          <h3 className="text-base font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">bar_chart</span>
            Resource Quotas
            <RefetchIndicator fetching={quotasFetching} />
          </h3>
        </div>
        <div className="p-6">
          {quotasLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : hasQuotas ? (
            <div className="space-y-5">
              {aggregatedCpu.hard > 0 && (
                <QuotaProgressBar
                  label="CPU Requests"
                  icon="memory"
                  usedValue={aggregatedCpu.used}
                  limitValue={aggregatedCpu.hard}
                  formatFn={formatCpuCores}
                />
              )}
              {aggregatedMemory.hard > 0 && (
                <QuotaProgressBar
                  label="Memory Requests"
                  icon="storage"
                  usedValue={aggregatedMemory.used}
                  limitValue={aggregatedMemory.hard}
                  formatFn={formatMemory}
                />
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 py-4 text-sm text-slate-500 dark:text-slate-400">
              <span className="material-symbols-outlined text-[20px]">info</span>
              No resource quotas configured for this namespace
            </div>
          )}
        </div>
      </div>

      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
        <div className="px-6 py-4 border-b border-border-light dark:border-border-dark flex items-center justify-between">
          <h3 className="text-base font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">event_note</span>
            Recent Events
            <RefetchIndicator fetching={eventsFetching} />
          </h3>
          <div className="flex items-center gap-3">
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value as EventFilter)}
              className="px-3 py-1.5 bg-surface-light dark:bg-surface-highlight border border-border-light dark:border-border-dark rounded-lg text-xs font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            >
              <option value="All">All Types</option>
              <option value="Warning">Warning</option>
              <option value="Normal">Normal</option>
            </select>
            <Link
              to="/events"
              className="text-xs text-primary hover:underline font-medium"
            >
              View All Events
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-surface-highlight/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
              <tr>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Reason</th>
                <th className="px-6 py-3">Object</th>
                <th className="px-6 py-3">Message</th>
                <th className="px-6 py-3">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {eventsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                    <td className="px-6 py-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-6 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-6 py-3"><Skeleton className="h-4 w-48" /></td>
                    <td className="px-6 py-3"><Skeleton className="h-4 w-16" /></td>
                  </tr>
                ))
              ) : displayEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                    No events found in this namespace
                  </td>
                </tr>
              ) : (
                displayEvents.map((event) => {
                  const objectKind = event.involvedObject?.kind ?? ''
                  const objectName = event.involvedObject?.name ?? ''
                  const objectNamespace = event.involvedObject?.namespace
                  const linkPath = getResourceLinkPath(objectKind, objectName, objectNamespace)

                  return (
                    <tr key={event.metadata.name} className="hover:bg-slate-50 dark:hover:bg-surface-hover/30 transition-colors">
                      <td className="px-6 py-3">
                        <EventTypeBadge type={event.type} />
                      </td>
                      <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">{event.reason}</td>
                      <td className="px-6 py-3">
                        {linkPath ? (
                          <Link
                            to="/resources/$"
                            params={{ _splat: linkPath }}
                            className="text-primary hover:underline font-medium"
                          >
                            {objectKind}/{objectName}
                          </Link>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">{objectKind}/{objectName}</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-slate-500 dark:text-slate-400 max-w-md truncate">
                        {event.message}
                      </td>
                      <td className="px-6 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {relativeTime(event.metadata.creationTimestamp)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          {!eventsLoading && filteredEvents.length > 10 && (
            <div className="px-6 py-3 border-t border-border-light dark:border-border-dark text-center">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Showing 10 of {filteredEvents.length} events
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
