import { useQuery } from '@tanstack/react-query'
import { api } from '#/api'
import { useResourceWatch } from '#/hooks/use-resource-watch'

type ResourceListParams = {
  group: string
  version: string
  name: string
  namespaced: boolean
  namespace?: string
  limit?: number
  labelSelector?: string
  fieldSelector?: string
  continueToken?: string
  watch?: boolean
}

type KubeList = {
  items?: Record<string, unknown>[]
  metadata?: Record<string, unknown>
  [key: string]: unknown
}

function getItemKey(item: Record<string, unknown>): string {
  const metadata = item.metadata as { name?: string; namespace?: string } | undefined
  return `${metadata?.namespace ?? ''}/${metadata?.name ?? ''}`
}

function stableMerge(oldData: KubeList | undefined, newData: KubeList): KubeList {
  if (!oldData?.items || !newData?.items) return newData

  const oldItems = oldData.items
  const newItems = newData.items

  if (oldItems.length === newItems.length) {
    let identical = true
    for (let i = 0; i < oldItems.length; i++) {
      const oldMeta = (oldItems[i].metadata ?? {}) as { resourceVersion?: string; name?: string; namespace?: string }
      const newMeta = (newItems[i].metadata ?? {}) as { resourceVersion?: string; name?: string; namespace?: string }
      if (oldMeta.name !== newMeta.name || oldMeta.namespace !== newMeta.namespace || oldMeta.resourceVersion !== newMeta.resourceVersion) {
        identical = false
        break
      }
    }
    if (identical) return oldData
  }

  const newItemMap = new Map<string, Record<string, unknown>>()
  for (const item of newItems) {
    newItemMap.set(getItemKey(item), item)
  }

  const merged: Record<string, unknown>[] = []

  for (const oldItem of oldItems) {
    const key = getItemKey(oldItem)
    const newItem = newItemMap.get(key)
    if (newItem) {
      merged.push(newItem)
      newItemMap.delete(key)
    }
  }

  for (const newItem of newItemMap.values()) {
    merged.push(newItem)
  }

  return { ...newData, items: merged }
}

export function useResourceList(params: ResourceListParams) {
  const shouldWatch = params.watch ?? false

  const query = useQuery({
    queryKey: ['resources', params.group, params.version, params.name, params.namespace, params.limit, params.labelSelector, params.fieldSelector],
    queryFn: () => api.listResources(params),
    refetchInterval: shouldWatch ? 30_000 : 10_000,
    structuralSharing: stableMerge as (oldData: unknown, newData: unknown) => unknown,
  })

  useResourceWatch(
    {
      group: params.group,
      version: params.version,
      name: params.name,
      namespaced: params.namespaced,
      namespace: params.namespace,
      limit: params.limit,
    },
    shouldWatch && !query.isLoading && !query.isError,
  )

  return query
}
