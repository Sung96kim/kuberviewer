import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useResourceList } from '#/hooks/use-resource-list'
import { relativeTime } from '#/lib/time'
import { Skeleton } from '#/components/ui/skeleton'
import { QueryError } from '#/components/QueryError'

export const Route = createFileRoute('/events')({ component: EventsPage })

type KubeEvent = {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
  }
  type: string
  reason: string
  message: string
  count?: number
  lastTimestamp?: string
  firstTimestamp?: string
  involvedObject: {
    kind: string
    name: string
    namespace?: string
  }
  source?: {
    component?: string
  }
}

type KubeListResponse = {
  items?: KubeEvent[]
}

function TypeBadge({ type }: { type: string }) {
  if (type === 'Warning') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-900/30 text-amber-500 border border-amber-900/50">
        <span className="material-symbols-outlined text-[14px]">warning</span>
        Warning
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
      <span className="material-symbols-outlined text-[14px]">info</span>
      Normal
    </span>
  )
}

function EventRowSkeleton() {
  return (
    <tr>
      <td className="px-6 py-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
      <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
      <td className="px-6 py-4"><Skeleton className="h-4 w-40" /></td>
      <td className="px-6 py-4"><Skeleton className="h-4 w-64" /></td>
      <td className="px-6 py-4"><Skeleton className="h-4 w-8" /></td>
      <td className="px-6 py-4"><Skeleton className="h-4 w-12" /></td>
    </tr>
  )
}

function EventsPage() {
  const [typeFilter, setTypeFilter] = useState<string>('All')
  const [namespaceFilter, setNamespaceFilter] = useState<string>('All')

  const queryClient = useQueryClient()
  const { data, isLoading, isError, error } = useResourceList({
    group: '',
    version: 'v1',
    name: 'events',
    namespaced: false,
  })

  const listData = data as KubeListResponse | undefined
  const allEvents: KubeEvent[] = (listData?.items ?? []) as KubeEvent[]

  const namespaces = [...new Set(allEvents.map((e) => e.metadata.namespace))].sort()

  const filteredEvents = allEvents
    .filter((e) => typeFilter === 'All' || e.type === typeFilter)
    .filter((e) => namespaceFilter === 'All' || e.metadata.namespace === namespaceFilter)
    .sort((a, b) => {
      const aTime = a.lastTimestamp ?? a.metadata.creationTimestamp
      const bTime = b.lastTimestamp ?? b.metadata.creationTimestamp
      return new Date(bTime).getTime() - new Date(aTime).getTime()
    })

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight font-display">Cluster Events</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Live
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Real-time event stream aggregated from all namespaces.
          </p>
        </div>
      </div>

      {isError && (
        <QueryError error={error} onRetry={() => queryClient.invalidateQueries({ queryKey: ['resources', '', 'v1', 'events'] })} />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-surface-light dark:bg-slate-800 border border-border-light dark:border-border-dark rounded-lg text-sm font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none"
        >
          <option value="All">All Types</option>
          <option value="Warning">Warning</option>
          <option value="Normal">Normal</option>
        </select>
        <select
          value={namespaceFilter}
          onChange={(e) => setNamespaceFilter(e.target.value)}
          className="px-3 py-2 bg-surface-light dark:bg-slate-800 border border-border-light dark:border-border-dark rounded-lg text-sm font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none"
        >
          <option value="All">All Namespaces</option>
          {namespaces.map((ns) => (
            <option key={ns} value={ns}>{ns}</option>
          ))}
        </select>
        {!isLoading && (
          <span className="text-sm text-slate-500 dark:text-slate-400 ml-auto">
            {filteredEvents.length} events
          </span>
        )}
      </div>

      {!isError && <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 w-28">Type</th>
                <th className="px-6 py-4 w-40">Reason</th>
                <th className="px-6 py-4 w-64">Object</th>
                <th className="px-6 py-4">Message</th>
                <th className="px-6 py-4 w-20 text-center">Count</th>
                <th className="px-6 py-4 w-28 text-right">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => <EventRowSkeleton key={i} />)
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <span className="material-symbols-outlined text-4xl text-slate-500 dark:text-slate-600 mb-2 block">event_note</span>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">No events found</p>
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event) => {
                  const lastSeen = event.lastTimestamp ?? event.metadata.creationTimestamp

                  return (
                    <tr key={event.metadata.name} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 align-top">
                        <TypeBadge type={event.type} />
                      </td>
                      <td className="px-6 py-4 align-top font-semibold text-slate-800 dark:text-slate-200">
                        {event.reason}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-primary">
                            {event.involvedObject.kind.toLowerCase()}/{event.involvedObject.name}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            namespace: {event.involvedObject.namespace ?? event.metadata.namespace}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-slate-600 dark:text-slate-400 leading-relaxed">
                        {event.message}
                      </td>
                      <td className="px-6 py-4 align-top font-medium text-center">
                        {event.count ?? 1}
                      </td>
                      <td className="px-6 py-4 align-top text-slate-500 dark:text-slate-400 text-right font-mono text-xs">
                        {relativeTime(lastSeen)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>}
    </div>
  )
}
