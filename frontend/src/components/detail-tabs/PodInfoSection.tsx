import { memo } from 'react'
import { Link } from '@tanstack/react-router'

type PodInfoSectionProps = {
  resource: Record<string, unknown>
}

type Toleration = {
  key?: string
  operator?: string
  value?: string
  effect?: string
  tolerationSeconds?: number
}

type Volume = {
  name: string
  [key: string]: unknown
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-border-light dark:border-border-dark last:border-b-0">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-900 dark:text-white">{value}</span>
    </div>
  )
}

function formatToleration(t: Toleration): string {
  if (t.operator === 'Exists') {
    return t.key ? `${t.key}:${t.effect || '*'}` : `*:${t.effect || '*'}`
  }
  const kv = t.key ? `${t.key}=${t.value ?? ''}` : '*'
  return `${kv}:${t.effect || '*'}`
}

function getVolumeType(vol: Volume): string {
  if (vol.configMap) return 'ConfigMap'
  if (vol.secret) return 'Secret'
  if (vol.emptyDir !== undefined) return 'EmptyDir'
  if (vol.hostPath) return 'HostPath'
  if (vol.persistentVolumeClaim) return 'PVC'
  if (vol.downwardAPI) return 'DownwardAPI'
  if (vol.projected) return 'Projected'
  if (vol.csi) return 'CSI'
  return 'Other'
}

export const PodInfoSection = memo(function PodInfoSection({ resource }: PodInfoSectionProps) {
  const spec = (resource.spec ?? {}) as Record<string, unknown>
  const status = (resource.status ?? {}) as Record<string, unknown>

  const nodeName = spec.nodeName as string | undefined
  const podIP = status.podIP as string | undefined
  const hostIP = status.hostIP as string | undefined
  const qosClass = status.qosClass as string | undefined
  const serviceAccount = spec.serviceAccountName as string | undefined
  const restartPolicy = spec.restartPolicy as string | undefined
  const dnsPolicy = spec.dnsPolicy as string | undefined
  const priorityClassName = spec.priorityClassName as string | undefined
  const priority = spec.priority as number | undefined
  const nodeSelector = spec.nodeSelector as Record<string, string> | undefined
  const tolerations = spec.tolerations as Toleration[] | undefined
  const volumes = spec.volumes as Volume[] | undefined

  const hasNodeSelector = nodeSelector && Object.keys(nodeSelector).length > 0
  const hasTolerations = tolerations && tolerations.length > 0
  const hasVolumes = volumes && volumes.length > 0

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
      <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
        <h3 className="text-base font-bold">Pod Info</h3>
      </div>
      <div className="px-6">
        {nodeName && (
          <InfoRow
            label="Node"
            value={
              <Link
                to="/nodes/$name"
                params={{ name: nodeName }}
                className="text-primary hover:underline"
              >
                {nodeName}
              </Link>
            }
          />
        )}
        {podIP && <InfoRow label="Pod IP" value={<code className="font-mono text-xs">{podIP}</code>} />}
        {hostIP && <InfoRow label="Host IP" value={<code className="font-mono text-xs">{hostIP}</code>} />}
        {qosClass && <InfoRow label="QoS Class" value={qosClass} />}
        {serviceAccount && <InfoRow label="Service Account" value={serviceAccount} />}
        {restartPolicy && <InfoRow label="Restart Policy" value={restartPolicy} />}
        {dnsPolicy && <InfoRow label="DNS Policy" value={dnsPolicy} />}
        {priorityClassName && <InfoRow label="Priority Class" value={priorityClassName} />}
        {priority !== undefined && <InfoRow label="Priority" value={String(priority)} />}
      </div>

      {hasNodeSelector && (
        <>
          <div className="px-6 py-3 border-t border-border-light dark:border-border-dark">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Node Selector</span>
          </div>
          <div className="px-4 pb-4 flex flex-wrap gap-2">
            {Object.entries(nodeSelector).map(([k, v]) => (
              <div key={k} className="flex h-7 items-center gap-1.5 rounded bg-blue-500/10 px-2.5 border border-blue-500/20">
                <span className="material-symbols-outlined text-[14px] text-blue-500 dark:text-blue-400">dns</span>
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">{k}={v}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {hasTolerations && (
        <>
          <div className="px-6 py-3 border-t border-border-light dark:border-border-dark">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tolerations ({tolerations.length})</span>
          </div>
          <div className="px-4 pb-4 flex flex-wrap gap-2">
            {tolerations.map((t, i) => (
              <div key={i} className="flex h-7 items-center gap-1.5 rounded bg-amber-500/10 px-2.5 border border-amber-500/20">
                <span className="material-symbols-outlined text-[14px] text-amber-500 dark:text-amber-400">tune</span>
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">{formatToleration(t)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {hasVolumes && (
        <>
          <div className="px-6 py-3 border-t border-border-light dark:border-border-dark">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Volumes ({volumes.length})</span>
          </div>
          <div className="px-4 pb-4 flex flex-wrap gap-2">
            {volumes.map((vol) => (
              <div key={vol.name} className="flex h-7 items-center gap-1.5 rounded bg-slate-100 dark:bg-slate-800 px-2.5 border border-border-light dark:border-border-dark">
                <span className="material-symbols-outlined text-[14px] text-slate-500 dark:text-slate-400">hard_drive</span>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{vol.name}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">{getVolumeType(vol)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
})
