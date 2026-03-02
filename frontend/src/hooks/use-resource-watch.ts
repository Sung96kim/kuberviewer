import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { usePageVisible } from '#/hooks/use-page-visible'

type WatchParams = {
  group: string
  version: string
  name: string
  namespaced: boolean
  namespace?: string
  resourceVersion?: string
}

type WatchEvent = {
  type: 'ADDED' | 'MODIFIED' | 'DELETED'
  object: Record<string, unknown>
}

type KubeList = {
  items?: Record<string, unknown>[]
  metadata?: { resourceVersion?: string }
}

function getItemName(item: Record<string, unknown>): string {
  const metadata = item.metadata as { name?: string; namespace?: string } | undefined
  return `${metadata?.namespace ?? ''}/${metadata?.name ?? ''}`
}

export function useResourceWatch(
  params: WatchParams & { limit?: number },
  enabled: boolean,
) {
  const queryClient = useQueryClient()
  const eventSourceRef = useRef<EventSource | null>(null)
  const pageVisible = usePageVisible()

  const { group, version, name, namespaced, namespace, limit } = params

  useEffect(() => {
    if (!enabled || !pageVisible) return

    const queryKey = ['resources', group, version, name, namespace, limit]

    const qs = new URLSearchParams({
      group,
      version,
      name,
      namespaced: String(namespaced),
    })
    if (namespace) qs.set('namespace', namespace)

    const cached = queryClient.getQueryData<KubeList>(queryKey)
    if (cached?.metadata?.resourceVersion) {
      qs.set('resourceVersion', cached.metadata.resourceVersion)
    }

    const es = new EventSource(`/api/watch?${qs}`)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const watchEvent: WatchEvent = JSON.parse(event.data)
        const obj = watchEvent.object
        const objKey = getItemName(obj)

        queryClient.setQueryData<KubeList>(queryKey, (old) => {
          if (!old?.items) return old
          const items = [...old.items]

          switch (watchEvent.type) {
            case 'ADDED': {
              const exists = items.some((item) => getItemName(item) === objKey)
              if (!exists) items.push(obj)
              break
            }
            case 'MODIFIED': {
              const idx = items.findIndex((item) => getItemName(item) === objKey)
              if (idx >= 0) items[idx] = obj
              else items.push(obj)
              break
            }
            case 'DELETED': {
              const delIdx = items.findIndex((item) => getItemName(item) === objKey)
              if (delIdx >= 0) items.splice(delIdx, 1)
              break
            }
          }

          return { ...old, items }
        })
      } catch {
        // ignore malformed events
      }
    }

    es.onerror = () => {
      es.close()
      eventSourceRef.current = null
    }

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [enabled, pageVisible, group, version, name, namespaced, namespace, limit, queryClient])

  return { connected: eventSourceRef.current?.readyState === EventSource.OPEN }
}
