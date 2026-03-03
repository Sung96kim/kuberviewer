import { memo, useMemo, useCallback, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '#/api'
import { usePodMetrics } from '#/hooks/use-metrics'
import { relativeTime } from '#/lib/time'
import { parseCpuToMillicores, parseMemoryToBytes, formatCpu, formatMemory, getUsageBarColor } from '#/lib/resource-units'

type DeploymentSpec = {
  replicas?: number
  template?: {
    spec?: {
      containers?: Array<{
        name: string
        resources?: {
          requests?: Record<string, string>
          limits?: Record<string, string>
        }
      }>
    }
  }
}

type DeploymentStatus = {
  replicas?: number
  readyReplicas?: number
  updatedReplicas?: number
  availableReplicas?: number
}

type DeploymentHeaderProps = {
  resource: Record<string, unknown>
  group: string
  version: string
  resourceType: string
  namespaced: boolean
  namespace?: string
  onEditYAML: () => void
}

export const DeploymentHeader = memo(function DeploymentHeader({
  resource,
  group,
  version,
  resourceType,
  namespaced,
  namespace,
  onEditYAML,
}: DeploymentHeaderProps) {
  const queryClient = useQueryClient()
  const metadata = resource.metadata as { name?: string; namespace?: string; creationTimestamp?: string } | undefined
  const spec = resource.spec as DeploymentSpec | undefined
  const status = resource.status as DeploymentStatus | undefined
  const apiVersion = resource.apiVersion as string | undefined

  const desiredReplicas = spec?.replicas ?? 1
  const readyReplicas = status?.readyReplicas ?? 0
  const availableReplicas = status?.availableReplicas ?? 0

  const [replicaCount, setReplicaCount] = useState(desiredReplicas)

  const scaleMutation = useMutation({
    mutationFn: async (replicas: number) => {
      return api.patchResource({
        group,
        version,
        name: resourceType,
        namespaced,
        namespace,
        resourceName: metadata?.name,
        body: { spec: { replicas } },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource'] })
    },
  })

  const restartMutation = useMutation({
    mutationFn: async () => {
      return api.patchResource({
        group,
        version,
        name: resourceType,
        namespaced,
        namespace,
        resourceName: metadata?.name,
        body: {
          spec: {
            template: {
              metadata: {
                annotations: {
                  'kubectl.kubernetes.io/restartedAt': new Date().toISOString(),
                },
              },
            },
          },
        },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource'] })
    },
  })

  const handleScale = useCallback((delta: number) => {
    const next = Math.max(0, replicaCount + delta)
    setReplicaCount(next)
    scaleMutation.mutate(next)
  }, [replicaCount, scaleMutation])

  const { data: podMetricsData } = usePodMetrics(namespace)

  const containerResources = useMemo(() => {
    const containers = spec?.template?.spec?.containers ?? []
    let cpuLimitMillicores = 0
    let memLimitBytes = 0
    let cpuRequestDisplay = ''
    let cpuLimitDisplay = ''
    let memRequestDisplay = ''
    let memLimitDisplay = ''

    for (const c of containers) {
      if (c.resources?.requests?.cpu) cpuRequestDisplay = c.resources.requests.cpu
      if (c.resources?.limits?.cpu) {
        cpuLimitDisplay = c.resources.limits.cpu
        cpuLimitMillicores += parseCpuToMillicores(c.resources.limits.cpu)
      }
      if (c.resources?.requests?.memory) memRequestDisplay = c.resources.requests.memory
      if (c.resources?.limits?.memory) {
        memLimitDisplay = c.resources.limits.memory
        memLimitBytes += parseMemoryToBytes(c.resources.limits.memory)
      }
    }

    return { cpuRequestDisplay, cpuLimitDisplay, memRequestDisplay, memLimitDisplay, cpuLimitMillicores, memLimitBytes }
  }, [spec])

  const actualUsage = useMemo(() => {
    if (!podMetricsData?.available || !podMetricsData.items || !metadata?.name) return null
    const deploymentName = metadata.name
    const matchingPods = podMetricsData.items.filter((p) => p.metadata.name.startsWith(`${deploymentName}-`))
    if (matchingPods.length === 0) return null

    let cpuMillicores = 0
    let memBytes = 0
    for (const pod of matchingPods) {
      for (const container of pod.containers) {
        cpuMillicores += parseCpuToMillicores(container.usage.cpu)
        memBytes += parseMemoryToBytes(container.usage.memory)
      }
    }
    return { cpuMillicores, memBytes }
  }, [podMetricsData, metadata?.name])

  const availabilityPct = desiredReplicas > 0
    ? Math.round((availableReplicas / desiredReplicas) * 100)
    : 0
  const isHealthy = availabilityPct === 100

  const hasMetrics = !!actualUsage
  const cpuPct = hasMetrics && containerResources.cpuLimitMillicores > 0
    ? Math.round((actualUsage.cpuMillicores / containerResources.cpuLimitMillicores) * 100)
    : 0
  const memPct = hasMetrics && containerResources.memLimitBytes > 0
    ? Math.round((actualUsage.memBytes / containerResources.memLimitBytes) * 100)
    : 0

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px] text-blue-400">layers</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">{metadata?.name}</h1>
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">label</span>
                {apiVersion}
              </span>
              <span className="text-slate-500 dark:text-slate-600">·</span>
              {metadata?.namespace && (
                <>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">folder_open</span>
                    Namespace: {metadata.namespace}
                  </span>
                  <span className="text-slate-500 dark:text-slate-600">·</span>
                </>
              )}
              {metadata?.creationTimestamp && (
                <span>Age: {relativeTime(metadata.creationTimestamp)}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0 border border-border-light dark:border-border-dark rounded-lg overflow-hidden">
            <button
              onClick={() => handleScale(-1)}
              disabled={replicaCount <= 0 || scaleMutation.isPending}
              className="px-2.5 py-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-40 disabled:pointer-events-none border-r border-border-light dark:border-border-dark"
            >
              <span className="material-symbols-outlined text-[16px]">remove</span>
            </button>
            <div className="px-4 py-1.5 text-center min-w-[100px]">
              <span className="text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider block leading-tight">Replicas</span>
              <span className="text-lg font-bold leading-tight">{replicaCount}</span>
            </div>
            <button
              onClick={() => handleScale(1)}
              disabled={scaleMutation.isPending}
              className="px-2.5 py-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-40 disabled:pointer-events-none border-l border-border-light dark:border-border-dark"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
            </button>
          </div>

          <button
            onClick={onEditYAML}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm font-medium"
          >
            <span className="material-symbols-outlined text-[16px]">description</span>
            Edit YAML
          </button>

          <button
            onClick={() => restartMutation.mutate()}
            disabled={restartMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors text-sm font-medium disabled:opacity-60"
          >
            <span className={`material-symbols-outlined text-[16px] ${restartMutation.isPending ? 'animate-spin' : ''}`}>
              {restartMutation.isPending ? 'progress_activity' : 'refresh'}
            </span>
            Restart
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-600 dark:text-slate-500 font-medium">Availability</span>
            <span className={`material-symbols-outlined text-[18px] ${isHealthy ? 'text-emerald-400' : 'text-yellow-400'}`}>
              {isHealthy ? 'check_circle' : 'warning'}
            </span>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-bold">{availabilityPct}%</span>
            <span className={`text-sm font-medium ${isHealthy ? 'text-emerald-400' : 'text-yellow-400'}`}>
              {isHealthy ? 'Healthy' : `${readyReplicas}/${desiredReplicas} Ready`}
            </span>
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isHealthy ? 'bg-emerald-400' : 'bg-yellow-400'}`}
              style={{ width: `${availabilityPct}%` }}
            />
          </div>
        </div>

        <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-600 dark:text-slate-500 font-medium">
              {hasMetrics ? 'CPU Usage' : 'CPU Request / Limit'}
            </span>
            <span className="material-symbols-outlined text-[18px] text-blue-400">memory</span>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-bold">
              {hasMetrics ? formatCpu(actualUsage.cpuMillicores) : (containerResources.cpuRequestDisplay || '-')}
            </span>
            {containerResources.cpuLimitDisplay && (
              <span className="text-sm text-slate-600 dark:text-slate-500">
                / {containerResources.cpuLimitDisplay} Limit
              </span>
            )}
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${hasMetrics ? getUsageBarColor(cpuPct).bar : 'bg-blue-500'}`}
              style={{ width: `${Math.min(100, cpuPct)}%` }}
            />
          </div>
        </div>

        <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-600 dark:text-slate-500 font-medium">
              {hasMetrics ? 'Memory Usage' : 'Memory Request / Limit'}
            </span>
            <span className="material-symbols-outlined text-[18px] text-purple-400">bar_chart</span>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-bold">
              {hasMetrics ? formatMemory(actualUsage.memBytes) : (containerResources.memRequestDisplay || '-')}
            </span>
            {containerResources.memLimitDisplay && (
              <span className="text-sm text-slate-600 dark:text-slate-500">
                / {containerResources.memLimitDisplay} Limit
              </span>
            )}
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${hasMetrics ? getUsageBarColor(memPct).bar : 'bg-purple-500'}`}
              style={{ width: `${Math.min(100, memPct)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
})
