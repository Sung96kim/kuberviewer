import { memo, useMemo } from 'react'
import { useResourceList } from '#/hooks/use-resource-list'
import { relativeTime } from '#/lib/time'
import { Skeleton } from '#/components/ui/skeleton'

type PodEventsSectionProps = {
  namespace: string
  podName: string
}

type KubeEvent = {
  metadata?: { name?: string; creationTimestamp?: string }
  type?: string
  reason?: string
  message?: string
  count?: number
  lastTimestamp?: string
  firstTimestamp?: string
  eventTime?: string
}

type KubeItem = Record<string, unknown>

function EventsSkeleton() {
  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
      <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="px-6 py-3 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start gap-4">
            <Skeleton className="h-5 w-5 rounded-full shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
            <Skeleton className="h-3 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

function EventTypeIcon({ type }: { type: string }) {
  const isWarning = type === 'Warning'
  return (
    <span
      className={`material-symbols-outlined text-[18px] shrink-0 ${
        isWarning ? 'text-amber-500' : 'text-blue-400'
      }`}
    >
      {isWarning ? 'warning' : 'info'}
    </span>
  )
}

function getEventTimestamp(event: KubeEvent): string {
  return event.lastTimestamp ?? event.eventTime ?? event.metadata?.creationTimestamp ?? ''
}

export const PodEventsSection = memo(function PodEventsSection({
  namespace,
  podName,
}: PodEventsSectionProps) {
  const { data, isLoading } = useResourceList({
    group: '',
    version: 'v1',
    name: 'events',
    namespaced: true,
    namespace,
    fieldSelector: `involvedObject.name=${podName}`,
  })

  const events = useMemo(() => {
    const items: KubeItem[] = (data as { items?: KubeItem[] })?.items ?? []
    const typed = items as unknown as KubeEvent[]
    return [...typed].sort((a, b) => {
      const timeA = new Date(getEventTimestamp(a)).getTime() || 0
      const timeB = new Date(getEventTimestamp(b)).getTime() || 0
      return timeB - timeA
    })
  }, [data])

  if (isLoading) return <EventsSkeleton />

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
      <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
        <h3 className="text-base font-bold">Events ({events.length})</h3>
      </div>
      {events.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-slate-400">No events</div>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase font-semibold text-slate-500 tracking-wider">
            <tr>
              <th className="px-6 py-3 w-10">Type</th>
              <th className="px-6 py-3">Reason</th>
              <th className="px-6 py-3">Message</th>
              <th className="px-6 py-3">Age</th>
              <th className="px-6 py-3">Count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light dark:divide-border-dark">
            {events.map((event, i) => {
              const ts = getEventTimestamp(event)
              return (
                <tr key={event.metadata?.name ?? i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-6 py-3">
                    <EventTypeIcon type={event.type ?? 'Normal'} />
                  </td>
                  <td className="px-6 py-3 font-medium whitespace-nowrap">{event.reason ?? '-'}</td>
                  <td className="px-6 py-3 text-slate-600 dark:text-slate-400 max-w-md truncate">
                    {event.message ?? '-'}
                  </td>
                  <td className="px-6 py-3 font-mono text-xs whitespace-nowrap">
                    {ts ? relativeTime(ts) : '-'}
                  </td>
                  <td className="px-6 py-3 text-center">{event.count ?? 1}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
})
