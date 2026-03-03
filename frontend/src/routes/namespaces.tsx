import { useState, useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useResourceList } from '#/hooks/use-resource-list'
import { relativeTime } from '#/lib/time'
import { Skeleton } from '#/components/ui/skeleton'
import { RefetchIndicator } from '#/components/ui/refetch-indicator'
import { PollingSettings } from '#/components/ui/polling-settings'
import { QueryError } from '#/components/QueryError'
import { Breadcrumb } from '#/components/layout/Breadcrumb'

export const Route = createFileRoute('/namespaces')({ component: NamespacesPage })

type KubeNamespace = {
  metadata: {
    name: string
    creationTimestamp: string
    labels?: Record<string, string>
  }
  status: {
    phase: string
  }
}

type KubeListResponse = {
  items?: KubeNamespace[]
}

type StatusFilter = 'All' | 'Active' | 'Terminating'

const PAGE_SIZE = 10

function getStatusBadge(phase: string) {
  if (phase === 'Active') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        Active
      </span>
    )
  }
  if (phase === 'Terminating') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
        Terminating
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
      {phase}
    </span>
  )
}

function getNamespaceIcon(name: string): { bg: string; icon: string; color: string; subtitle: string } {
  if (name.startsWith('kube-')) return { bg: 'bg-purple-500/20', icon: 'settings_system_daydream', color: 'text-purple-400', subtitle: 'System namespace' }
  if (name === 'default') return { bg: 'bg-primary/20', icon: 'folder_open', color: 'text-primary', subtitle: 'Default namespace' }
  if (name.includes('monitoring') || name.includes('observability')) return { bg: 'bg-blue-500/20', icon: 'monitoring', color: 'text-blue-400', subtitle: 'Monitoring & observability' }
  if (name.includes('ingress') || name.includes('nginx') || name.includes('gateway')) return { bg: 'bg-orange-500/20', icon: 'router', color: 'text-orange-400', subtitle: 'Networking & ingress' }
  if (name.includes('dev') || name.includes('staging')) return { bg: 'bg-pink-500/20', icon: 'code', color: 'text-pink-400', subtitle: 'Development environment' }
  return { bg: 'bg-slate-500/20', icon: 'folder', color: 'text-slate-400', subtitle: 'Application namespace' }
}

function NamespaceRowSkeleton() {
  return (
    <tr>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </td>
      <td className="px-6 py-4"><Skeleton className="h-5 w-16 rounded-full" /></td>
      <td className="px-6 py-4"><Skeleton className="h-5 w-32" /></td>
      <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
      <td className="px-6 py-4"><Skeleton className="size-6 rounded" /></td>
    </tr>
  )
}

function PaginationButton({ children, active, disabled, onClick }: {
  children: React.ReactNode
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`
        inline-flex items-center justify-center min-w-[2rem] h-8 px-2.5 text-sm font-medium rounded-lg transition-colors
        ${active
          ? 'bg-primary text-white'
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
        }
        ${disabled ? 'opacity-40 pointer-events-none' : 'cursor-pointer'}
      `}
    >
      {children}
    </button>
  )
}

function buildPageNumbers(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
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

function NamespacesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [currentPage, setCurrentPage] = useState(1)

  const queryClient = useQueryClient()
  const { data, isLoading, isError, error, isFetching } = useResourceList({
    group: '',
    version: 'v1',
    name: 'namespaces',
    namespaced: false,
  })

  const listData = data as KubeListResponse | undefined
  const namespaces: KubeNamespace[] = (listData?.items ?? []) as KubeNamespace[]
  const activeCount = namespaces.filter((ns) => ns.status?.phase === 'Active').length

  const filteredNamespaces = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    return namespaces
      .filter((ns) => {
        if (statusFilter !== 'All' && ns.status?.phase !== statusFilter) return false
        if (!query) return true
        const name = ns.metadata.name.toLowerCase()
        const labels = Object.entries(ns.metadata.labels ?? {})
          .map(([k, v]) => `${k}=${v}`.toLowerCase())
          .join(' ')
        const phase = ns.status?.phase?.toLowerCase() ?? ''
        return name.includes(query) || labels.includes(query) || phase.includes(query)
      })
  }, [namespaces, searchQuery, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredNamespaces.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedNamespaces = filteredNamespaces.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  )
  const showingFrom = filteredNamespaces.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const showingTo = Math.min(safePage * PAGE_SIZE, filteredNamespaces.length)

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setCurrentPage(1)
  }

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value as StatusFilter)
    setCurrentPage(1)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Breadcrumb items={[{ label: 'Cluster', href: '/' }, { label: 'Namespaces' }]} />
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Namespaces</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage and monitor the virtual clusters within your environment.
          </p>
        </div>
        <PollingSettings />
      </div>

      {isError && (
        <QueryError error={error} onRetry={() => queryClient.invalidateQueries({ queryKey: ['resources', '', 'v1', 'namespaces'] })} />
      )}

      {!isLoading && !isError && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Total</span>
              <p className="text-2xl font-bold">{namespaces.length}</p>
            </div>
            <div className="size-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              <span className="material-symbols-outlined">layers</span>
            </div>
          </div>
          <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Active</span>
              <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
            </div>
            <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <span className="material-symbols-outlined">check_circle</span>
            </div>
          </div>
        </div>
      )}

      {!isError && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full sm:max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-400 pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Filter namespaces by name, label or status..."
              className="w-full pl-10 pr-3 py-2 bg-surface-light dark:bg-slate-800 border border-border-light dark:border-border-dark rounded-lg text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="px-3 py-2 bg-surface-light dark:bg-slate-800 border border-border-light dark:border-border-dark rounded-lg text-sm font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Terminating">Terminating</option>
          </select>
          {!isLoading && (
            <span className="text-sm text-slate-500 dark:text-slate-400 ml-auto whitespace-nowrap flex items-center gap-1.5">
              <RefetchIndicator fetching={isFetching} />
              {filteredNamespaces.length} result{filteredNamespaces.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {!isError && (
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Labels</th>
                  <th className="px-6 py-4">Age</th>
                  <th className="px-6 py-4 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => <NamespaceRowSkeleton key={i} />)
                ) : paginatedNamespaces.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <span className="material-symbols-outlined text-4xl text-slate-500 dark:text-slate-600 mb-2 block">
                        {searchQuery || statusFilter !== 'All' ? 'search_off' : 'layers'}
                      </span>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">
                        {searchQuery || statusFilter !== 'All'
                          ? 'No namespaces match your filters'
                          : 'No namespaces found'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedNamespaces.map((ns) => {
                    const icon = getNamespaceIcon(ns.metadata.name)
                    const labels = ns.metadata.labels ?? {}
                    const displayLabels = Object.entries(labels)
                      .filter(([k]) => !k.startsWith('kubernetes.io/'))
                      .slice(0, 3)

                    return (
                      <tr key={ns.metadata.name} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`shrink-0 size-10 ${icon.bg} rounded-lg flex items-center justify-center ${icon.color}`}>
                              <span className="material-symbols-outlined text-[20px] leading-none">{icon.icon}</span>
                            </div>
                            <div className="min-w-0">
                              <Link
                                to="/namespaces/$name"
                                params={{ name: ns.metadata.name }}
                                className="block font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors truncate"
                              >
                                {ns.metadata.name}
                              </Link>
                              <span className="text-xs text-slate-500 dark:text-slate-400">{icon.subtitle}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">{getStatusBadge(ns.status?.phase ?? 'Unknown')}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {displayLabels.map(([k, v]) => (
                              <span
                                key={k}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-border-light dark:border-border-dark"
                              >
                                {k}={v}
                              </span>
                            ))}
                            {displayLabels.length === 0 && (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                          {relativeTime(ns.metadata.creationTimestamp)}
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            to="/namespaces/$name"
                            params={{ name: ns.metadata.name }}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors opacity-0 group-hover:opacity-100"
                            title="View details"
                          >
                            <span className="material-symbols-outlined text-[18px]">more_vert</span>
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {!isLoading && filteredNamespaces.length > PAGE_SIZE && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-border-light dark:border-border-dark">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Showing {showingFrom} to {showingTo} of {filteredNamespaces.length} results
              </span>
              <div className="flex items-center gap-1">
                <PaginationButton
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage(safePage - 1)}
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </PaginationButton>
                {buildPageNumbers(safePage, totalPages).map((page, idx) =>
                  page === 'ellipsis' ? (
                    <span key={`ellipsis-${idx}`} className="px-1 text-slate-400">...</span>
                  ) : (
                    <PaginationButton
                      key={page}
                      active={page === safePage}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </PaginationButton>
                  ),
                )}
                <PaginationButton
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage(safePage + 1)}
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </PaginationButton>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
