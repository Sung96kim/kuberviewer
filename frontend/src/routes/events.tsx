import { useState, useMemo, useCallback } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useResourceList } from '#/hooks/use-resource-list'
import { relativeTime } from '#/lib/time'
import { Skeleton } from '#/components/ui/skeleton'
import { RefetchIndicator } from '#/components/ui/refetch-indicator'
import { PollingSettings } from '#/components/ui/polling-settings'
import { QueryError } from '#/components/QueryError'
import { Breadcrumb } from '#/components/layout/Breadcrumb'

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

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
const DEFAULT_PAGE_SIZE = 20

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
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-surface-highlight text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-border-dark">
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
      <td className="px-6 py-4"><Skeleton className="h-6 w-6 rounded" /></td>
    </tr>
  )
}

function PaginationButton({
  children,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
}) {
  const baseClasses = 'px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors'
  const activeClasses = 'bg-primary/10 text-primary border-primary'
  const defaultClasses = 'bg-white dark:bg-surface-dark border-border-light dark:border-border-dark text-slate-500 hover:bg-slate-50 dark:hover:bg-surface-hover'
  const disabledClasses = 'opacity-50 cursor-not-allowed'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${active ? activeClasses : defaultClasses} ${disabled ? disabledClasses : ''}`}
    >
      {children}
    </button>
  )
}

function getVisiblePageNumbers(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages: (number | 'ellipsis')[] = [1]

  if (currentPage > 3) {
    pages.push('ellipsis')
  }

  const start = Math.max(2, currentPage - 1)
  const end = Math.min(totalPages - 1, currentPage + 1)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (currentPage < totalPages - 2) {
    pages.push('ellipsis')
  }

  pages.push(totalPages)

  return pages
}

function getResourceLinkPath(kind: string, name: string, namespace?: string): string {
  const kindMap: Record<string, { group: string; version: string; resource: string }> = {
    Pod: { group: '', version: 'v1', resource: 'pods' },
    Deployment: { group: 'apps', version: 'v1', resource: 'deployments' },
    ReplicaSet: { group: 'apps', version: 'v1', resource: 'replicasets' },
    Service: { group: '', version: 'v1', resource: 'services' },
    ConfigMap: { group: '', version: 'v1', resource: 'configmaps' },
    Secret: { group: '', version: 'v1', resource: 'secrets' },
    StatefulSet: { group: 'apps', version: 'v1', resource: 'statefulsets' },
    DaemonSet: { group: 'apps', version: 'v1', resource: 'daemonsets' },
    Job: { group: 'batch', version: 'v1', resource: 'jobs' },
    CronJob: { group: 'batch', version: 'v1', resource: 'cronjobs' },
    Node: { group: '', version: 'v1', resource: 'nodes' },
    Namespace: { group: '', version: 'v1', resource: 'namespaces' },
    PersistentVolumeClaim: { group: '', version: 'v1', resource: 'persistentvolumeclaims' },
    Ingress: { group: 'networking.k8s.io', version: 'v1', resource: 'ingresses' },
    HorizontalPodAutoscaler: { group: 'autoscaling', version: 'v2', resource: 'horizontalpodautoscalers' },
  }

  const mapping = kindMap[kind]
  if (!mapping) return ''

  const groupVersion = mapping.group ? `${mapping.group}/${mapping.version}` : mapping.version
  return namespace
    ? `${groupVersion}/${mapping.resource}/${namespace}/${name}`
    : `${groupVersion}/${mapping.resource}/${name}`
}

function EventsPage() {
  const [typeFilter, setTypeFilter] = useState<string>('All')
  const [namespaceFilter, setNamespaceFilter] = useState<string>('All')
  const [kindFilter, setKindFilter] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const queryClient = useQueryClient()
  const { data, isLoading, isError, error, isFetching } = useResourceList({
    group: '',
    version: 'v1',
    name: 'events',
    namespaced: false,
  })

  const listData = data as KubeListResponse | undefined
  const allEvents: KubeEvent[] = (listData?.items ?? []) as KubeEvent[]

  const namespaces = useMemo(
    () => [...new Set(allEvents.map((e) => e.metadata.namespace))].sort(),
    [allEvents],
  )

  const kinds = useMemo(
    () => [...new Set(allEvents.map((e) => e.involvedObject.kind))].sort(),
    [allEvents],
  )

  const filteredEvents = useMemo(() => {
    const lowerSearch = searchQuery.toLowerCase()
    return allEvents
      .filter((e) => typeFilter === 'All' || e.type === typeFilter)
      .filter((e) => namespaceFilter === 'All' || e.metadata.namespace === namespaceFilter)
      .filter((e) => kindFilter === 'All' || e.involvedObject.kind === kindFilter)
      .filter((e) => {
        if (!lowerSearch) return true
        return (
          e.message.toLowerCase().includes(lowerSearch) ||
          e.reason.toLowerCase().includes(lowerSearch)
        )
      })
      .sort((a, b) => {
        const aTime = a.lastTimestamp ?? a.metadata.creationTimestamp
        const bTime = b.lastTimestamp ?? b.metadata.creationTimestamp
        return new Date(bTime).getTime() - new Date(aTime).getTime()
      })
  }, [allEvents, typeFilter, namespaceFilter, kindFilter, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, filteredEvents.length)
  const paginatedEvents = filteredEvents.slice(startIndex, endIndex)

  const resetPage = useCallback(() => setCurrentPage(1), [])

  const handleTypeFilter = useCallback((value: string) => {
    setTypeFilter(value)
    resetPage()
  }, [resetPage])

  const handleNamespaceFilter = useCallback((value: string) => {
    setNamespaceFilter(value)
    resetPage()
  }, [resetPage])

  const handleKindFilter = useCallback((value: string) => {
    setKindFilter(value)
    resetPage()
  }, [resetPage])

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    resetPage()
  }, [resetPage])

  const handlePageSizeChange = useCallback((value: number) => {
    setPageSize(value)
    setCurrentPage(1)
  }, [])

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['resources', '', 'v1', 'events'] })
  }, [queryClient])

  const toggleRow = useCallback((name: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(filteredEvents, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `events-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }, [filteredEvents])

  const warningCount = useMemo(
    () => filteredEvents.filter((e) => e.type === 'Warning').length,
    [filteredEvents],
  )

  const normalCount = filteredEvents.length - warningCount

  const visiblePages = getVisiblePageNumbers(safePage, totalPages)

  const selectClasses = 'px-3 py-2 bg-surface-light dark:bg-surface-highlight border border-border-light dark:border-border-dark rounded-lg text-sm font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none'
  const iconButtonClasses = 'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-highlight hover:bg-slate-100 dark:hover:bg-surface-hover transition-colors'

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <Breadcrumb items={[{ label: 'Cluster', href: '/' }, { label: 'Events' }]} />
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight font-display">Cluster Events</h1>
            <RefetchIndicator fetching={isFetching} />
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
        <div className="flex items-center gap-2">
          <PollingSettings />
          <button onClick={handleRefresh} className={iconButtonClasses}>
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Refresh
          </button>
          <button onClick={handleExport} disabled={isLoading || filteredEvents.length === 0} className={`${iconButtonClasses} ${isLoading || filteredEvents.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export
          </button>
        </div>
      </div>

      {isError && (
        <QueryError error={error} onRetry={handleRefresh} />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={typeFilter}
          onChange={(e) => handleTypeFilter(e.target.value)}
          className={selectClasses}
        >
          <option value="All">All Types</option>
          <option value="Warning">Warning</option>
          <option value="Normal">Normal</option>
        </select>
        <select
          value={namespaceFilter}
          onChange={(e) => handleNamespaceFilter(e.target.value)}
          className={selectClasses}
        >
          <option value="All">All Namespaces</option>
          {namespaces.map((ns) => (
            <option key={ns} value={ns}>{ns}</option>
          ))}
        </select>
        <select
          value={kindFilter}
          onChange={(e) => handleKindFilter(e.target.value)}
          className={selectClasses}
        >
          <option value="All">All Kinds</option>
          {kinds.map((kind) => (
            <option key={kind} value={kind}>{kind}</option>
          ))}
        </select>
        <div className="relative">
          <span className="material-symbols-outlined text-[18px] absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">search</span>
          <input
            type="text"
            placeholder="Search messages or reasons..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-3 py-2 bg-surface-light dark:bg-surface-highlight border border-border-light dark:border-border-dark rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none w-64"
          />
        </div>
        {!isLoading && (
          <div className="flex items-center gap-3 ml-auto text-sm text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-amber-500">warning</span>
              {warningCount} Warning
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-slate-400">info</span>
              {normalCount} Normal
            </span>
            <span className="text-slate-400 dark:text-slate-600">|</span>
            <span>{filteredEvents.length} total</span>
          </div>
        )}
      </div>

      {!isError && <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-surface-highlight/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 w-28">Type</th>
                <th className="px-6 py-4 w-40">Reason</th>
                <th className="px-6 py-4 w-64">Object</th>
                <th className="px-6 py-4">Message</th>
                <th className="px-6 py-4 w-20 text-center">Count</th>
                <th className="px-6 py-4 w-28 text-right">Last Seen</th>
                <th className="px-6 py-4 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => <EventRowSkeleton key={i} />)
              ) : paginatedEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <span className="material-symbols-outlined text-4xl text-slate-500 dark:text-slate-600 mb-2 block">event_note</span>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">No events found</p>
                  </td>
                </tr>
              ) : (
                paginatedEvents.map((event) => {
                  const lastSeen = event.lastTimestamp ?? event.metadata.creationTimestamp
                  const firstSeen = event.firstTimestamp ?? event.metadata.creationTimestamp
                  const objectNs = event.involvedObject.namespace ?? event.metadata.namespace
                  const linkPath = getResourceLinkPath(event.involvedObject.kind, event.involvedObject.name, objectNs)
                  const isExpanded = expandedRows.has(event.metadata.name)

                  return (
                    <tr
                      key={event.metadata.name}
                      className="group hover:bg-slate-50 dark:hover:bg-surface-hover/30 transition-colors cursor-pointer"
                      onClick={() => toggleRow(event.metadata.name)}
                    >
                      <td className="px-6 py-4 align-top">
                        <TypeBadge type={event.type} />
                      </td>
                      <td className="px-6 py-4 align-top font-semibold text-slate-800 dark:text-slate-200">
                        {event.reason}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-col gap-0.5">
                          {linkPath ? (
                            <Link
                              to="/resources/$"
                              params={{ _splat: linkPath }}
                              className="text-sm font-medium text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {event.involvedObject.kind.toLowerCase()}/{event.involvedObject.name}
                            </Link>
                          ) : (
                            <span className="text-sm font-medium text-primary">
                              {event.involvedObject.kind.toLowerCase()}/{event.involvedObject.name}
                            </span>
                          )}
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            namespace: {objectNs}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-slate-600 dark:text-slate-400 leading-relaxed" colSpan={isExpanded ? 1 : undefined}>
                        {isExpanded ? (
                          <div className="space-y-3">
                            <p className="whitespace-pre-wrap wrap-break-word">{event.message}</p>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 pt-2 border-t border-border-light dark:border-border-dark text-xs">
                              <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400">First seen</span>
                                <span className="font-mono text-slate-700 dark:text-slate-300">{relativeTime(firstSeen)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400">Last seen</span>
                                <span className="font-mono text-slate-700 dark:text-slate-300">{relativeTime(lastSeen)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400">Count</span>
                                <span className="font-medium text-slate-700 dark:text-slate-300">{event.count ?? 1}</span>
                              </div>
                              {event.source?.component && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500 dark:text-slate-400">Source</span>
                                  <span className="font-mono text-slate-700 dark:text-slate-300">{event.source.component}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400">Event</span>
                                <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[200px]" title={event.metadata.name}>{event.metadata.name}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="line-clamp-1">{event.message}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top font-medium text-center">
                        {event.count ?? 1}
                      </td>
                      <td className="px-6 py-4 align-top text-slate-500 dark:text-slate-400 text-right font-mono text-xs">
                        {relativeTime(lastSeen)}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-center gap-1">
                          {linkPath && (
                            <Link
                              to="/resources/$"
                              params={{ _splat: linkPath }}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-hover text-slate-400 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                              title="Inspect resource"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                            </Link>
                          )}
                          <span className={`material-symbols-outlined text-[18px] text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                            expand_more
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && filteredEvents.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-border-light dark:border-border-dark bg-slate-50 dark:bg-surface-highlight/30">
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              <span>
                Showing {startIndex + 1}-{endIndex} of {filteredEvents.length} events
              </span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="px-2 py-1 bg-surface-light dark:bg-surface-highlight border border-border-light dark:border-border-dark rounded text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size} per page</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <PaginationButton
                onClick={() => setCurrentPage(safePage - 1)}
                disabled={safePage <= 1}
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </PaginationButton>
              {visiblePages.map((page, idx) =>
                page === 'ellipsis' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">...</span>
                ) : (
                  <PaginationButton
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    active={page === safePage}
                  >
                    {page}
                  </PaginationButton>
                ),
              )}
              <PaginationButton
                onClick={() => setCurrentPage(safePage + 1)}
                disabled={safePage >= totalPages}
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </PaginationButton>
            </div>
          </div>
        )}
      </div>}
    </div>
  )
}
