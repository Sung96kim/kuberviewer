import { memo } from 'react'
import { Skeleton } from '#/components/ui/skeleton'
import { getStatusClasses } from '#/lib/resource-helpers'

type ContainerState = {
  running?: { startedAt?: string }
  waiting?: { reason?: string; message?: string }
  terminated?: { reason?: string; exitCode?: number; finishedAt?: string }
}

type ContainerStatus = {
  name: string
  image: string
  ready: boolean
  restartCount: number
  state?: ContainerState
}

type PodContainersSectionProps = {
  containerStatuses: ContainerStatus[]
  initContainerStatuses: ContainerStatus[]
  isLoading: boolean
}

function getContainerState(status: ContainerStatus): string {
  if (!status.state) return 'Unknown'
  if (status.state.running) return 'Running'
  if (status.state.waiting) return status.state.waiting.reason ?? 'Waiting'
  if (status.state.terminated) return status.state.terminated.reason ?? 'Terminated'
  return 'Unknown'
}

function ContainerCard({ status, isInit }: { status: ContainerStatus; isInit: boolean }) {
  const state = getContainerState(status)
  const classes = getStatusClasses(state)

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${classes.dot}`} />
          <span className="text-sm font-bold">{status.name}</span>
          {isInit && (
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
              init
            </span>
          )}
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${classes.badge}`}>
          {state}
        </span>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-slate-400">Image</span>
          <span className="font-mono text-xs text-slate-700 dark:text-slate-300 text-right ml-4 break-all max-w-[70%]">
            {status.image}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-slate-400">Ready</span>
          <span className="flex items-center gap-1">
            <span className={`material-symbols-outlined text-[16px] ${status.ready ? 'text-emerald-500' : 'text-red-400'}`}>
              {status.ready ? 'check_circle' : 'cancel'}
            </span>
            <span className="text-xs">{status.ready ? 'Yes' : 'No'}</span>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-slate-400">Restarts</span>
          <span className={`text-xs font-medium ${status.restartCount > 0 ? 'text-amber-500' : 'text-slate-700 dark:text-slate-300'}`}>
            {status.restartCount}
          </span>
        </div>
      </div>
    </div>
  )
}

function ContainersSkeleton() {
  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
      <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border-light dark:border-border-dark p-4 space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}

export const PodContainersSection = memo(function PodContainersSection({
  containerStatuses,
  initContainerStatuses,
  isLoading,
}: PodContainersSectionProps) {
  if (isLoading) return <ContainersSkeleton />

  const allContainers = [
    ...initContainerStatuses.map((s) => ({ status: s, isInit: true })),
    ...containerStatuses.map((s) => ({ status: s, isInit: false })),
  ]

  if (allContainers.length === 0) return null

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
      <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
        <h3 className="text-base font-bold">Containers ({allContainers.length})</h3>
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {allContainers.map(({ status, isInit }) => (
          <ContainerCard key={`${isInit ? 'init-' : ''}${status.name}`} status={status} isInit={isInit} />
        ))}
      </div>
    </div>
  )
})
