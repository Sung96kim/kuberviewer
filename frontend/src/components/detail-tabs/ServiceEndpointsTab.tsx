import { memo, useMemo } from 'react'
import { useResourceList } from '#/hooks/use-resource-list'

type ServiceEndpointsTabProps = {
  namespace: string
  serviceName: string
  resource: Record<string, unknown>
}

type KubeItem = Record<string, unknown>

type EndpointAddress = {
  ip: string
  nodeName?: string
  targetRef?: { name: string; kind: string }
}

type EndpointPort = {
  name?: string
  port: number
  protocol: string
}

export const ServiceEndpointsTab = memo(function ServiceEndpointsTab({
  namespace,
  serviceName,
  resource,
}: ServiceEndpointsTabProps) {
  const spec = resource.spec as {
    type?: string
    clusterIP?: string
    externalIPs?: string[]
    ports?: Array<{ name?: string; port: number; targetPort: number | string; protocol: string; nodePort?: number }>
    selector?: Record<string, string>
  } | undefined

  const { data, isLoading } = useResourceList({
    group: '',
    version: 'v1',
    name: 'endpoints',
    namespaced: true,
    namespace,
  })

  const items: KubeItem[] = (data as { items?: KubeItem[] })?.items ?? []

  const endpoints = useMemo(() => {
    const ep = items.find((item) => {
      const meta = item.metadata as { name?: string } | undefined
      return meta?.name === serviceName
    })
    if (!ep) return { addresses: [] as EndpointAddress[], ports: [] as EndpointPort[] }

    const subsets = (ep.subsets ?? []) as Array<{
      addresses?: EndpointAddress[]
      notReadyAddresses?: EndpointAddress[]
      ports?: EndpointPort[]
    }>

    const addresses: (EndpointAddress & { ready: boolean })[] = []
    const ports: EndpointPort[] = []

    for (const subset of subsets) {
      for (const addr of subset.addresses ?? []) {
        addresses.push({ ...addr, ready: true })
      }
      for (const addr of subset.notReadyAddresses ?? []) {
        addresses.push({ ...addr, ready: false })
      }
      for (const port of subset.ports ?? []) {
        if (!ports.some((p) => p.port === port.port)) {
          ports.push(port)
        }
      }
    }

    return { addresses, ports }
  }, [items, serviceName])

  return (
    <div className="space-y-6">
      <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
        <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
          <h3 className="text-base font-bold">Service Info</h3>
        </div>
        <div className="px-6 divide-y divide-border-light dark:divide-border-dark">
          <InfoRow label="Type" value={spec?.type ?? '-'} />
          <InfoRow label="Cluster IP" value={spec?.clusterIP ?? '-'} />
          {spec?.externalIPs && spec.externalIPs.length > 0 && (
            <InfoRow label="External IPs" value={spec.externalIPs.join(', ')} />
          )}
          {spec?.selector && (
            <InfoRow label="Selector" value={Object.entries(spec.selector).map(([k, v]) => `${k}=${v}`).join(', ')} />
          )}
        </div>
      </div>

      {spec?.ports && spec.ports.length > 0 && (
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
          <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
            <h3 className="text-base font-bold">Ports</h3>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase font-semibold text-slate-500 tracking-wider">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Protocol</th>
                <th className="px-6 py-3">Port</th>
                <th className="px-6 py-3">Target Port</th>
                <th className="px-6 py-3">Node Port</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {spec.ports.map((p, i) => (
                <tr key={i}>
                  <td className="px-6 py-3">{p.name ?? '-'}</td>
                  <td className="px-6 py-3">{p.protocol}</td>
                  <td className="px-6 py-3 font-mono">{p.port}</td>
                  <td className="px-6 py-3 font-mono">{p.targetPort}</td>
                  <td className="px-6 py-3 font-mono">{p.nodePort ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
        <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
          <h3 className="text-base font-bold">Endpoints ({endpoints.addresses.length})</h3>
        </div>
        {isLoading ? (
          <div className="px-6 py-8 text-center text-sm text-slate-400">Loading endpoints...</div>
        ) : endpoints.addresses.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-400">No endpoints</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase font-semibold text-slate-500 tracking-wider">
              <tr>
                <th className="px-6 py-3">IP</th>
                <th className="px-6 py-3">Target</th>
                <th className="px-6 py-3">Node</th>
                <th className="px-6 py-3">Ready</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {endpoints.addresses.map((addr, i) => (
                <tr key={i}>
                  <td className="px-6 py-3 font-mono">{addr.ip}</td>
                  <td className="px-6 py-3">{addr.targetRef ? `${addr.targetRef.kind}/${addr.targetRef.name}` : '-'}</td>
                  <td className="px-6 py-3">{addr.nodeName ?? '-'}</td>
                  <td className="px-6 py-3">
                    <span className={`material-symbols-outlined text-[16px] ${(addr as { ready?: boolean }).ready ? 'text-emerald-500' : 'text-red-400'}`}>
                      {(addr as { ready?: boolean }).ready ? 'check_circle' : 'cancel'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
})

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900 dark:text-white text-right ml-4 font-mono">{value}</span>
    </div>
  )
}
