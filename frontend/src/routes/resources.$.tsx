import { useState, useMemo, useCallback, startTransition } from 'react'
import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useAPIResources } from '#/hooks/use-api-resources'
import { useResourceList } from '#/hooks/use-resource-list'
import { useSettings } from '#/hooks/use-settings'
import { getColumnsForKind, parseResourcePath, precomputePodRows } from '#/lib/resource-helpers'
import { ResourceTable } from '#/components/resources/ResourceTable'
import { ResourceDetail } from '#/components/resources/ResourceDetail'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/components/ui/command'
import { Breadcrumb } from '#/components/layout/Breadcrumb'
import { PodInspectModal } from '#/components/detail-tabs/PodInspectModal'
import type { ResourceDefinition } from '#/types'
import type { Row } from '@tanstack/react-table'

type SearchParams = { ns?: string }

export const Route = createFileRoute('/resources/$')({
  component: ResourceSplatPage,
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    ns: typeof search.ns === 'string' ? search.ns : undefined,
  }),
})

type KubeItem = Record<string, unknown>

type KubeListResponse = {
  items?: KubeItem[]
  metadata?: {
    continue?: string
    resourceVersion?: string
  }
}

function findResourceDefinition(
  resources: ResourceDefinition[],
  group: string,
  version: string,
  resourceName: string,
): ResourceDefinition | undefined {
  return resources.find(
    (r) => r.group === group && r.version === version && r.name === resourceName,
  )
}

function ResourceSplatPage() {
  const params = useParams({ from: '/resources/$' })
  const { ns } = Route.useSearch()
  const splatPath = (params as Record<string, string>)._splat ?? ''
  const parsed = parseResourcePath(splatPath)

  if (!parsed) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center py-20">
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-slate-500 dark:text-slate-600 mb-4 block">
            error
          </span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Invalid Resource Path</h2>
          <p className="text-slate-500 dark:text-slate-400">
            The URL does not match a valid resource path.
          </p>
        </div>
      </div>
    )
  }

  if (parsed.type === 'detail') {
    return <ResourceDetailPage group={parsed.group} version={parsed.version} resourceName={parsed.resourceName} namespace={parsed.namespace} name={parsed.name} />
  }

  return <ResourceListView group={parsed.group} version={parsed.version} resourceName={parsed.resourceName} filterNamespace={ns} />
}

type ResourceListViewProps = {
  group: string
  version: string
  resourceName: string
  filterNamespace?: string
}

function getPodGroupAggregate(rows: Row<KubeItem>[]) {
  const statusCounts: Record<string, number> = {}
  let totalRestarts = 0

  for (const row of rows) {
    const computed = row.original._computed as { phase: string; restarts: number } | undefined
    const phase = computed?.phase ?? 'Unknown'
    statusCounts[phase] = (statusCounts[phase] ?? 0) + 1
    totalRestarts += computed?.restarts ?? 0
  }

  return { label: '', statusCounts, totalRestarts }
}

function NamespaceFilter({
  allNamespaces,
  selected,
  onToggle,
}: {
  allNamespaces: string[]
  selected: Set<string>
  onToggle: (ns: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:bg-slate-50 dark:hover:bg-surface-hover transition-colors text-sm">
          <span className="material-symbols-outlined text-[18px] text-slate-400">filter_alt</span>
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {selected.size === allNamespaces.length ? 'All namespaces' : `${selected.size} namespace${selected.size !== 1 ? 's' : ''}`}
          </span>
          <span className="material-symbols-outlined text-[16px] text-slate-400">expand_more</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Search namespaces..." />
          <CommandList>
            <CommandEmpty>No namespaces found.</CommandEmpty>
            <CommandGroup>
              {allNamespaces.map((ns) => {
                const isSelected = selected.has(ns)
                return (
                  <CommandItem
                    key={ns}
                    value={ns}
                    onSelect={() => onToggle(ns)}
                  >
                    <span className={`material-symbols-outlined text-[16px] ${isSelected ? 'text-primary' : 'text-transparent'}`}>
                      check
                    </span>
                    <span className="truncate">{ns}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function ResourceListView({ group, version, resourceName, filterNamespace }: ResourceListViewProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { settings } = useSettings()
  const [hasExpandedRows, setHasExpandedRows] = useState(false)
  const [inspectPod, setInspectPod] = useState<{ namespace: string; name: string } | null>(null)
  const { data: apiData, isLoading: apiLoading } = useAPIResources()
  const allResources = apiData?.resources ?? []

  const resourceDef = useMemo(() => {
    return findResourceDefinition(allResources, group, version, resourceName)
  }, [allResources, group, version, resourceName])

  const kind = resourceDef?.kind ?? ''
  const isPod = kind === 'Pod'
  const isNamespaced = resourceDef?.namespaced ?? true

  const listQuery = useResourceList({
    group,
    version,
    name: resourceName,
    namespaced: isNamespaced,
    namespace: filterNamespace,
    limit: isPod ? 2000 : undefined,
    watch: hasExpandedRows,
  })
  const columns = useMemo(() => getColumnsForKind(kind), [kind])

  const listData = listQuery.data as KubeListResponse | undefined
  const allItems: KubeItem[] = listData?.items ?? []
  const isLoading = apiLoading || listQuery.isLoading
  const listError = listQuery.isError ? listQuery.error : null
  const listMeta = listData?.metadata as { continue?: string } | undefined
  const isTruncated = isPod && !!listMeta?.continue

  const allNamespaces = useMemo(() => {
    if (!isPod) return []
    const nsSet = new Set<string>()
    for (const item of allItems) {
      const ns = ((item.metadata ?? {}) as { namespace?: string }).namespace
      if (ns) nsSet.add(ns)
    }
    return Array.from(nsSet).sort()
  }, [allItems, isPod])

  const [selectedNamespaces, setSelectedNamespaces] = useState<Set<string> | null>(null)

  const effectiveNamespaces = useMemo(() => {
    if (!isPod) return null
    if (selectedNamespaces) return selectedNamespaces
    const defaultNs = settings.defaultNamespace || 'default'
    if (allNamespaces.includes(defaultNs)) return new Set([defaultNs])
    if (allNamespaces.length > 0) return new Set([allNamespaces[0]])
    return new Set<string>()
  }, [isPod, selectedNamespaces, allNamespaces, settings.defaultNamespace])

  const items = useMemo(() => {
    if (!isPod) return allItems
    if (filterNamespace) return precomputePodRows(allItems)
    if (!effectiveNamespaces) return allItems
    const filtered = allItems.filter((item) => {
      const ns = ((item.metadata ?? {}) as { namespace?: string }).namespace
      return ns ? effectiveNamespaces.has(ns) : false
    })
    return precomputePodRows(filtered)
  }, [allItems, isPod, effectiveNamespaces, filterNamespace])

  const renderPodAction = useCallback((item: KubeItem) => {
    const metadata = item.metadata as { name?: string; namespace?: string } | undefined
    if (!metadata?.name || !metadata?.namespace) return null
    return (
      <button
        onClick={() => setInspectPod({ namespace: metadata.namespace!, name: metadata.name! })}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
        title="Inspect pod"
      >
        <span className="material-symbols-outlined text-[16px]">visibility</span>
      </button>
    )
  }, [])

  const handleToggleNamespace = useCallback((ns: string) => {
    setSelectedNamespaces((prev) => {
      const current = prev ?? effectiveNamespaces ?? new Set<string>()
      const next = new Set(current)
      if (next.has(ns)) {
        next.delete(ns)
      } else {
        next.add(ns)
      }
      return next
    })
  }, [])

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ['resources', group, version, resourceName],
    })
  }, [queryClient, group, version, resourceName])

  const handleRowClick = useCallback((item: KubeItem) => {
    const metadata = item.metadata as { name?: string; namespace?: string } | undefined
    if (!metadata?.name) return

    const groupVersion = group ? `${group}/${version}` : version
    const splatValue = metadata.namespace
      ? `${groupVersion}/${resourceName}/${metadata.namespace}/${metadata.name}`
      : `${groupVersion}/${resourceName}/${metadata.name}`
    startTransition(() => {
      navigate({ to: '/resources/$', params: { _splat: splatValue } })
    })
  }, [group, version, resourceName, navigate])

  const breadcrumbs = useMemo(() => {
    const items: Array<{ label: string; href?: string }> = [
      { label: 'Cluster', href: '/' },
    ]
    if (filterNamespace) {
      items.push({ label: filterNamespace, href: `/namespaces_/${filterNamespace}` })
    }
    items.push({ label: kind || resourceName })
    return items
  }, [kind, resourceName, filterNamespace])

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Breadcrumb items={breadcrumbs} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              {kind || resourceName}
            </h1>
            {!isLoading && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                {items.length}
              </span>
            )}
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            {group ? `${group}/${version}` : version}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {filterNamespace && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-sm">
              <span className="material-symbols-outlined text-[16px] text-primary">folder</span>
              <span className="font-medium text-primary">{filterNamespace}</span>
              <button
                onClick={() => navigate({ to: '/resources/$', params: { _splat: `${group ? `${group}/` : ''}${version}/${resourceName}` }, search: {} })}
                className="ml-1 p-0.5 rounded hover:bg-primary/20 text-primary/60 hover:text-primary transition-colors"
                title="Show all namespaces"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
          )}
          {isPod && !filterNamespace && allNamespaces.length > 0 && (
            <NamespaceFilter
              allNamespaces={allNamespaces}
              selected={effectiveNamespaces ?? new Set()}
              onToggle={handleToggleNamespace}
            />
          )}
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-hover transition-colors text-sm font-medium shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {listError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-red-500 text-2xl">error</span>
          <div>
            <p className="font-medium text-red-200">Failed to load resources</p>
            <p className="text-sm text-red-300/80 mt-1">{listError instanceof Error ? listError.message : String(listError)}</p>
            <button
              onClick={handleRefresh}
              className="mt-3 text-sm font-medium text-red-400 hover:text-red-300"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {isTruncated && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Showing first 2,000 pods. Use namespace filter to narrow results.
        </p>
      )}

      {!listError && (
      <ResourceTable
        data={items}
        columns={columns}
        isLoading={isLoading}
        onRowClick={handleRowClick}
        groupByColumn={isPod ? 'podPrefix' : undefined}
        getGroupAggregate={isPod ? getPodGroupAggregate : undefined}
        onExpandedChange={setHasExpandedRows}
        renderRowAction={isPod ? renderPodAction : undefined}
      />
      )}

      {inspectPod && (
        <PodInspectModal
          open={!!inspectPod}
          onOpenChange={(open) => { if (!open) setInspectPod(null) }}
          namespace={inspectPod.namespace}
          podName={inspectPod.name}
        />
      )}
    </div>
  )
}

type ResourceDetailPageProps = {
  group: string
  version: string
  resourceName: string
  namespace?: string
  name: string
}

function ResourceDetailPage({ group, version, resourceName, namespace, name }: ResourceDetailPageProps) {
  const { data: apiData } = useAPIResources()
  const allResources = apiData?.resources ?? []

  const resourceDef = useMemo(() => {
    return findResourceDefinition(allResources, group, version, resourceName)
  }, [allResources, group, version, resourceName])

  const kind = resourceDef?.kind ?? resourceName
  const namespaced = resourceDef?.namespaced ?? !!namespace
  const groupVersion = group ? `${group}/${version}` : version
  const listSplat = `${groupVersion}/${resourceName}`

  const breadcrumbs = useMemo(() => [
    { label: 'Cluster', href: '/' },
    { label: kind, href: `/resources/${listSplat}` },
    ...(namespace ? [{ label: namespace, href: `/namespaces/${namespace}` }] : []),
    { label: name },
  ], [kind, listSplat, namespace, name])

  return (
    <div className="max-w-7xl mx-auto">
      <Breadcrumb items={breadcrumbs} />
      <ResourceDetail
        group={group}
        version={version}
        resourceType={resourceName}
        name={name}
        namespaced={namespaced}
        namespace={namespace}
      />
    </div>
  )
}
