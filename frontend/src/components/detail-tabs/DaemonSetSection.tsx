import { memo } from 'react'

type DaemonSetSectionProps = {
  resource: Record<string, unknown>
}

export const DaemonSetSection = memo(function DaemonSetSection({ resource }: DaemonSetSectionProps) {
  const spec = (resource.spec ?? {}) as Record<string, unknown>
  const status = (resource.status ?? {}) as Record<string, unknown>
  const updateStrategy = spec.updateStrategy as { type?: string; rollingUpdate?: { maxUnavailable?: number | string; maxSurge?: number | string } } | undefined
  const selector = (spec.selector as { matchLabels?: Record<string, string> } | undefined)?.matchLabels ?? {}
  const nodeSelector = ((spec.template as Record<string, unknown> | undefined)?.spec as { nodeSelector?: Record<string, string> } | undefined)?.nodeSelector

  const desired = (status.desiredNumberScheduled ?? 0) as number
  const current = (status.currentNumberScheduled ?? 0) as number
  const ready = (status.numberReady ?? 0) as number
  const available = (status.numberAvailable ?? 0) as number
  const misscheduled = (status.numberMisscheduled ?? 0) as number
  const updated = (status.updatedNumberScheduled ?? 0) as number

  return (
    <div className="space-y-6">
      <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
        <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
          <h3 className="text-base font-bold">Status</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-border-light dark:divide-border-dark">
          {[
            { label: 'Desired', value: desired },
            { label: 'Current', value: current },
            { label: 'Ready', value: ready },
            { label: 'Available', value: available },
            { label: 'Updated', value: updated },
            { label: 'Misscheduled', value: misscheduled, warn: misscheduled > 0 },
          ].map(({ label, value, warn }) => (
            <div key={label} className="px-4 py-4 text-center">
              <p className={`text-2xl font-bold ${warn ? 'text-amber-500' : value === desired && desired > 0 ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>
                {value}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
        <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
          <h3 className="text-base font-bold">Strategy</h3>
        </div>
        <div className="px-6">
          <div className="flex justify-between items-center py-3 border-b border-border-light dark:border-border-dark last:border-b-0">
            <span className="text-sm text-slate-500 dark:text-slate-400">Update Strategy</span>
            <span className="text-sm font-medium text-slate-900 dark:text-white">{updateStrategy?.type ?? 'RollingUpdate'}</span>
          </div>
          {updateStrategy?.type === 'RollingUpdate' && updateStrategy.rollingUpdate && (
            <>
              {updateStrategy.rollingUpdate.maxUnavailable !== undefined && (
                <div className="flex justify-between items-center py-3 border-b border-border-light dark:border-border-dark last:border-b-0">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Max Unavailable</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{String(updateStrategy.rollingUpdate.maxUnavailable)}</span>
                </div>
              )}
              {updateStrategy.rollingUpdate.maxSurge !== undefined && (
                <div className="flex justify-between items-center py-3 border-b border-border-light dark:border-border-dark last:border-b-0">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Max Surge</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{String(updateStrategy.rollingUpdate.maxSurge)}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

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

      {nodeSelector && Object.keys(nodeSelector).length > 0 && (
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
          <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
            <h3 className="text-base font-bold">Node Selector</h3>
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {Object.entries(nodeSelector).map(([k, v]) => (
              <div key={k} className="flex h-7 items-center gap-1.5 rounded bg-blue-500/10 px-2.5 border border-blue-500/20">
                <span className="material-symbols-outlined text-[14px] text-blue-400">dns</span>
                <span className="text-xs font-medium text-blue-300">{k}={v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})
