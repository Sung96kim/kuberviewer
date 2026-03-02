import { memo } from 'react'

type ReplicaSetSectionProps = {
  resource: Record<string, unknown>
}

export const ReplicaSetSection = memo(function ReplicaSetSection({ resource }: ReplicaSetSectionProps) {
  const spec = (resource.spec ?? {}) as Record<string, unknown>
  const status = (resource.status ?? {}) as Record<string, unknown>
  const selector = (spec.selector as { matchLabels?: Record<string, string> } | undefined)?.matchLabels ?? {}

  const desired = (spec.replicas ?? 0) as number
  const current = (status.replicas ?? 0) as number
  const ready = (status.readyReplicas ?? 0) as number
  const available = (status.availableReplicas ?? 0) as number
  const fullyLabeled = (status.fullyLabeledReplicas ?? 0) as number

  const ownerRefs = ((resource.metadata as Record<string, unknown> | undefined)?.ownerReferences ?? []) as Array<{ kind: string; name: string }>
  const deploymentOwner = ownerRefs.find((ref) => ref.kind === 'Deployment')

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
            { label: 'Fully Labeled', value: fullyLabeled },
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

      {deploymentOwner && (
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
          <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
            <h3 className="text-base font-bold">Owner</h3>
          </div>
          <div className="px-6">
            <div className="flex justify-between items-center py-3">
              <span className="text-sm text-slate-500 dark:text-slate-400">Deployment</span>
              <span className="text-sm font-medium text-slate-900 dark:text-white">{deploymentOwner.name}</span>
            </div>
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
              <div key={k} className="flex h-7 items-center gap-1.5 rounded bg-slate-100 dark:bg-slate-800 px-2.5 border border-border-light dark:border-border-dark">
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
