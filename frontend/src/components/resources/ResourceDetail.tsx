import { useState, useMemo, useCallback, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useResource } from '#/hooks/use-resource'
import { api, ApiError } from '#/api'
import { relativeTime } from '#/lib/time'
import { Skeleton } from '#/components/ui/skeleton'
import { ResourceYAMLEditor } from './ResourceYAMLEditor'
import { PodLogsTab } from '#/components/detail-tabs/PodLogsTab'
import { DeploymentRolloutTab } from '#/components/detail-tabs/DeploymentRolloutTab'
import { DeploymentPodsTab } from '#/components/detail-tabs/DeploymentPodsTab'
import { DeploymentHeader } from '#/components/detail-tabs/DeploymentHeader'
import { ServiceHeader } from '#/components/detail-tabs/ServiceHeader'
import { ServiceEndpointsTab } from '#/components/detail-tabs/ServiceEndpointsTab'
import { CronJobScheduleTab } from '#/components/detail-tabs/CronJobScheduleTab'
import { CronJobHeader } from '#/components/detail-tabs/CronJobHeader'
import { CronJobPodsTab } from '#/components/detail-tabs/CronJobPodsTab'
import { SecretDataTab } from '#/components/detail-tabs/SecretDataTab'
import { useTerminal } from '#/components/terminal/TerminalProvider'
import { PodContainersSection } from '#/components/detail-tabs/PodContainersSection'
import { EndpointsSubsetsSection } from '#/components/detail-tabs/EndpointsSubsetsSection'
import { IngressRulesSection } from '#/components/detail-tabs/IngressRulesSection'
import { NetworkPolicySection } from '#/components/detail-tabs/NetworkPolicySection'
import { EndpointSliceSection } from '#/components/detail-tabs/EndpointSliceSection'
import { PersistentVolumeClaimSection } from '#/components/detail-tabs/PersistentVolumeClaimSection'
import { PersistentVolumeSection } from '#/components/detail-tabs/PersistentVolumeSection'
import { StorageClassSection } from '#/components/detail-tabs/StorageClassSection'
import { ServiceAccountSection } from '#/components/detail-tabs/ServiceAccountSection'
import { DaemonSetSection } from '#/components/detail-tabs/DaemonSetSection'
import { ReplicaSetSection } from '#/components/detail-tabs/ReplicaSetSection'
import { StatefulSetSection } from '#/components/detail-tabs/StatefulSetSection'
import { JobSection } from '#/components/detail-tabs/JobSection'
import { ConfigMapSection } from '#/components/detail-tabs/ConfigMapSection'
import { ResourceEventsTab } from '#/components/detail-tabs/ResourceEventsTab'
import { PodInfoSection } from '#/components/detail-tabs/PodInfoSection'

type ResourceDetailProps = {
  group: string
  version: string
  resourceType: string
  name: string
  namespaced: boolean
  namespace?: string
}

type KubeResource = {
  apiVersion?: string
  kind?: string
  metadata?: {
    name?: string
    namespace?: string
    creationTimestamp?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
    uid?: string
    resourceVersion?: string
  }
  status?: {
    phase?: string
    conditions?: Array<{
      type: string
      status: string
      reason?: string
      message?: string
      lastTransitionTime?: string
    }>
  }
  spec?: Record<string, unknown>
}

function StatusBadge({ phase }: { phase: string }) {
  const colorMap: Record<string, string> = {
    Running: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Bound: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Succeeded: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    Failed: 'bg-red-500/10 text-red-400 border-red-500/20',
    Terminating: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  }
  const classes = colorMap[phase] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20'

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${classes}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {phase}
    </span>
  )
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start py-3 border-b border-border-light dark:border-border-dark last:border-b-0">
      <span className="text-sm text-slate-500 dark:text-slate-400 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-slate-900 dark:text-white text-right ml-4 break-all">{value}</span>
    </div>
  )
}

function ConditionRow({ condition }: { condition: { type: string; status: string; reason?: string; message?: string; lastTransitionTime?: string } }) {
  const isTrue = condition.status === 'True'
  const iconBg = isTrue ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-100 dark:bg-surface-highlight text-slate-400'
  const icon = isTrue ? 'check_circle' : 'cancel'

  return (
    <div className="px-6 py-4 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className={`p-1.5 rounded ${iconBg}`}>
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
        <div>
          <p className="text-sm font-medium">{condition.type}</p>
          {condition.message && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{condition.message}</p>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <span className={`text-xs font-bold ${isTrue ? 'text-emerald-500' : 'text-slate-400'}`}>
          {condition.status}
        </span>
        {condition.lastTransitionTime && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {relativeTime(condition.lastTransitionTime)} ago
          </p>
        )}
      </div>
    </div>
  )
}

type TabId = 'overview' | 'yaml' | 'logs' | 'rollout' | 'pods' | 'endpoints' | 'schedule' | 'data' | 'metadata' | 'events'

function getContainerNames(resource: KubeResource): string[] {
  const spec = resource.spec as { containers?: Array<{ name: string }>; initContainers?: Array<{ name: string }> } | undefined
  const names: string[] = []
  if (spec?.initContainers) {
    for (const c of spec.initContainers) names.push(c.name)
  }
  if (spec?.containers) {
    for (const c of spec.containers) names.push(c.name)
  }
  return names
}

type OwnerReference = {
  apiVersion: string
  kind: string
  name: string
  uid: string
  controller?: boolean
}

const KIND_TO_PLURAL: Record<string, string> = {
  Deployment: 'deployments',
  ReplicaSet: 'replicasets',
  StatefulSet: 'statefulsets',
  DaemonSet: 'daemonsets',
  Job: 'jobs',
  CronJob: 'cronjobs',
}

function getOwnerInfo(resource: KubeResource): { kind: string; name: string; splat: string } | null {
  const meta = resource.metadata as Record<string, unknown> | undefined
  const ownerRefs = meta?.ownerReferences as OwnerReference[] | undefined
  if (!ownerRefs?.length) return null

  const controller = ownerRefs.find((ref) => ref.controller) ?? ownerRefs[0]
  const namespace = resource.metadata?.namespace

  if (controller.kind === 'ReplicaSet') {
    const podTemplateHash = resource.metadata?.labels?.['pod-template-hash']
    if (podTemplateHash && controller.name.endsWith(`-${podTemplateHash}`)) {
      const deployName = controller.name.slice(0, -(podTemplateHash.length + 1))
      const splat = namespace
        ? `apps/v1/deployments/${namespace}/${deployName}`
        : `apps/v1/deployments/${deployName}`
      return { kind: 'Deployment', name: deployName, splat }
    }
  }

  const plural = KIND_TO_PLURAL[controller.kind]
  if (!plural) return null

  const slash = controller.apiVersion.indexOf('/')
  const group = slash === -1 ? '' : controller.apiVersion.slice(0, slash)
  const version = slash === -1 ? controller.apiVersion : controller.apiVersion.slice(slash + 1)
  const groupVersion = group ? `${group}/${version}` : version
  const splat = namespace
    ? `${groupVersion}/${plural}/${namespace}/${controller.name}`
    : `${groupVersion}/${plural}/${controller.name}`

  return { kind: controller.kind, name: controller.name, splat }
}

export function ResourceDetail({ group, version, resourceType, name, namespaced, namespace }: ResourceDetailProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  useEffect(() => {
    setActiveTab('overview')
  }, [group, version, resourceType, name])
  const { openSession } = useTerminal()

  const handleOpenTerminal = useCallback((container?: string) => {
    if (!namespace) return
    openSession({ namespace, pod: name, container })
  }, [namespace, name, openSession])

  const { data, isLoading, error } = useResource({
    group,
    version,
    name: resourceType,
    namespaced,
    namespace,
    resourceName: name,
  })

  const resource = data as KubeResource | undefined

  const kind = resource?.kind ?? ''
  const isPod = kind === 'Pod' || resourceType === 'pods'
  const isDeployment = kind === 'Deployment' || resourceType === 'deployments'
  const isService = kind === 'Service' || resourceType === 'services'
  const isCronJob = kind === 'CronJob' || resourceType === 'cronjobs'
  const isSecret = kind === 'Secret' || resourceType === 'secrets'
  const isEndpoints = kind === 'Endpoints' || resourceType === 'endpoints'
  const isIngress = kind === 'Ingress' || resourceType === 'ingresses'
  const isNetworkPolicy = kind === 'NetworkPolicy' || resourceType === 'networkpolicies'
  const isEndpointSlice = kind === 'EndpointSlice' || resourceType === 'endpointslices'
  const isJob = kind === 'Job' || resourceType === 'jobs'
  const isPVC = kind === 'PersistentVolumeClaim' || resourceType === 'persistentvolumeclaims'
  const isPV = kind === 'PersistentVolume' || resourceType === 'persistentvolumes'
  const isStorageClass = kind === 'StorageClass' || resourceType === 'storageclasses'
  const isServiceAccount = kind === 'ServiceAccount' || resourceType === 'serviceaccounts'
  const isDaemonSet = kind === 'DaemonSet' || resourceType === 'daemonsets'
  const isReplicaSet = kind === 'ReplicaSet' || resourceType === 'replicasets'
  const isStatefulSet = kind === 'StatefulSet' || resourceType === 'statefulsets'
  const isConfigMap = kind === 'ConfigMap' || resourceType === 'configmaps'
  const hasSpecialSection = isEndpoints || isIngress || isNetworkPolicy || isEndpointSlice || isSecret || isPVC || isPV || isStorageClass || isServiceAccount || isDaemonSet || isReplicaSet || isStatefulSet || isJob || isConfigMap
  const containerNames = useMemo(() => (isPod && resource) ? getContainerNames(resource) : [], [isPod, resource])
  const matchLabels = useMemo(() => {
    if (!isDeployment || !resource) return {}
    const spec = resource.spec as { selector?: { matchLabels?: Record<string, string> } } | undefined
    return spec?.selector?.matchLabels ?? {}
  }, [isDeployment, resource])

  const handleEditYAML = useCallback(() => setActiveTab('yaml'), [])

  const ownerInfo = useMemo(() => {
    if (!resource) return null
    return getOwnerInfo(resource)
  }, [resource])

  const queryClient = useQueryClient()
  const rollPod = useMutation({
    mutationFn: () => api.deleteResource({
      group: '',
      version: 'v1',
      name: 'pods',
      namespaced: true,
      namespace,
      resourceName: name,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource'] })
      window.history.back()
    },
  })

  const retriggerJob = useMutation({
    mutationFn: async () => {
      if (!resource) throw new Error('No resource')
      const jobSpec = (resource as Record<string, unknown>).spec as Record<string, unknown> | undefined
      if (!jobSpec) throw new Error('No spec')
      const template = jobSpec.template as Record<string, unknown> | undefined
      if (!template) throw new Error('No template')
      const suffix = Math.random().toString(36).substring(2, 7)
      const newName = `${name}-manual-${suffix}`
      const body: Record<string, unknown> = {
        apiVersion: resource.apiVersion ?? 'batch/v1',
        kind: 'Job',
        metadata: { name: newName, namespace, labels: { ...(resource.metadata?.labels ?? {}), 'kuberviewer/retrigger-of': name } },
        spec: { ...jobSpec, selector: undefined, template: { ...template, metadata: { ...(template.metadata as Record<string, unknown> ?? {}), labels: undefined } } },
      }
      return api.applyResource({ group: 'batch', version: 'v1', name: 'jobs', namespaced: true, namespace, body })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] })
    },
  })

  if (error) {
    const isApiError = error instanceof ApiError
    const status = isApiError ? error.status : 0
    const isNotFound = status === 404
    const isForbidden = status === 403
    const kindLabel = resourceType.charAt(0).toUpperCase() + resourceType.slice(1)

    const icon = isNotFound ? 'dns' : isForbidden ? 'lock' : 'error'
    const statusCode = isNotFound ? '404' : isForbidden ? '403' : String(status || 'ERR')
    const title = isNotFound
      ? 'Resource Not Found'
      : isForbidden
        ? 'Access Denied'
        : 'Failed to Load Resource'

    const description = isNotFound
      ? <>The <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-surface-highlight text-sm font-mono text-slate-700 dark:text-slate-300 border border-border-light dark:border-border-dark">{kindLabel}/{name}</code> could not be found in the current namespace.</>
      : isForbidden
        ? <>You do not have permission to access <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-surface-highlight text-sm font-mono text-slate-700 dark:text-slate-300 border border-border-light dark:border-border-dark">{kindLabel}/{name}</code>.</>
        : <>{isApiError ? error.detail : (error as Error).message}</>

    const infoTitle = isNotFound
      ? 'Why am I seeing this?'
      : isForbidden
        ? 'Possible causes'
        : 'What can I do?'

    const bullets = isNotFound
      ? [
          'The resource may have been deleted or terminated.',
          'It might have been moved to a different namespace.',
          'The URL or resource ID might be incorrect.',
        ]
      : isForbidden
        ? [
            'Your service account may lack the required RBAC permissions.',
            'The resource might be in a restricted namespace.',
            'Your cluster role bindings may need to be updated.',
          ]
        : [
            'Check your network connection and try again.',
            'The Kubernetes API server may be temporarily unavailable.',
            'Verify that the cluster is running and accessible.',
          ]

    const badgeColor = isNotFound
      ? 'bg-red-500 text-white'
      : isForbidden
        ? 'bg-yellow-500 text-black'
        : 'bg-red-500 text-white'

    const iconColor = isNotFound
      ? 'text-slate-400'
      : isForbidden
        ? 'text-yellow-500'
        : 'text-red-500'

    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center max-w-lg">
          <div className="relative inline-block mb-6">
            <span className={`material-symbols-outlined text-7xl ${iconColor}`}>
              {icon}
            </span>
            <span className={`absolute -top-2 -right-4 px-2 py-0.5 rounded-full text-xs font-bold ${badgeColor}`}>
              {statusCode}
            </span>
          </div>

          <h2 className="text-2xl font-bold mb-3">{title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{description}</p>

          <div className="text-left bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-[18px] text-blue-400">info</span>
              <span className="text-sm font-semibold">{infoTitle}</span>
            </div>
            <ul className="space-y-2 ml-1">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-500 dark:bg-slate-400 flex-shrink-0" />
                  {bullet}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-sm font-medium hover:bg-slate-50 dark:hover:bg-surface-hover transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to Workloads
            </button>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              Refresh Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-1">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-10 w-96 mt-4" />
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark p-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full mb-4" />
          ))}
        </div>
      </div>
    )
  }

  if (!resource) return null

  const metadata = resource.metadata
  const phase = resource.status?.phase
  const conditions = resource.status?.conditions ?? []
  const labels = metadata?.labels ?? {}
  const annotations = metadata?.annotations ?? {}
  const podStatus = resource.status as {
    containerStatuses?: Array<{ name: string; image: string; ready: boolean; restartCount: number; state?: Record<string, unknown> }>
    initContainerStatuses?: Array<{ name: string; image: string; ready: boolean; restartCount: number; state?: Record<string, unknown> }>
  } | undefined
  const podContainerStatuses = podStatus?.containerStatuses ?? []
  const podInitContainerStatuses = podStatus?.initContainerStatuses ?? []

  const tabs: Array<{ id: TabId; label: string }> = (() => {
    const result: Array<{ id: TabId; label: string }> = []

    if (hasSpecialSection) {
      result.push({ id: 'overview', label: isSecret ? 'Data Overview' : isEndpoints ? 'Subsets' : isIngress ? 'Rules' : isNetworkPolicy ? 'Policy' : isEndpointSlice ? 'Endpoints' : isPVC || isPV ? 'Volume' : isStorageClass ? 'Details' : isServiceAccount ? 'Account' : isConfigMap ? 'Data' : 'Overview' })
    } else {
      result.push({ id: 'overview', label: 'Overview' })
    }

    if (isPod) result.push({ id: 'logs' as TabId, label: 'Logs' })
    if (isDeployment) {
      result.push({ id: 'rollout' as TabId, label: 'Rollout' })
      result.push({ id: 'pods' as TabId, label: 'Pods' })
    }
    if (isService) result.push({ id: 'endpoints' as TabId, label: 'Endpoints' })
    if (isCronJob) {
      result.push({ id: 'schedule' as TabId, label: 'Schedule' })
      result.push({ id: 'pods' as TabId, label: 'Pods' })
    }

    if (hasSpecialSection) {
      result.push({ id: 'metadata', label: 'Metadata' })
    }

    if (namespace) result.push({ id: 'events', label: 'Events' })

    result.push({ id: 'yaml', label: 'YAML' })
    return result
  })()

  return (
    <div className="space-y-6">
      {isDeployment ? (
        <DeploymentHeader
          resource={resource as Record<string, unknown>}
          group={group}
          version={version}
          resourceType={resourceType}
          namespaced={namespaced}
          namespace={namespace}
          onEditYAML={handleEditYAML}
        />
      ) : isService ? (
        <ServiceHeader
          resource={resource as Record<string, unknown>}
          onEditYAML={handleEditYAML}
        />
      ) : isCronJob ? (
        <CronJobHeader
          resource={resource as Record<string, unknown>}
          onEditYAML={handleEditYAML}
        />
      ) : (
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{metadata?.name ?? name}</h1>
              {phase && <StatusBadge phase={phase} />}
            </div>
            {isPod && phase === 'Running' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenTerminal(containerNames.find((c) => !c.startsWith('init-')))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:bg-slate-50 dark:hover:bg-surface-hover transition-colors text-sm"
                  title="Open terminal"
                >
                  <span className="material-symbols-outlined text-[16px]">terminal</span>
                  Terminal
                </button>
                <button
                  onClick={() => rollPod.mutate()}
                  disabled={rollPod.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-500 transition-colors text-sm font-medium disabled:opacity-50"
                  title="Delete this pod so its controller recreates it"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {rollPod.isPending ? 'progress_activity' : 'restart_alt'}
                  </span>
                  {rollPod.isPending ? 'Restarting...' : 'Restart Pod'}
                </button>
              </div>
            )}
            {isJob && namespace && (
              <button
                onClick={() => retriggerJob.mutate()}
                disabled={retriggerJob.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:bg-slate-50 dark:hover:bg-surface-hover transition-colors text-sm font-medium disabled:opacity-50"
                title="Create a new Job with the same spec"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {retriggerJob.isPending ? 'progress_activity' : 'replay'}
                </span>
                {retriggerJob.isPending ? 'Creating...' : 'Re-trigger'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            {metadata?.namespace && (
              <Link
                to="/namespaces/$name"
                params={{ name: metadata.namespace }}
                className="flex items-center gap-1.5 hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="material-symbols-outlined text-[18px]">folder_open</span>
                Namespace: <span className="text-primary font-medium">{metadata.namespace}</span>
              </Link>
            )}
            {ownerInfo && (
              <Link
                to="/resources/$"
                params={{ _splat: ownerInfo.splat }}
                className="flex items-center gap-1.5 hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="material-symbols-outlined text-[18px]">account_tree</span>
                {ownerInfo.kind}: <span className="text-primary font-medium">{ownerInfo.name}</span>
              </Link>
            )}
            {isSecret && (
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">key</span>
                Type: <span className="text-slate-700 dark:text-slate-300">{(resource as { type?: string }).type ?? 'Opaque'}</span>
              </span>
            )}
            {isEndpointSlice && Boolean((resource as Record<string, unknown>).addressType) && (
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">hub</span>
                Address Type: <span className="text-slate-700 dark:text-slate-300">{String((resource as Record<string, unknown>).addressType)}</span>
              </span>
            )}
            {isPVC && (resource.status as { phase?: string } | undefined)?.phase && (
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">hard_drive</span>
                Status: <span className="text-slate-700 dark:text-slate-300">{(resource.status as { phase?: string }).phase}</span>
              </span>
            )}
            {isPV && (resource.spec as { capacity?: { storage?: string } } | undefined)?.capacity?.storage && (
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">hard_drive</span>
                Capacity: <span className="text-slate-700 dark:text-slate-300">{(resource.spec as { capacity: { storage: string } }).capacity.storage}</span>
              </span>
            )}
            {isStorageClass && Boolean((resource as Record<string, unknown>).provisioner) && (
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">cloud</span>
                Provisioner: <span className="text-slate-700 dark:text-slate-300">{String((resource as Record<string, unknown>).provisioner)}</span>
              </span>
            )}
            {metadata?.creationTimestamp && (
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">schedule</span>
                Age: <span className="text-slate-700 dark:text-slate-300">{relativeTime(metadata.creationTimestamp)}</span>
              </span>
            )}
          </div>
        </div>
      )}

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
        <div className="space-y-6">
          {hasSpecialSection ? (
            <>
              {isSecret && <SecretDataTab resource={resource as Record<string, unknown>} />}
              {isEndpoints && <EndpointsSubsetsSection resource={resource as Record<string, unknown>} />}
              {isIngress && <IngressRulesSection resource={resource as Record<string, unknown>} />}
              {isNetworkPolicy && <NetworkPolicySection resource={resource as Record<string, unknown>} />}
              {isEndpointSlice && <EndpointSliceSection resource={resource as Record<string, unknown>} />}
              {isPVC && <PersistentVolumeClaimSection resource={resource as Record<string, unknown>} />}
              {isPV && <PersistentVolumeSection resource={resource as Record<string, unknown>} />}
              {isStorageClass && <StorageClassSection resource={resource as Record<string, unknown>} />}
              {isServiceAccount && <ServiceAccountSection resource={resource as Record<string, unknown>} />}
              {isDaemonSet && <DaemonSetSection resource={resource as Record<string, unknown>} />}
              {isReplicaSet && <ReplicaSetSection resource={resource as Record<string, unknown>} />}
              {isStatefulSet && <StatefulSetSection resource={resource as Record<string, unknown>} />}
              {isJob && <JobSection resource={resource as Record<string, unknown>} />}
              {isConfigMap && <ConfigMapSection resource={resource as Record<string, unknown>} />}
            </>
          ) : (
            <>
              {isPod && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <PodContainersSection
                    containerStatuses={podContainerStatuses}
                    initContainerStatuses={podInitContainerStatuses}
                    isLoading={false}
                    onOpenTerminal={handleOpenTerminal}
                  />
                  <PodInfoSection resource={resource as Record<string, unknown>} />
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <MetadataCard metadata={metadata} />
                  <LabelsCard labels={labels} />
                  <AnnotationsCard annotations={annotations} />
                </div>
                <div className="space-y-6">
                  <ConditionsCard conditions={conditions} />
                </div>
              </div>

            </>
          )}
        </div>
      )}

      {activeTab === 'metadata' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <MetadataCard metadata={metadata} />
              <LabelsCard labels={labels} />
              <AnnotationsCard annotations={annotations} />
            </div>
            <div className="space-y-6">
              <ConditionsCard conditions={conditions} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'events' && namespace && (
        <ResourceEventsTab
          namespace={namespace}
          resourceName={metadata?.name ?? name}
        />
      )}

      {activeTab === 'logs' && isPod && namespace && (
        <PodLogsTab
          namespace={namespace}
          podName={metadata?.name ?? name}
          containers={containerNames}
        />
      )}

      {activeTab === 'rollout' && isDeployment && namespace && (
        <DeploymentRolloutTab
          namespace={namespace}
          deploymentName={metadata?.name ?? name}
          resource={resource as Record<string, unknown>}
        />
      )}

      {activeTab === 'pods' && isDeployment && namespace && (
        <DeploymentPodsTab
          namespace={namespace}
          deploymentName={metadata?.name ?? name}
          selector={matchLabels}
        />
      )}

      {activeTab === 'endpoints' && isService && namespace && (
        <ServiceEndpointsTab
          namespace={namespace}
          serviceName={metadata?.name ?? name}
          resource={resource as Record<string, unknown>}
        />
      )}

      {activeTab === 'schedule' && isCronJob && namespace && (
        <CronJobScheduleTab
          namespace={namespace}
          cronJobName={metadata?.name ?? name}
          resource={resource as Record<string, unknown>}
        />
      )}

      {activeTab === 'pods' && isCronJob && namespace && (
        <CronJobPodsTab
          namespace={namespace}
          cronJobName={metadata?.name ?? name}
        />
      )}

      {activeTab === 'yaml' && (
        <ResourceYAMLEditor
          resource={resource as Record<string, unknown>}
          group={group}
          version={version}
          resourceType={resourceType}
          namespaced={namespaced}
          namespace={namespace}
        />
      )}
    </div>
  )
}

function MetadataCard({ metadata }: { metadata: KubeResource['metadata'] }) {
  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
      <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
        <h3 className="text-base font-bold">Metadata</h3>
      </div>
      <div className="px-6">
        <MetadataRow label="Name" value={metadata?.name ?? '-'} />
        {metadata?.namespace && <MetadataRow label="Namespace" value={metadata.namespace} />}
        <MetadataRow label="UID" value={metadata?.uid ?? '-'} />
        <MetadataRow label="Resource Version" value={metadata?.resourceVersion ?? '-'} />
        <MetadataRow label="Created" value={metadata?.creationTimestamp ?? '-'} />
      </div>
    </div>
  )
}

function LabelsCard({ labels }: { labels: Record<string, string> }) {
  if (Object.keys(labels).length === 0) return null
  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
      <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
        <h3 className="text-base font-bold">Labels</h3>
      </div>
      <div className="p-4 flex flex-wrap gap-2">
        {Object.entries(labels).map(([k, v]) => (
          <div key={k} className="flex h-7 items-center gap-1.5 rounded bg-slate-100 dark:bg-surface-highlight px-2.5 border border-border-light dark:border-border-dark">
            <span className="material-symbols-outlined text-[14px] text-slate-500 dark:text-slate-400">label</span>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{k}={v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AnnotationsCard({ annotations }: { annotations: Record<string, string> }) {
  if (Object.keys(annotations).length === 0) return null
  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
      <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
        <h3 className="text-base font-bold">Annotations</h3>
      </div>
      <div className="px-6">
        {Object.entries(annotations).map(([k, v]) => (
          <MetadataRow key={k} label={k} value={v} />
        ))}
      </div>
    </div>
  )
}

function ConditionsCard({ conditions }: { conditions: Array<{ type: string; status: string; reason?: string; message?: string; lastTransitionTime?: string }> }) {
  if (conditions.length === 0) return null
  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
      <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
        <h3 className="text-base font-bold">Conditions</h3>
      </div>
      <div className="divide-y divide-border-light dark:divide-border-dark">
        {conditions.map((c) => (
          <ConditionRow key={c.type} condition={c} />
        ))}
      </div>
    </div>
  )
}
