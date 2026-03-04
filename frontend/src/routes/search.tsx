import { useState, useMemo, useCallback } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useResourceList } from '#/hooks/use-resource-list'
import { Breadcrumb } from '#/components/layout/Breadcrumb'
import { Skeleton } from '#/components/ui/skeleton'

type SearchParams = { q?: string }

export const Route = createFileRoute('/search')({
  component: SearchPage,
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
})

type KubeItem = Record<string, unknown>
type KubeMetadata = { name?: string; namespace?: string }

type SearchableResource = {
  group: string
  version: string
  name: string
  kind: string
  namespaced: boolean
  icon: string
}

const SEARCHABLE_RESOURCES: SearchableResource[] = [
  { group: '', version: 'v1', name: 'pods', kind: 'Pod', namespaced: true, icon: 'deployed_code' },
  { group: 'apps', version: 'v1', name: 'deployments', kind: 'Deployment', namespaced: true, icon: 'layers' },
  { group: '', version: 'v1', name: 'services', kind: 'Service', namespaced: true, icon: 'lan' },
  { group: '', version: 'v1', name: 'configmaps', kind: 'ConfigMap', namespaced: true, icon: 'settings' },
  { group: '', version: 'v1', name: 'secrets', kind: 'Secret', namespaced: true, icon: 'lock' },
  { group: 'networking.k8s.io', version: 'v1', name: 'ingresses', kind: 'Ingress', namespaced: true, icon: 'input' },
  { group: '', version: 'v1', name: 'namespaces', kind: 'Namespace', namespaced: false, icon: 'folder' },
  { group: 'batch', version: 'v1', name: 'jobs', kind: 'Job', namespaced: true, icon: 'work' },
  { group: 'batch', version: 'v1', name: 'cronjobs', kind: 'CronJob', namespaced: true, icon: 'schedule' },
  { group: 'apps', version: 'v1', name: 'statefulsets', kind: 'StatefulSet', namespaced: true, icon: 'view_column' },
  { group: 'apps', version: 'v1', name: 'daemonsets', kind: 'DaemonSet', namespaced: true, icon: 'select_all' },
  { group: '', version: 'v1', name: 'endpoints', kind: 'Endpoints', namespaced: true, icon: 'hub' },
  { group: '', version: 'v1', name: 'nodes', kind: 'Node', namespaced: false, icon: 'dns' },
  { group: '', version: 'v1', name: 'persistentvolumeclaims', kind: 'PersistentVolumeClaim', namespaced: true, icon: 'hard_drive' },
]

function SearchPage() {
  const { q } = Route.useSearch()
  const navigate = useNavigate()
  const [inputValue, setInputValue] = useState(q ?? '')

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = inputValue.trim()
    if (!trimmed) return
    navigate({ to: '/search', search: { q: trimmed } })
  }, [inputValue, navigate])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Breadcrumb items={[{ label: 'Cluster', href: '/' }, { label: 'Search' }]} />

      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Search</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Search across all resources in the cluster.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[20px] text-slate-500 pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search by name, namespace, kind..."
            autoFocus
            className="w-full pl-12 pr-4 py-3.5 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl text-slate-900 dark:text-white text-sm placeholder:text-slate-500 focus:ring-2 focus:ring-primary/50 focus:border-primary focus:outline-none transition-all"
          />
        </div>
      </form>

      {q ? (
        <div className="space-y-2">
          {SEARCHABLE_RESOURCES.map((res) => (
            <ResourceSearchGroup key={`${res.group}/${res.name}`} resource={res} query={q} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <span className="material-symbols-outlined text-5xl text-slate-500 dark:text-slate-600 mb-3 block">manage_search</span>
          <p className="text-slate-500 dark:text-slate-400">Enter a search term to find resources across the cluster.</p>
        </div>
      )}
    </div>
  )
}

function ResourceSearchGroup({ resource, query }: { resource: SearchableResource; query: string }) {
  const lowerQuery = query.toLowerCase()
  const { data, isLoading } = useResourceList({
    group: resource.group,
    version: resource.version,
    name: resource.name,
    namespaced: resource.namespaced,
  })

  const matches = useMemo(() => {
    const items = ((data as { items?: KubeItem[] })?.items ?? [])
    const results: Array<{ name: string; namespace?: string; splatPath: string }> = []

    for (const item of items) {
      const metadata = item.metadata as KubeMetadata | undefined
      if (!metadata?.name) continue

      const nameMatch = metadata.name.toLowerCase().includes(lowerQuery)
      const nsMatch = metadata.namespace?.toLowerCase().includes(lowerQuery) ?? false
      const kindMatch = resource.kind.toLowerCase().includes(lowerQuery)

      if (nameMatch || nsMatch || kindMatch) {
        const groupVersion = resource.group ? `${resource.group}/${resource.version}` : resource.version
        const splatPath = metadata.namespace
          ? `${groupVersion}/${resource.name}/${metadata.namespace}/${metadata.name}`
          : `${groupVersion}/${resource.name}/${metadata.name}`

        results.push({ name: metadata.name, namespace: metadata.namespace, splatPath })
      }
    }

    return results.slice(0, 20)
  }, [data, lowerQuery, resource])

  if (isLoading) {
    return (
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-4">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  if (matches.length === 0) return null

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
      <div className="px-5 py-3 border-b border-border-light dark:border-border-dark flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-primary">
          {resource.icon}
        </span>
        <span className="text-sm font-bold text-slate-900 dark:text-white">{resource.kind}</span>
        <span className="text-xs text-slate-500 ml-1">({matches.length})</span>
      </div>
      <div className="divide-y divide-border-light dark:divide-border-dark">
        {matches.map((result) => (
          <Link
            key={result.splatPath}
            to="/resources/$"
            params={{ _splat: result.splatPath }}
            className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-surface-hover/50 transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm font-medium text-primary group-hover:text-primary/80 truncate">
                {result.name}
              </span>
              {result.namespace && (
                <span className="text-xs text-slate-500 shrink-0">
                  {result.namespace}
                </span>
              )}
            </div>
            <span className="material-symbols-outlined text-[16px] text-slate-500 dark:text-slate-600 group-hover:text-slate-400 transition-colors shrink-0">
              chevron_right
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
