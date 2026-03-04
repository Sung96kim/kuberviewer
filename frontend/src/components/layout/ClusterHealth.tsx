import { memo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '#/api'
import { usePollingInterval } from '#/hooks/use-polling'
import { RefetchIndicator } from '#/components/ui/refetch-indicator'

export const ClusterHealth = memo(function ClusterHealth() {
  const healthInterval = usePollingInterval(60_000)
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['cluster-health'],
    queryFn: () => api.clusterHealth(),
    staleTime: 60_000,
    refetchInterval: healthInterval,
  })

  if (isLoading || !data) {
    return (
      <div className="mx-3 mb-3 p-4 rounded-xl bg-linear-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-800/60 border border-slate-200 dark:border-border-dark/60 shadow-lg shadow-black/5 dark:shadow-black/20 animate-pulse">
        <div className="h-3 w-24 bg-slate-200 dark:bg-surface-hover rounded mb-3" />
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-100 dark:bg-background-dark/50 rounded-lg px-3 py-2">
            <div className="h-5 w-12 bg-slate-200 dark:bg-surface-hover rounded mb-1" />
            <div className="h-2.5 w-16 bg-slate-200/50 dark:bg-surface-hover/50 rounded" />
          </div>
          <div className="bg-slate-100 dark:bg-background-dark/50 rounded-lg px-3 py-2">
            <div className="h-5 w-14 bg-slate-200 dark:bg-surface-hover rounded mb-1" />
            <div className="h-2.5 w-16 bg-slate-200/50 dark:bg-surface-hover/50 rounded" />
          </div>
        </div>
      </div>
    )
  }

  const { nodes, pods } = data
  const allHealthy = nodes.total > 0 && nodes.ready === nodes.total

  return (
    <div className="mx-3 mb-3 p-4 rounded-xl bg-linear-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-800/60 border border-slate-200 dark:border-border-dark/60 shadow-lg shadow-black/5 dark:shadow-black/20">
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${allHealthy ? 'bg-emerald-400' : 'bg-yellow-400'}`} />
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${allHealthy ? 'bg-emerald-500' : 'bg-yellow-500'}`} />
        </span>
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Cluster Health</span>
        <RefetchIndicator fetching={isFetching} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-100 dark:bg-background-dark/50 rounded-lg px-3 py-2">
          <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{nodes.ready}/{nodes.total}</p>
          <p className="text-[10px] text-slate-500">Nodes Ready</p>
        </div>
        <div className="bg-slate-100 dark:bg-background-dark/50 rounded-lg px-3 py-2">
          <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{pods.running}/{pods.total}</p>
          <p className="text-[10px] text-slate-500">Pods Running</p>
        </div>
      </div>
    </div>
  )
})
