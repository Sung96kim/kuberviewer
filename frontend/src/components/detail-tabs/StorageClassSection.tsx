import { memo } from 'react'

type StorageClassSectionProps = {
  resource: Record<string, unknown>
}

export const StorageClassSection = memo(function StorageClassSection({ resource }: StorageClassSectionProps) {
  const provisioner = (resource.provisioner ?? '-') as string
  const reclaimPolicy = (resource.reclaimPolicy ?? '-') as string
  const volumeBindingMode = (resource.volumeBindingMode ?? '-') as string
  const allowVolumeExpansion = (resource.allowVolumeExpansion ?? false) as boolean
  const parameters = (resource.parameters ?? {}) as Record<string, string>
  const mountOptions = (resource.mountOptions ?? []) as string[]
  const paramEntries = Object.entries(parameters)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-surface-highlight border border-border-light dark:border-border-dark">
          <span className="material-symbols-outlined text-[18px] text-primary">cloud</span>
          <span className="text-sm text-slate-600 dark:text-slate-400">Provisioner:</span>
          <span className="text-sm font-medium text-slate-900 dark:text-white font-mono">{provisioner}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-surface-highlight border border-border-light dark:border-border-dark">
          <span className="material-symbols-outlined text-[18px] text-emerald-500">recycling</span>
          <span className="text-sm text-slate-600 dark:text-slate-400">Reclaim:</span>
          <span className="text-sm font-medium text-slate-900 dark:text-white">{reclaimPolicy}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-surface-highlight border border-border-light dark:border-border-dark">
          <span className="material-symbols-outlined text-[18px] text-amber-500">schedule</span>
          <span className="text-sm text-slate-600 dark:text-slate-400">Binding:</span>
          <span className="text-sm font-medium text-slate-900 dark:text-white">{volumeBindingMode}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-surface-highlight border border-border-light dark:border-border-dark">
          <span className="material-symbols-outlined text-[18px]" style={{ color: allowVolumeExpansion ? '#10b981' : '#64748b' }}>
            {allowVolumeExpansion ? 'check_circle' : 'cancel'}
          </span>
          <span className="text-sm text-slate-600 dark:text-slate-400">Expansion:</span>
          <span className="text-sm font-medium text-slate-900 dark:text-white">{allowVolumeExpansion ? 'Allowed' : 'Not Allowed'}</span>
        </div>
      </div>

      <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
        <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
          <h3 className="text-base font-bold">Configuration</h3>
        </div>
        <div className="px-6">
          <DetailRow label="Provisioner" value={provisioner} />
          <DetailRow label="Reclaim Policy" value={reclaimPolicy} />
          <DetailRow label="Volume Binding Mode" value={volumeBindingMode} />
          <DetailRow label="Allow Volume Expansion" value={allowVolumeExpansion ? 'Yes' : 'No'} />
        </div>
      </div>

      {paramEntries.length > 0 && (
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
          <div className="px-6 py-4 border-b border-border-light dark:border-border-dark flex items-center justify-between">
            <h3 className="text-base font-bold">Parameters</h3>
            <span className="text-xs text-slate-600 dark:text-slate-500">{paramEntries.length} parameter{paramEntries.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="px-6">
            {paramEntries.map(([k, v]) => (
              <DetailRow key={k} label={k} value={v} />
            ))}
          </div>
        </div>
      )}

      {mountOptions.length > 0 && (
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
          <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
            <h3 className="text-base font-bold">Mount Options</h3>
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {mountOptions.map((opt) => (
              <span key={opt} className="inline-flex items-center px-2.5 py-1 rounded bg-slate-100 dark:bg-surface-highlight text-xs font-mono border border-border-light dark:border-border-dark text-slate-700 dark:text-slate-300">
                {opt}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start py-3 border-b border-border-light dark:border-border-dark last:border-b-0">
      <span className="text-sm text-slate-600 dark:text-slate-400 shrink-0">{label}</span>
      <span className="text-sm font-medium text-slate-900 dark:text-white text-right ml-4 break-all">{value}</span>
    </div>
  )
}
