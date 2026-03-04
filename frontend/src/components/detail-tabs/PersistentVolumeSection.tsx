import { memo } from 'react'

type PersistentVolumeSectionProps = {
  resource: Record<string, unknown>
}

function detectSourceType(spec: Record<string, unknown>): { type: string; details: string } {
  const sourceKeys: Record<string, string> = {
    hostPath: 'HostPath',
    nfs: 'NFS',
    csi: 'CSI',
    iscsi: 'iSCSI',
    gcePersistentDisk: 'GCE PD',
    awsElasticBlockStore: 'AWS EBS',
    azureDisk: 'Azure Disk',
    azureFile: 'Azure File',
    cephfs: 'CephFS',
    fc: 'Fibre Channel',
    flexVolume: 'FlexVolume',
    flocker: 'Flocker',
    glusterfs: 'GlusterFS',
    rbd: 'RBD',
    local: 'Local',
    vsphereVolume: 'vSphere',
  }

  for (const [key, label] of Object.entries(sourceKeys)) {
    const source = spec[key]
    if (source) {
      if (key === 'hostPath') return { type: label, details: (source as { path?: string }).path ?? '' }
      if (key === 'nfs') {
        const nfs = source as { server?: string; path?: string }
        return { type: label, details: `${nfs.server ?? ''}:${nfs.path ?? ''}` }
      }
      if (key === 'csi') {
        const csi = source as { driver?: string; volumeHandle?: string }
        return { type: label, details: `${csi.driver ?? ''} (${csi.volumeHandle ?? ''})` }
      }
      if (key === 'local') return { type: label, details: (source as { path?: string }).path ?? '' }
      return { type: label, details: '' }
    }
  }
  return { type: 'Unknown', details: '' }
}

export const PersistentVolumeSection = memo(function PersistentVolumeSection({ resource }: PersistentVolumeSectionProps) {
  const spec = resource.spec as {
    capacity?: { storage?: string }
    accessModes?: string[]
    persistentVolumeReclaimPolicy?: string
    storageClassName?: string
    volumeMode?: string
    mountOptions?: string[]
    claimRef?: { name?: string; namespace?: string }
    nodeAffinity?: Record<string, unknown>
  } & Record<string, unknown> | undefined

  const status = resource.status as {
    phase?: string
    reason?: string
    message?: string
  } | undefined

  const phase = status?.phase ?? 'Unknown'
  const capacity = spec?.capacity?.storage ?? '-'
  const accessModes = spec?.accessModes ?? []
  const reclaimPolicy = spec?.persistentVolumeReclaimPolicy ?? '-'
  const storageClass = spec?.storageClassName ?? '-'
  const volumeMode = spec?.volumeMode ?? 'Filesystem'
  const mountOptions = spec?.mountOptions ?? []
  const claimRef = spec?.claimRef
  const source = spec ? detectSourceType(spec as Record<string, unknown>) : { type: 'Unknown', details: '' }

  const phaseColor = phase === 'Available'
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : phase === 'Bound'
      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      : phase === 'Released'
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
          <span className="material-symbols-outlined text-[18px] text-primary">hard_drive</span>
          <span className="text-sm text-slate-600 dark:text-slate-400">Capacity:</span>
          <span className="text-sm font-medium text-slate-900 dark:text-white">{capacity}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-surface-highlight border border-border-light dark:border-border-dark">
          <span className="material-symbols-outlined text-[18px] text-amber-500">source</span>
          <span className="text-sm text-slate-600 dark:text-slate-400">Source:</span>
          <span className="text-sm font-medium text-slate-900 dark:text-white">{source.type}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-surface-highlight border border-border-light dark:border-border-dark">
          <span className="material-symbols-outlined text-[18px] text-emerald-500">recycling</span>
          <span className="text-sm text-slate-600 dark:text-slate-400">Reclaim:</span>
          <span className="text-sm font-medium text-slate-900 dark:text-white">{reclaimPolicy}</span>
        </div>
      </div>

      <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
        <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
          <h3 className="text-base font-bold">Volume Details</h3>
        </div>
        <div className="px-6">
          <DetailRow label="Capacity" value={capacity} />
          <DetailRow label="Access Modes" value={accessModes.join(', ') || '-'} />
          <DetailRow label="Reclaim Policy" value={reclaimPolicy} />
          <DetailRow label="Storage Class" value={storageClass} />
          <DetailRow label="Volume Mode" value={volumeMode} />
          <DetailRow label="Source Type" value={source.type} />
          {source.details && <DetailRow label="Source Path" value={source.details} />}
        </div>
      </div>

      {claimRef && (
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
          <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
            <h3 className="text-base font-bold">Claim Reference</h3>
          </div>
          <div className="px-6">
            <DetailRow label="Name" value={claimRef.name ?? '-'} />
            <DetailRow label="Namespace" value={claimRef.namespace ?? '-'} />
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
