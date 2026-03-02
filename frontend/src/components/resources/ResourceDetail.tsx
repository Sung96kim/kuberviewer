import { useState } from 'react'
import { useResource } from '#/hooks/use-resource'
import { relativeTime } from '#/lib/time'
import { Skeleton } from '#/components/ui/skeleton'
import { ResourceYAMLEditor } from './ResourceYAMLEditor'

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
  const iconBg = isTrue ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
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

export function ResourceDetail({ group, version, resourceType, name, namespaced, namespace }: ResourceDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'yaml' | 'events'>('overview')

  const { data, isLoading, error } = useResource({
    group,
    version,
    name: resourceType,
    namespaced,
    namespace,
    resourceName: name,
  })

  const resource = data as KubeResource | undefined

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-red-500 mb-4 block">error</span>
          <h2 className="text-xl font-bold mb-2">Failed to Load Resource</h2>
          <p className="text-slate-500 dark:text-slate-400">{(error as Error).message}</p>
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

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'yaml' as const, label: 'YAML' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold">{metadata?.name ?? name}</h1>
          {phase && <StatusBadge phase={phase} />}
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
          {metadata?.namespace && (
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">folder_open</span>
              Namespace: <span className="text-slate-700 dark:text-slate-300">{metadata.namespace}</span>
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

            {Object.keys(labels).length > 0 && (
              <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
                <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
                  <h3 className="text-base font-bold">Labels</h3>
                </div>
                <div className="p-4 flex flex-wrap gap-2">
                  {Object.entries(labels).map(([k, v]) => (
                    <div key={k} className="flex h-7 items-center gap-1.5 rounded bg-slate-100 dark:bg-slate-800 px-2.5 border border-border-light dark:border-border-dark">
                      <span className="material-symbols-outlined text-[14px] text-slate-500 dark:text-slate-400">label</span>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{k}={v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(annotations).length > 0 && (
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
            )}
          </div>

          <div className="space-y-6">
            {conditions.length > 0 && (
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
            )}
          </div>
        </div>
      )}

      {activeTab === 'yaml' && (
        <ResourceYAMLEditor resource={resource} />
      )}
    </div>
  )
}
