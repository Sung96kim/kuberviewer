import { useState, useMemo, memo, useCallback } from 'react'
import { Link } from '@tanstack/react-router'
import { useAPIResources } from '#/hooks/use-api-resources'
import { usePrometheusStatus } from '#/hooks/use-prometheus'
import type { ResourceGroup } from '#/types'

const CLUSTER_NAV = [
  { label: 'Overview', icon: 'dashboard', href: '/' },
  { label: 'Nodes', icon: 'dns', href: '/nodes' },
  { label: 'Events', icon: 'event_note', href: '/events' },
  { label: 'Namespaces', icon: 'folder', href: '/namespaces' },
  { label: 'Logs', icon: 'article', href: '/logs' },
] as const

const KIND_ICONS: Record<string, string> = {
  Pod: 'deployed_code',
  Deployment: 'layers',
  ReplicaSet: 'stacks',
  StatefulSet: 'view_column',
  DaemonSet: 'select_all',
  Job: 'work',
  CronJob: 'schedule',
  Service: 'lan',
  Ingress: 'input',
  Endpoints: 'hub',
  EndpointSlice: 'hub',
  NetworkPolicy: 'security',
  PersistentVolumeClaim: 'hard_drive',
  PersistentVolume: 'hard_drive',
  StorageClass: 'inventory_2',
  ConfigMap: 'settings',
  Secret: 'lock',
  ServiceAccount: 'person',
  ResourceQuota: 'data_usage',
  LimitRange: 'tune',
}

function getKindIcon(kind: string): string {
  return KIND_ICONS[kind] ?? 'article'
}

function buildResourceSplat(resource: { group: string; version: string; name: string }): string {
  const groupVersion = resource.group ? `${resource.group}/${resource.version}` : resource.version
  return `${groupVersion}/${resource.name}`
}

export const Sidebar = memo(function Sidebar() {
  const { data: apiData } = useAPIResources()
  const { data: promStatus } = usePrometheusStatus()
  const [collapsed, setCollapsed] = useState(false)
  const [clusterOpen, setClusterOpen] = useState(true)
  const groups: ResourceGroup[] = useMemo(() => apiData?.groups ?? [], [apiData])

  if (collapsed) {
    return (
      <aside className="w-14 flex-col bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark hidden lg:flex shadow-[1px_0_8px_rgba(0,0,0,0.05)] dark:shadow-[1px_0_8px_rgba(0,0,0,0.3)]">
        <div className="p-3 flex justify-center">
          <button
            onClick={() => setCollapsed(false)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">menu</span>
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="w-64 flex-col bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark hidden lg:flex overflow-hidden shadow-[1px_0_8px_rgba(0,0,0,0.05)] dark:shadow-[1px_0_8px_rgba(0,0,0,0.3)]">
      <div className="p-3 flex justify-end">
        <button
          onClick={() => setCollapsed(true)}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">menu_open</span>
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-1 pb-4 overflow-y-auto overflow-x-hidden">
        <div>
          <button
            onClick={() => setClusterOpen((p) => !p)}
            className="w-full flex items-center justify-between px-3 mb-1 group"
          >
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cluster</span>
            <span className={`material-symbols-outlined text-[16px] text-slate-500 transition-transform ${clusterOpen ? '' : '-rotate-90'}`}>
              expand_more
            </span>
          </button>
          {clusterOpen && (
            <>
              {CLUSTER_NAV.map((item) => (
                <Link
                  key={item.href}
                  to={item.href as string}
                  className="flex items-center gap-2.5 pl-6 pr-3 py-1.5 rounded-lg text-[13px] text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100 transition-colors min-w-0"
                  activeProps={{
                    className: 'flex items-center gap-2.5 pl-6 pr-3 py-1.5 rounded-lg text-[13px] bg-primary/10 text-primary font-medium min-w-0',
                  }}
                >
                  <span className="material-symbols-outlined shrink-0 text-[18px] text-blue-400">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </Link>
              ))}
              {promStatus?.available && (
                <Link
                  to="/metrics"
                  className="flex items-center gap-2.5 pl-6 pr-3 py-1.5 rounded-lg text-[13px] text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100 transition-colors min-w-0"
                  activeProps={{
                    className: 'flex items-center gap-2.5 pl-6 pr-3 py-1.5 rounded-lg text-[13px] bg-primary/10 text-primary font-medium min-w-0',
                  }}
                >
                  <span className="material-symbols-outlined shrink-0 text-[18px] text-blue-400">monitoring</span>
                  <span className="truncate">Metrics</span>
                </Link>
              )}
            </>
          )}
        </div>

        {groups.map((group) => (
          <SidebarGroup key={group.label} group={group} />
        ))}
      </nav>
    </aside>
  )
})

const COLLAPSED_BY_DEFAULT = new Set(['Custom Resources', 'Other'])

const SidebarGroup = memo(function SidebarGroup({ group }: { group: ResourceGroup }) {
  const [open, setOpen] = useState(!COLLAPSED_BY_DEFAULT.has(group.label))
  const toggle = useCallback(() => setOpen((p) => !p), [])

  const listable = useMemo(
    () => group.resources.filter((r) => r.verbs.includes('list')),
    [group.resources],
  )

  return (
    <div className="mt-4">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-3 mb-1 group"
      >
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{group.label}</span>
        <span className={`material-symbols-outlined text-[16px] text-slate-500 transition-transform ${open ? '' : '-rotate-90'}`}>
          expand_more
        </span>
      </button>
      {open && listable.map((resource) => (
        <Link
          key={`${resource.group}/${resource.version}/${resource.name}`}
          to="/resources/$"
          params={{ _splat: buildResourceSplat(resource) }}
          className="flex items-center gap-2.5 pl-6 pr-3 py-1.5 rounded-lg text-[13px] text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100 transition-colors min-w-0"
          activeProps={{
            className: 'flex items-center gap-2.5 pl-6 pr-3 py-1.5 rounded-lg text-[13px] bg-primary/10 text-primary font-medium min-w-0',
          }}
        >
          <span className="material-symbols-outlined shrink-0 text-[18px] text-blue-400">{getKindIcon(resource.kind)}</span>
          <span className="truncate">{resource.kind}</span>
        </Link>
      ))}
    </div>
  )
})
