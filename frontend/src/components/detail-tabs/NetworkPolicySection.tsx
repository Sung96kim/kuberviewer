import { memo } from 'react'

type Selector = {
  matchLabels?: Record<string, string>
  matchExpressions?: Array<{
    key: string
    operator: string
    values?: string[]
  }>
}

type NetworkPolicyPeer = {
  podSelector?: Selector
  namespaceSelector?: Selector
  ipBlock?: {
    cidr: string
    except?: string[]
  }
}

type NetworkPolicyPort = {
  port?: number | string
  protocol?: string
  endPort?: number
}

type IngressRule = {
  from?: NetworkPolicyPeer[]
  ports?: NetworkPolicyPort[]
}

type EgressRule = {
  to?: NetworkPolicyPeer[]
  ports?: NetworkPolicyPort[]
}

type NetworkPolicySectionProps = {
  resource: Record<string, unknown>
}

function SelectorBadges({ selector }: { selector?: Selector }) {
  if (!selector) return <span className="text-slate-500 dark:text-slate-400 text-xs italic">any</span>

  const labels = selector.matchLabels ?? {}
  const expressions = selector.matchExpressions ?? []

  if (Object.keys(labels).length === 0 && expressions.length === 0) {
    return <span className="text-slate-500 dark:text-slate-400 text-xs italic">all</span>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(labels).map(([k, v]) => (
        <span key={k} className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-surface-highlight text-xs font-mono border border-border-light dark:border-border-dark">
          {k}={v}
        </span>
      ))}
      {expressions.map((expr) => (
        <span key={expr.key} className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-surface-highlight text-xs font-mono border border-border-light dark:border-border-dark">
          {expr.key} {expr.operator} {expr.values?.join(', ') ?? ''}
        </span>
      ))}
    </div>
  )
}

function PeerDescription({ peer }: { peer: NetworkPolicyPeer }) {
  if (peer.ipBlock) {
    return (
      <div className="space-y-1">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-xs font-mono border border-blue-500/20">
          <span className="material-symbols-outlined text-[12px]">language</span>
          {peer.ipBlock.cidr}
        </span>
        {peer.ipBlock.except && peer.ipBlock.except.length > 0 && (
          <div className="flex flex-wrap gap-1 ml-4">
            <span className="text-xs text-slate-500">except:</span>
            {peer.ipBlock.except.map((cidr) => (
              <span key={cidr} className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 text-xs font-mono border border-red-500/20">
                {cidr}
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {peer.podSelector !== undefined && (
        <div className="flex items-start gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 mt-0.5">pods:</span>
          <SelectorBadges selector={peer.podSelector} />
        </div>
      )}
      {peer.namespaceSelector !== undefined && (
        <div className="flex items-start gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 mt-0.5">ns:</span>
          <SelectorBadges selector={peer.namespaceSelector} />
        </div>
      )}
    </div>
  )
}

function PortsList({ ports }: { ports?: NetworkPolicyPort[] }) {
  if (!ports || ports.length === 0) {
    return <span className="text-slate-500 dark:text-slate-400 text-xs italic">all ports</span>
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {ports.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-surface-highlight text-xs font-mono border border-border-light dark:border-border-dark">
          {p.port ?? '*'}{p.endPort ? `-${p.endPort}` : ''}/{p.protocol ?? 'TCP'}
        </span>
      ))}
    </div>
  )
}

function RuleCard({ direction, peers, ports, index }: {
  direction: 'ingress' | 'egress'
  peers?: NetworkPolicyPeer[]
  ports?: NetworkPolicyPort[]
  index: number
}) {
  const icon = direction === 'ingress' ? 'arrow_downward' : 'arrow_upward'
  const color = direction === 'ingress' ? 'text-emerald-500' : 'text-blue-400'

  return (
    <div className="px-6 py-4 flex items-start gap-4">
      <div className={`p-1.5 rounded bg-slate-100 dark:bg-surface-highlight ${color}`}>
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        <div className="text-sm font-medium text-slate-900 dark:text-white">
          Rule {index + 1}
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            {direction === 'ingress' ? 'From:' : 'To:'}
          </div>
          {!peers || peers.length === 0 ? (
            <span className="text-xs italic text-slate-500 dark:text-slate-400">all sources</span>
          ) : (
            <div className="space-y-2">
              {peers.map((peer, pi) => (
                <PeerDescription key={pi} peer={peer} />
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Ports:</div>
          <PortsList ports={ports} />
        </div>
      </div>
    </div>
  )
}

export const NetworkPolicySection = memo(function NetworkPolicySection({ resource }: NetworkPolicySectionProps) {
  const spec = resource.spec as {
    podSelector?: Selector
    policyTypes?: string[]
    ingress?: IngressRule[]
    egress?: EgressRule[]
  } | undefined

  const podSelector = spec?.podSelector
  const policyTypes = spec?.policyTypes ?? []
  const ingress = spec?.ingress ?? []
  const egress = spec?.egress ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-surface-highlight border border-border-light dark:border-border-dark">
          <span className="material-symbols-outlined text-[18px] text-primary">filter_alt</span>
          <span className="text-sm text-slate-500 dark:text-slate-400">Pod Selector:</span>
          <SelectorBadges selector={podSelector} />
        </div>
        {policyTypes.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-surface-highlight border border-border-light dark:border-border-dark">
            <span className="material-symbols-outlined text-[18px] text-amber-500">policy</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">Types:</span>
            <span className="text-sm font-medium text-slate-900 dark:text-white">{policyTypes.join(', ')}</span>
          </div>
        )}
      </div>

      {(policyTypes.includes('Ingress') || ingress.length > 0) && (
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
          <div className="px-6 py-4 border-b border-border-light dark:border-border-dark flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-emerald-500">arrow_downward</span>
            <h3 className="text-base font-bold">Ingress Rules</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">({ingress.length})</span>
          </div>
          {ingress.length === 0 ? (
            <div className="px-6 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No ingress rules — all inbound traffic is denied
            </div>
          ) : (
            <div className="divide-y divide-border-light dark:divide-border-dark">
              {ingress.map((rule, i) => (
                <RuleCard key={i} direction="ingress" peers={rule.from} ports={rule.ports} index={i} />
              ))}
            </div>
          )}
        </div>
      )}

      {(policyTypes.includes('Egress') || egress.length > 0) && (
        <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
          <div className="px-6 py-4 border-b border-border-light dark:border-border-dark flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-blue-400">arrow_upward</span>
            <h3 className="text-base font-bold">Egress Rules</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">({egress.length})</span>
          </div>
          {egress.length === 0 ? (
            <div className="px-6 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No egress rules — all outbound traffic is denied
            </div>
          ) : (
            <div className="divide-y divide-border-light dark:divide-border-dark">
              {egress.map((rule, i) => (
                <RuleCard key={i} direction="egress" peers={rule.to} ports={rule.ports} index={i} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
})
