import { memo } from 'react'

type StatefulSetSectionProps = {
  resource: Record<string, unknown>
}

export const StatefulSetSection = memo(function StatefulSetSection({ resource }: StatefulSetSectionProps) {
  const spec = (resource.spec ?? {}) as Record<string, unknown>
  const status = (resource.status ?? {}) as Record<string, unknown>
  const updateStrategy = spec.updateStrategy as { type?: string; rollingUpdate?: { partition?: number; maxUnavailable?: number | string } } | undefined
  const selector = (spec.selector as { matchLabels?: Record<string, string> } | undefined)?.matchLabels ?? {}
  const serviceName = spec.serviceName as string | undefined
  const podManagementPolicy = (spec.podManagementPolicy ?? 'OrderedReady') as string

  const desired = (spec.replicas ?? 0) as number
  const current = (status.replicas ?? 0) as number
  const ready = (status.readyReplicas ?? 0) as number
  const available = (status.availableReplicas ?? 0) as number
  const updated = (status.updatedReplicas ?? 0) as number
  const currentRevision = status.currentRevision as string | undefined
  const updateRevision = status.updateRevision as string | undefined

  const volumeClaimTemplates = (spec.volumeClaimTemplates ?? []) as Array<{
    metadata?: { name?: string }
    spec?: { accessModes?: string[]; resources?: { requests?: { storage?: string } }; storageClassName?: string }
  }>

  return (
    <div className="space-y-6">
      <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
        <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
          <h3 className="text-base font-bold">Status</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-border-light dark:divide-border-dark">
          {[
            { label: 'Desired', value: desired },
            { label: 'Current', value: current },
            { label: 'Ready', value: ready },
            { label: 'Available', value: available },
            { label: 'Updated', value: updated },
          ].map(({ label, value }) => (
            <div key={label} className="px-4 py-4 text-center">
              <p className={`text-2xl font-bold ${value === desired && desired > 0 ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>
                {value}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
        <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
          <h3 className="text-base font-bold">Configuration</h3>
        </div>
        <div className="px-6">
          {serviceName && (
            <div className="flex justify-between items-center py-3 border-b border-border-light dark:border-border-dark last:border-b-0">
              <span className="text-sm text-slate-500 dark:text-slate-400">Service Name</span>
              <span className="text-sm font-medium text-slate-900 dark:text-white">{serviceName}</span>
            </div>
          )}
          <div className="flex justify-between items-center py-3 border-b border-border-light dark:border-border-dark last:border-b-0">
            <span className="text-sm text-slate-500 dark:text-slate-400">Pod Management</span>
            <span className="text-sm font-medium text-slate-900 dark:text-white">{podManagementPolicy}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-border-light dark:border-border-dark last:border-b-0">
            <span className="text-sm text-slate-500 dark:text-slate-400">Update Strategy</span>
            <span className="text-sm font-medium text-slate-900 dark:text-white">{updateStrategy?.type ?? 'RollingUpdate'}</span>
          </div>
          {updateStrategy?.type === 'RollingUpdate' && updateStrategy.rollingUpdate?.partition !== undefined && (
            <div className="flex justify-between items-center py-3 border-b border-border-light dark:border-border-dark last:border-b-0">
              <span className="text-sm text-slate-500 dark:text-slate-400">Partition</span>
              <span className="text-sm font-medium text-slate-900 dark:text-white">{updateStrategy.rollingUpdate.partition}</span>
            </div>
          )}
          {currentRevision && (
            <div className="flex justify-between items-center py-3 border-b border-border-light dark:border-border-dark last:border-b-0">
              <span className="text-sm text-slate-500 dark:text-slate-400">Current Revision</span>
              <span className="text-sm font-mono text-xs text-slate-900 dark:text-white">{currentRevision}</span>
            </div>
          )}
          {updateRevision && updateRevision !== currentRevision && (
            <div className="flex justify-between items-center py-3 border-b border-border-light dark:border-border-dark last:border-b-0">
              <span className="text-sm text-slate-500 dark:text-slate-400">Update Revision</span>
              <span className="text-sm font-mono text-xs text-slate-900 dark:text-white">{updateRevision}</span>
            </div>
          )}
        </div>
      </div>

      {volumeClaimTemplates.length > 0 && (
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
          <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
            <h3 className="text-base font-bold">Volume Claim Templates</h3>
          </div>
          <div className="divide-y divide-border-light dark:divide-border-dark">
            {volumeClaimTemplates.map((vct, i) => (
              <div key={vct.metadata?.name ?? i} className="px-6 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-[18px] text-blue-400">hard_drive</span>
                  <span className="text-sm font-bold">{vct.metadata?.name ?? `volume-${i}`}</span>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
                  {vct.spec?.resources?.requests?.storage && (
                    <span>Size: <span className="text-slate-900 dark:text-white font-medium">{vct.spec.resources.requests.storage}</span></span>
                  )}
                  {vct.spec?.accessModes && (
                    <span>Access: <span className="text-slate-900 dark:text-white font-medium">{vct.spec.accessModes.join(', ')}</span></span>
                  )}
                  {vct.spec?.storageClassName && (
                    <span>Class: <span className="text-slate-900 dark:text-white font-medium">{vct.spec.storageClassName}</span></span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(selector).length > 0 && (
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
          <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
            <h3 className="text-base font-bold">Selector</h3>
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {Object.entries(selector).map(([k, v]) => (
              <div key={k} className="flex h-7 items-center gap-1.5 rounded bg-slate-100 dark:bg-surface-highlight px-2.5 border border-border-light dark:border-border-dark">
                <span className="material-symbols-outlined text-[14px] text-slate-500 dark:text-slate-400">label</span>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{k}={v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})
