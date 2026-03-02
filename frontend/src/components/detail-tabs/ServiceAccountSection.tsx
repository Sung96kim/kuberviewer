import { memo } from 'react'
import { Link } from '@tanstack/react-router'

type ObjectRef = { name: string }

type ServiceAccountSectionProps = {
  resource: Record<string, unknown>
}

export const ServiceAccountSection = memo(function ServiceAccountSection({ resource }: ServiceAccountSectionProps) {
  const secrets = (resource.secrets ?? []) as ObjectRef[]
  const imagePullSecrets = (resource.imagePullSecrets ?? []) as ObjectRef[]
  const automount = resource.automountServiceAccountToken as boolean | undefined
  const namespace = (resource.metadata as { namespace?: string } | undefined)?.namespace

  return (
    <div className="space-y-6">
      <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
        <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
          <h3 className="text-base font-bold">Configuration</h3>
        </div>
        <div className="px-6">
          <div className="flex justify-between items-center py-3 border-b border-border-light dark:border-border-dark">
            <span className="text-sm text-slate-500 dark:text-slate-400">Automount Token</span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
              automount === false
                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {automount === false ? 'Disabled' : 'Enabled'}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
        <div className="px-6 py-4 border-b border-border-light dark:border-border-dark flex items-center justify-between">
          <h3 className="text-base font-bold">Secrets</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">{secrets.length} {secrets.length === 1 ? 'secret' : 'secrets'}</span>
        </div>
        {secrets.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-500 dark:text-slate-600 mb-2 block">key_off</span>
            <p className="text-sm text-slate-500 dark:text-slate-400">No secrets attached</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Kubernetes 1.24+ no longer auto-creates token secrets for service accounts.</p>
          </div>
        ) : (
          <div className="divide-y divide-border-light dark:divide-border-dark">
            {secrets.map((s) => (
              <div key={s.name} className="px-6 py-3 flex items-center gap-3">
                <span className="material-symbols-outlined text-[18px] text-primary">key</span>
                {namespace ? (
                  <Link
                    to="/resources/$"
                    params={{ _splat: `v1/secrets/${namespace}/${s.name}` }}
                    className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    {s.name}
                  </Link>
                ) : (
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{s.name}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
        <div className="px-6 py-4 border-b border-border-light dark:border-border-dark flex items-center justify-between">
          <h3 className="text-base font-bold">Image Pull Secrets</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">{imagePullSecrets.length} {imagePullSecrets.length === 1 ? 'secret' : 'secrets'}</span>
        </div>
        {imagePullSecrets.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-500 dark:text-slate-600 mb-2 block">image</span>
            <p className="text-sm text-slate-500 dark:text-slate-400">No image pull secrets configured</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Pods using this service account will use the default image pull policy.</p>
          </div>
        ) : (
          <div className="divide-y divide-border-light dark:divide-border-dark">
            {imagePullSecrets.map((s) => (
              <div key={s.name} className="px-6 py-3 flex items-center gap-3">
                <span className="material-symbols-outlined text-[18px] text-slate-400">image</span>
                {namespace ? (
                  <Link
                    to="/resources/$"
                    params={{ _splat: `v1/secrets/${namespace}/${s.name}` }}
                    className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    {s.name}
                  </Link>
                ) : (
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{s.name}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})
