import { memo } from 'react'

type PersistentVolumeClaimSectionProps = {
  resource: Record<string, unknown>
}

export const PersistentVolumeClaimSection = memo(function PersistentVolumeClaimSection({ resource }: PersistentVolumeClaimSectionProps) {
  const spec = resource.spec as {
    accessModes?: string[]
    resources?: { requests?: { storage?: string } }
    storageClassName?: string
    volumeName?: string
    volumeMode?: string
    selector?: { matchLabels?: Record<string, string> }
  } | undefined

  const status = resource.status as {
    phase?: string
    capacity?: { storage?: string }
    accessModes?: string[]
  } | undefined

  const phase = status?.phase ?? 'Unknown'
  const requestedStorage = spec?.resources?.requests?.storage ?? '-'
  const actualCapacity = status?.capacity?.storage ?? '-'
  const accessModes = spec?.accessModes ?? []
  const storageClass = spec?.storageClassName ?? '-'
  const volumeName = spec?.volumeName
  const volumeMode = spec?.volumeMode ?? 'Filesystem'

  const phaseColor = phase === 'Bound'
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : phase === 'Pending'
      ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
      : 'bg-red-500/10 text-red-400 border-red-500/20'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-surface-highlight border border-border-light dark:border-border-dark">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${phaseColor}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {phase}
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-surface-highlight border border-border-light dark:border-border-dark">
          <span className="material-symbols-outlined text-[18px] text-primary">database</span>
          <span className="text-sm text-slate-600 dark:text-slate-400">Storage Class:</span>
          <span className="text-sm font-medium text-slate-900 dark:text-white">{storageClass}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-surface-highlight border border-border-light dark:border-border-dark">
          <span className="material-symbols-outlined text-[18px] text-amber-500">hard_drive</span>
          <span className="text-sm text-slate-600 dark:text-slate-400">Volume Mode:</span>
          <span className="text-sm font-medium text-slate-900 dark:text-white">{volumeMode}</span>
        </div>
      </div>

      <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
        <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
          <h3 className="text-base font-bold">Volume Details</h3>
        </div>
        <div className="px-6">
          <DetailRow label="Requested Storage" value={requestedStorage} />
          <DetailRow label="Actual Capacity" value={actualCapacity} />
          <DetailRow label="Access Modes" value={accessModes.join(', ') || '-'} />
          {volumeName && <DetailRow label="Volume Name" value={volumeName} />}
          <DetailRow label="Volume Mode" value={volumeMode} />
        </div>
      </div>

      {spec?.selector?.matchLabels && Object.keys(spec.selector.matchLabels).length > 0 && (
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
          <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
            <h3 className="text-base font-bold">Selector</h3>
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {Object.entries(spec.selector.matchLabels).map(([k, v]) => (
              <span key={k} className="inline-flex items-center px-2 py-0.5 rounded bg-slate-800 text-xs font-mono border border-border-dark">
                {k}={v}
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
