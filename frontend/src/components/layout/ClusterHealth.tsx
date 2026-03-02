import { memo } from 'react'
import { useResourceList } from '#/hooks/use-resource-list'

type NodeCondition = {
  type: string
  status: string
}

type NodeItem = {
  status?: {
    conditions?: NodeCondition[]
  }
}

type PodItem = {
  status?: {
    phase?: string
  }
}

type ListResponse = {
  items?: Record<string, unknown>[]
}

export const ClusterHealth = memo(function ClusterHealth() {
  const { data: nodesData, isLoading: nodesLoading } = useResourceList({
    group: '',
    version: 'v1',
    name: 'nodes',
    namespaced: false,
  })

  const { data: podsData, isLoading: podsLoading } = useResourceList({
    group: '',
    version: 'v1',
    name: 'pods',
    namespaced: false,
  })

  const nodes = ((nodesData as ListResponse)?.items ?? []) as unknown as NodeItem[]
  const pods = ((podsData as ListResponse)?.items ?? []) as unknown as PodItem[]

  const readyNodes = nodes.filter((n) =>
    n.status?.conditions?.some((c) => c.type === 'Ready' && c.status === 'True'),
  ).length
  const totalNodes = nodes.length

  const runningPods = pods.filter((p) => p.status?.phase === 'Running').length
  const totalPods = pods.length

  const isLoading = nodesLoading || podsLoading
  const allHealthy = totalNodes > 0 && readyNodes === totalNodes

  if (isLoading) {
    return (
      <div className="mx-3 mb-3 p-4 rounded-xl bg-linear-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-800/60 border border-slate-200 dark:border-slate-700/60 shadow-lg shadow-black/5 dark:shadow-black/20 animate-pulse">
        <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-100 dark:bg-slate-900/50 rounded-lg px-3 py-2">
            <div className="h-5 w-12 bg-slate-200 dark:bg-slate-700 rounded mb-1" />
            <div className="h-2.5 w-16 bg-slate-200/50 dark:bg-slate-700/50 rounded" />
          </div>
          <div className="bg-slate-100 dark:bg-slate-900/50 rounded-lg px-3 py-2">
            <div className="h-5 w-14 bg-slate-200 dark:bg-slate-700 rounded mb-1" />
            <div className="h-2.5 w-16 bg-slate-200/50 dark:bg-slate-700/50 rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-3 mb-3 p-4 rounded-xl bg-linear-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-800/60 border border-slate-200 dark:border-slate-700/60 shadow-lg shadow-black/5 dark:shadow-black/20">
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${allHealthy ? 'bg-emerald-400' : 'bg-yellow-400'}`} />
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${allHealthy ? 'bg-emerald-500' : 'bg-yellow-500'}`} />
        </span>
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Cluster Health</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-100 dark:bg-slate-900/50 rounded-lg px-3 py-2">
          <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{readyNodes}/{totalNodes}</p>
          <p className="text-[10px] text-slate-500">Nodes Ready</p>
        </div>
        <div className="bg-slate-100 dark:bg-slate-900/50 rounded-lg px-3 py-2">
          <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{runningPods}/{totalPods}</p>
          <p className="text-[10px] text-slate-500">Pods Running</p>
        </div>
      </div>
    </div>
  )
})
