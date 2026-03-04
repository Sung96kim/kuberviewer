import { memo } from 'react'
import { Link } from '@tanstack/react-router'
import { relativeTime } from '#/lib/time'

type ServiceSpec = {
  type?: string
  clusterIP?: string
  externalIPs?: string[]
  loadBalancerIP?: string
  ports?: Array<{
    name?: string
    port: number
    targetPort?: number | string
    protocol?: string
    nodePort?: number
  }>
  sessionAffinity?: string
}

type ServiceStatus = {
  loadBalancer?: {
    ingress?: Array<{ ip?: string; hostname?: string }>
  }
}

type ServiceHeaderProps = {
  resource: Record<string, unknown>
  onEditYAML: () => void
}

export const ServiceHeader = memo(function ServiceHeader({
  resource,
  onEditYAML,
}: ServiceHeaderProps) {
  const metadata = resource.metadata as { name?: string; namespace?: string; creationTimestamp?: string } | undefined
  const spec = resource.spec as ServiceSpec | undefined
  const status = resource.status as ServiceStatus | undefined

  const serviceType = spec?.type ?? 'ClusterIP'
  const clusterIP = spec?.clusterIP ?? '-'
  const ports = spec?.ports ?? []
  const sessionAffinity = spec?.sessionAffinity ?? 'None'

  const externalIP = status?.loadBalancer?.ingress?.[0]?.ip
    ?? status?.loadBalancer?.ingress?.[0]?.hostname
    ?? spec?.externalIPs?.[0]

  const portsDisplay = ports.map((p) => {
    const parts = [String(p.port)]
    if (p.nodePort) parts.push(String(p.nodePort))
    return `${parts.join(':')}/${p.protocol ?? 'TCP'}`
  }).join(', ')

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px] text-emerald-400">lan</span>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{metadata?.name}</h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Active
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">hub</span>
                Type: <span className="text-slate-700 dark:text-slate-300 font-medium">{serviceType}</span>
              </span>
              <span className="text-slate-500 dark:text-slate-600">·</span>
              {metadata?.namespace && (
                <>
                  <Link
                    to="/namespaces/$name"
                    params={{ name: metadata.namespace }}
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">folder_open</span>
                    Namespace: <span className="text-primary font-medium">{metadata.namespace}</span>
                  </Link>
                  <span className="text-slate-500 dark:text-slate-600">·</span>
                </>
              )}
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">settings_ethernet</span>
                ClusterIP: <span className="text-slate-700 dark:text-slate-300 font-mono text-xs">{clusterIP}</span>
              </span>
              <span className="text-slate-500 dark:text-slate-600">·</span>
              {metadata?.creationTimestamp && (
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">schedule</span>
                  Age: {relativeTime(metadata.creationTimestamp)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onEditYAML}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors text-sm font-medium"
          >
            <span className="material-symbols-outlined text-[16px]">description</span>
            Edit YAML
          </button>
        </div>
      </div>

      {(externalIP || ports.length > 0) && (
        <div className="flex items-stretch gap-4">
          {externalIP && (
            <div className="flex-1 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-4 flex items-center gap-4">
              <div className="size-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px] text-blue-400">public</span>
              </div>
              <div>
                <span className="text-xs text-slate-600 dark:text-slate-500 block">External IP ({serviceType})</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-lg font-bold font-mono">{externalIP}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(externalIP)}
                    className="p-0.5 rounded hover:bg-slate-50 dark:hover:bg-surface-hover text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    title="Copy"
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  </button>
                  <a
                    href={`http://${externalIP}${ports[0]?.port && ports[0].port !== 80 ? `:${ports[0].port}` : ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
                  >
                    Open <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          <div className={`bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-4 ${externalIP ? '' : 'flex-1'}`}>
            <div className="flex items-center gap-8">
              <div>
                <span className="text-xs text-slate-600 dark:text-slate-500 block">Port(s)</span>
                <span className="text-lg font-bold font-mono mt-0.5 block">{portsDisplay || '-'}</span>
              </div>
              <div>
                <span className="text-xs text-slate-600 dark:text-slate-500 block">Session Affinity</span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-0.5 block">{sessionAffinity}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})
