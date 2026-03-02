import { memo } from 'react'

type EndpointPort = {
  name?: string
  port?: number
  protocol?: string
  appProtocol?: string
}

type EndpointConditions = {
  ready?: boolean
  serving?: boolean
  terminating?: boolean
}

type Endpoint = {
  addresses: string[]
  conditions?: EndpointConditions
  nodeName?: string
  targetRef?: {
    kind: string
    name: string
    namespace?: string
  }
  zone?: string
}

type EndpointSliceSectionProps = {
  resource: Record<string, unknown>
}

export const EndpointSliceSection = memo(function EndpointSliceSection({ resource }: EndpointSliceSectionProps) {
  const ports = (resource.ports ?? []) as EndpointPort[]
  const endpoints = (resource.endpoints ?? []) as Endpoint[]
  const addressType = resource.addressType as string | undefined

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        {addressType && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-border-light dark:border-border-dark">
            <span className="material-symbols-outlined text-[18px] text-primary">hub</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">Address Type:</span>
            <span className="text-sm font-medium text-slate-900 dark:text-white">{addressType}</span>
          </div>
        )}
      </div>

      {ports.length > 0 && (
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
          <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
            <h3 className="text-base font-bold">Ports</h3>
          </div>
          <div className="p-4 flex flex-wrap gap-3">
            {ports.map((port, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-border-light dark:border-border-dark"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">lan</span>
                <div className="text-sm">
                  <span className="font-medium text-slate-900 dark:text-white">{port.port ?? '*'}</span>
                  <span className="text-slate-400">/{port.protocol ?? 'TCP'}</span>
                  {port.name && (
                    <span className="ml-2 text-slate-500 dark:text-slate-400">({port.name})</span>
                  )}
                  {port.appProtocol && (
                    <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">[{port.appProtocol}]</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
        <div className="px-6 py-4 border-b border-border-light dark:border-border-dark flex items-center justify-between">
          <h3 className="text-base font-bold">Endpoints</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">{endpoints.length} endpoint{endpoints.length !== 1 ? 's' : ''}</span>
        </div>
        {endpoints.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No endpoints
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="px-4 py-3">Addresses</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Node</th>
                  <th className="px-4 py-3">Zone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {endpoints.map((ep, i) => {
                  const ready = ep.conditions?.ready !== false
                  const terminating = ep.conditions?.terminating === true
                  return (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-sm text-slate-900 dark:text-white">
                        {ep.addresses.join(', ')}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {terminating ? (
                          <span className="inline-flex items-center gap-1.5 text-amber-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Terminating
                          </span>
                        ) : ready ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-slate-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            Not Ready
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                        {ep.targetRef ? (
                          <span className="text-primary">{ep.targetRef.kind}/{ep.targetRef.name}</span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                        {ep.nodeName ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                        {ep.zone ?? '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
})
