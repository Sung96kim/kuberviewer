import { memo } from 'react'

type IngressBackend = {
  service?: {
    name: string
    port: {
      number?: number
      name?: string
    }
  }
  resource?: {
    apiGroup?: string
    kind: string
    name: string
  }
}

type IngressPath = {
  path?: string
  pathType?: string
  backend: IngressBackend
}

type IngressRule = {
  host?: string
  http?: {
    paths: IngressPath[]
  }
}

type IngressTLS = {
  hosts?: string[]
  secretName?: string
}

type IngressRulesSectionProps = {
  resource: Record<string, unknown>
}

function formatBackend(backend: IngressBackend): string {
  if (backend.service) {
    const port = backend.service.port.number ?? backend.service.port.name ?? ''
    return `${backend.service.name}:${port}`
  }
  if (backend.resource) {
    return `${backend.resource.kind}/${backend.resource.name}`
  }
  return '-'
}

export const IngressRulesSection = memo(function IngressRulesSection({ resource }: IngressRulesSectionProps) {
  const spec = resource.spec as {
    rules?: IngressRule[]
    tls?: IngressTLS[]
    defaultBackend?: IngressBackend
    ingressClassName?: string
  } | undefined

  const rules = spec?.rules ?? []
  const tls = spec?.tls ?? []
  const defaultBackend = spec?.defaultBackend
  const ingressClassName = spec?.ingressClassName

  const tlsHosts = new Set<string>()
  for (const t of tls) {
    for (const h of t.hosts ?? []) tlsHosts.add(h)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        {ingressClassName && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-surface-highlight border border-border-light dark:border-border-dark">
            <span className="material-symbols-outlined text-[18px] text-primary">settings</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">Class:</span>
            <span className="text-sm font-medium text-slate-900 dark:text-white">{ingressClassName}</span>
          </div>
        )}
        {defaultBackend && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-surface-highlight border border-border-light dark:border-border-dark">
            <span className="material-symbols-outlined text-[18px] text-amber-500">alt_route</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">Default backend:</span>
            <span className="text-sm font-medium text-slate-900 dark:text-white">{formatBackend(defaultBackend)}</span>
          </div>
        )}
      </div>

      {tls.length > 0 && (
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
          <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
            <h3 className="text-base font-bold">TLS</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-surface-highlight/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="px-4 py-3">Hosts</th>
                  <th className="px-4 py-3">Secret</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {tls.map((t, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-surface-hover/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {(t.hosts ?? []).map((host) => (
                          <span key={host} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-xs font-medium border border-emerald-500/20">
                            <span className="material-symbols-outlined text-[12px]">lock</span>
                            {host}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-500 dark:text-slate-400">
                      {t.secretName ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
        <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
          <h3 className="text-base font-bold">Rules</h3>
        </div>
        {rules.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No rules defined
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-surface-highlight/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="px-4 py-3">Host</th>
                  <th className="px-4 py-3">Path</th>
                  <th className="px-4 py-3">Path Type</th>
                  <th className="px-4 py-3">Backend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {rules.flatMap((rule, ri) => {
                  const paths = rule.http?.paths ?? []
                  if (paths.length === 0) {
                    return [(
                      <tr key={`${ri}-empty`} className="hover:bg-slate-50 dark:hover:bg-surface-hover/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            {rule.host ?? '*'}
                            {rule.host && tlsHosts.has(rule.host) && (
                              <span className="material-symbols-outlined text-[14px] text-emerald-500" title="TLS enabled">lock</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">-</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">-</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">-</td>
                      </tr>
                    )]
                  }
                  return paths.map((path, pi) => (
                    <tr key={`${ri}-${pi}`} className="hover:bg-slate-50 dark:hover:bg-surface-hover/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
                        {pi === 0 ? (
                          <div className="flex items-center gap-1.5">
                            {rule.host ?? '*'}
                            {rule.host && tlsHosts.has(rule.host) && (
                              <span className="material-symbols-outlined text-[14px] text-emerald-500" title="TLS enabled">lock</span>
                            )}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-700 dark:text-slate-300">
                        {path.path ?? '/'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                        {path.pathType ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="text-primary font-medium">{formatBackend(path.backend)}</span>
                      </td>
                    </tr>
                  ))
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
})
