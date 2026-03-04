import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useResourceList } from '#/hooks/use-resource-list'
import { useSettings } from '#/hooks/use-settings'
import { relativeTime } from '#/lib/time'
import { Popover, PopoverTrigger, PopoverContent } from '#/components/ui/popover'
import { Button } from '#/components/ui/button'

type KubeEvent = {
  metadata: { name: string; namespace: string; creationTimestamp: string; uid: string }
  type: string
  reason: string
  message: string
  count?: number
  lastTimestamp?: string
  firstTimestamp?: string
  involvedObject: { kind: string; name: string; namespace?: string }
}

type KubePod = {
  metadata: { name: string; namespace: string; creationTimestamp: string; uid: string }
  status: {
    phase: string
    containerStatuses?: Array<{ name: string; state?: { waiting?: { reason?: string } } }>
    initContainerStatuses?: Array<{ name: string; state?: { waiting?: { reason?: string } } }>
  }
}

const BAD_REASONS = new Set([
  'CrashLoopBackOff', 'ImagePullBackOff', 'ErrImagePull',
  'CreateContainerError', 'RunContainerError', 'OOMKilled',
])

const PENDING_THRESHOLD_MS = 5 * 60 * 1000

function getBadReason(pod: KubePod): string | null {
  const phase = pod.status?.phase
  if (phase === 'Failed') return 'Failed'

  const allStatuses = [
    ...(pod.status?.containerStatuses ?? []),
    ...(pod.status?.initContainerStatuses ?? []),
  ]
  for (const cs of allStatuses) {
    const reason = cs.state?.waiting?.reason
    if (reason && BAD_REASONS.has(reason)) return reason
  }

  if (phase === 'Pending') {
    const created = new Date(pod.metadata?.creationTimestamp).getTime()
    if (Date.now() - created > PENDING_THRESHOLD_MS) return 'Pending'
  }

  return null
}

function getResourceLinkPath(kind: string, name: string, namespace?: string): string {
  const kindMap: Record<string, { group: string; version: string; resource: string }> = {
    Pod: { group: '', version: 'v1', resource: 'pods' },
    Deployment: { group: 'apps', version: 'v1', resource: 'deployments' },
    ReplicaSet: { group: 'apps', version: 'v1', resource: 'replicasets' },
    Service: { group: '', version: 'v1', resource: 'services' },
    StatefulSet: { group: 'apps', version: 'v1', resource: 'statefulsets' },
    DaemonSet: { group: 'apps', version: 'v1', resource: 'daemonsets' },
    Job: { group: 'batch', version: 'v1', resource: 'jobs' },
    CronJob: { group: 'batch', version: 'v1', resource: 'cronjobs' },
    Node: { group: '', version: 'v1', resource: 'nodes' },
  }
  const mapping = kindMap[kind]
  if (!mapping) return ''
  const groupVersion = mapping.group ? `${mapping.group}/${mapping.version}` : mapping.version
  return namespace
    ? `${groupVersion}/${mapping.resource}/${namespace}/${name}`
    : `${groupVersion}/${mapping.resource}/${name}`
}

function getReasonColor(reason: string): string {
  switch (reason) {
    case 'CrashLoopBackOff':
    case 'OOMKilled':
    case 'Failed':
      return 'bg-red-500'
    case 'ImagePullBackOff':
    case 'ErrImagePull':
    case 'CreateContainerError':
    case 'RunContainerError':
      return 'bg-amber-500'
    case 'Pending':
      return 'bg-yellow-500'
    default:
      return 'bg-slate-500'
  }
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const { settings } = useSettings()

  const { data: eventsData } = useResourceList({
    group: '',
    version: 'v1',
    name: 'events',
    namespaced: false,
  })

  const { data: podsData } = useResourceList({
    group: '',
    version: 'v1',
    name: 'pods',
    namespaced: false,
  })

  const healthyPodKeys = useMemo(() => {
    const pods = (podsData?.items ?? []) as unknown as KubePod[]
    const keys = new Set<string>()
    for (const pod of pods) {
      if (getBadReason(pod) === null) {
        keys.add(`${pod.metadata.namespace}/${pod.metadata.name}`)
      }
    }
    return keys
  }, [podsData])

  const allPodKeys = useMemo(() => {
    const pods = (podsData?.items ?? []) as unknown as KubePod[]
    const keys = new Set<string>()
    for (const pod of pods) {
      keys.add(`${pod.metadata.namespace}/${pod.metadata.name}`)
    }
    return keys
  }, [podsData])

  const warningEvents = useMemo(() => {
    const events = (eventsData?.items ?? []) as unknown as KubeEvent[]
    const cutoff = Date.now() - settings.notificationWindowMinutes * 60 * 1000
    return events
      .filter(e => e.type === 'Warning')
      .filter(e => {
        const ts = e.lastTimestamp || e.metadata?.creationTimestamp
        return ts ? new Date(ts).getTime() > cutoff : false
      })
      .filter(e => {
        if (e.involvedObject.kind === 'Pod') {
          const key = `${e.involvedObject.namespace ?? e.metadata.namespace}/${e.involvedObject.name}`
          if (healthyPodKeys.has(key) || !allPodKeys.has(key)) return false
        }
        return true
      })
      .filter(e => !dismissedIds.has(e.metadata?.uid))
      .sort((a, b) => {
        const aTs = new Date(a.lastTimestamp || a.metadata?.creationTimestamp).getTime()
        const bTs = new Date(b.lastTimestamp || b.metadata?.creationTimestamp).getTime()
        return bTs - aTs
      })
      .slice(0, 50)
  }, [eventsData, dismissedIds, healthyPodKeys, allPodKeys, settings.notificationWindowMinutes])

  const badPods = useMemo(() => {
    const pods = (podsData?.items ?? []) as unknown as KubePod[]
    return pods
      .map(pod => ({ pod, reason: getBadReason(pod) }))
      .filter((entry): entry is { pod: KubePod; reason: string } => entry.reason !== null)
      .filter(entry => !dismissedIds.has(entry.pod.metadata?.uid))
  }, [podsData, dismissedIds])

  const notificationsDisabled = !settings.notificationsEnabled
  const totalCount = notificationsDisabled ? 0 : badPods.length + warningEvents.length

  const handleClear = () => {
    const ids = new Set(dismissedIds)
    for (const e of warningEvents) ids.add(e.metadata?.uid)
    for (const { pod } of badPods) ids.add(pod.metadata?.uid)
    setDismissedIds(ids)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-hover text-slate-500 dark:text-slate-400 transition-colors"
          title="Notifications"
        >
          <span className="material-symbols-outlined">notifications</span>
          {totalCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none animate-in fade-in zoom-in duration-200">
              {totalCount > 99 ? '99+' : totalCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[400px] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-light dark:border-border-dark">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {totalCount > 0 && (
            <Button variant="ghost" size="xs" onClick={handleClear} className="text-xs text-slate-500">
              Clear all
            </Button>
          )}
        </div>

        <div className="max-h-[500px] overflow-y-auto">
          {notificationsDisabled && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
              <span className="material-symbols-outlined text-[32px] mb-2">notifications_off</span>
              <p className="text-sm font-medium">Notifications disabled</p>
              <p className="text-xs mt-0.5">Enable in Settings</p>
            </div>
          )}
          {!notificationsDisabled && totalCount === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
              <span className="material-symbols-outlined text-[32px] mb-2">check_circle</span>
              <p className="text-sm font-medium">All clear</p>
              <p className="text-xs mt-0.5">No warnings or issues detected</p>
            </div>
          )}

          {badPods.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-slate-50 dark:bg-background-dark/50 border-b border-border-light dark:border-border-dark">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] text-amber-500">warning</span>
                  Pod Issues ({badPods.length})
                </span>
              </div>
              {badPods.map(({ pod, reason }) => {
                const linkPath = getResourceLinkPath('Pod', pod.metadata.name, pod.metadata.namespace)
                return (
                  <Link
                    key={pod.metadata.uid}
                    to="/resources/$"
                    params={{ _splat: linkPath }}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-surface-hover/50 transition-colors border-b border-border-light dark:border-border-dark last:border-b-0"
                  >
                    <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${getReasonColor(reason)}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{pod.metadata.name}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 dark:text-red-400 shrink-0">
                          {reason}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {pod.metadata.namespace} · {relativeTime(pod.metadata.creationTimestamp)}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          {warningEvents.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-slate-50 dark:bg-background-dark/50 border-b border-border-light dark:border-border-dark">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] text-amber-500">warning</span>
                  Warning Events ({warningEvents.length})
                </span>
              </div>
              {warningEvents.map((event) => {
                const linkPath = getResourceLinkPath(
                  event.involvedObject.kind,
                  event.involvedObject.name,
                  event.involvedObject.namespace,
                )
                const ts = event.lastTimestamp || event.metadata?.creationTimestamp
                const content = (
                  <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-surface-hover/50 transition-colors border-b border-border-light dark:border-border-dark last:border-b-0">
                    <span className="material-symbols-outlined text-[16px] text-amber-500 mt-0.5 shrink-0">error</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-amber-500 dark:text-amber-400">{event.reason}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 truncate">
                          {event.involvedObject.kind.toLowerCase()}/{event.involvedObject.name}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{event.message}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                        {event.involvedObject.namespace && <span>{event.involvedObject.namespace}</span>}
                        {ts && <span>· {relativeTime(ts)}</span>}
                        {event.count && event.count > 1 && <span>· {event.count}x</span>}
                      </div>
                    </div>
                  </div>
                )

                if (linkPath) {
                  return (
                    <Link
                      key={event.metadata.uid}
                      to="/resources/$"
                      params={{ _splat: linkPath }}
                      onClick={() => setOpen(false)}
                    >
                      {content}
                    </Link>
                  )
                }
                return <div key={event.metadata.uid}>{content}</div>
              })}
            </div>
          )}
        </div>

        {totalCount > 0 && (
          <div className="px-4 py-2.5 border-t border-border-light dark:border-border-dark">
            <Link
              to="/events"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              View all events
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
