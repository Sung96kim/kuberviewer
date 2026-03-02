import { memo } from 'react'

type Address = {
  ip: string
  nodeName?: string
  targetRef?: {
    kind: string
    name: string
    namespace?: string
  }
}

type Port = {
  name?: string
  port: number
  protocol?: string
}

type Subset = {
  addresses?: Address[]
  notReadyAddresses?: Address[]
  ports?: Port[]
}

type EndpointsSubsetsSectionProps = {
  resource: Record<string, unknown>
}

function AddressRow({ address, ready }: { address: Address; ready: boolean }) {
  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
      <td className="px-4 py-3 text-sm font-mono text-slate-900 dark:text-white">
        {address.ip}
      </td>
      <td className="px-4 py-3 text-sm">
        {ready ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Ready
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-amber-500">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Not Ready
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
        {address.targetRef ? (
          <span className="text-primary">
            {address.targetRef.kind}/{address.targetRef.name}
          </span>
        ) : (
          '-'
        )}
      </td>
      <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
        {address.nodeName ?? '-'}
      </td>
    </tr>
  )
}

export const EndpointsSubsetsSection = memo(function EndpointsSubsetsSection({ resource }: EndpointsSubsetsSectionProps) {
  const subsets = (resource.subsets ?? []) as Subset[]

  if (subsets.length === 0) {
    return (
      <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark p-8 text-center">
        <span className="material-symbols-outlined text-4xl text-slate-500 dark:text-slate-600 mb-2 block">hub</span>
        <p className="text-slate-500 dark:text-slate-400 text-sm">No endpoints available</p>
        <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">This usually means no pods match the service selector.</p>
      </div>
    )
  }

  const allPorts: Port[] = []
  const readyAddresses: Address[] = []
  const notReadyAddresses: Address[] = []

  for (const subset of subsets) {
    if (subset.ports) {
      for (const port of subset.ports) {
        if (!allPorts.some((p) => p.port === port.port && p.protocol === port.protocol)) {
          allPorts.push(port)
        }
      }
    }
    if (subset.addresses) readyAddresses.push(...subset.addresses)
    if (subset.notReadyAddresses) notReadyAddresses.push(...subset.notReadyAddresses)
  }

  const allAddresses = [
    ...readyAddresses.map((a) => ({ ...a, ready: true })),
    ...notReadyAddresses.map((a) => ({ ...a, ready: false })),
  ]

  return (
    <div className="space-y-6">
      {allPorts.length > 0 && (
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
          <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
            <h3 className="text-base font-bold">Ports</h3>
          </div>
          <div className="p-4 flex flex-wrap gap-3">
            {allPorts.map((port) => (
              <div
                key={`${port.port}-${port.protocol}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-border-light dark:border-border-dark"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">lan</span>
                <div className="text-sm">
                  <span className="font-medium text-slate-900 dark:text-white">{port.port}</span>
                  <span className="text-slate-400">/{port.protocol ?? 'TCP'}</span>
                  {port.name && (
                    <span className="ml-2 text-slate-500 dark:text-slate-400">({port.name})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
        <div className="px-6 py-4 border-b border-border-light dark:border-border-dark flex items-center justify-between">
          <h3 className="text-base font-bold">
            Addresses
          </h3>
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {readyAddresses.length} ready
            </span>
            {notReadyAddresses.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {notReadyAddresses.length} not ready
              </span>
            )}
          </div>
        </div>
        {allAddresses.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No addresses
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Node</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {allAddresses.map((addr) => (
                  <AddressRow key={`${addr.ip}-${addr.ready}`} address={addr} ready={addr.ready} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
})
