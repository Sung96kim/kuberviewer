import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useAPIResources } from '#/hooks/use-api-resources'
import type { ResourceGroup } from '#/server/kube/types'

const CLUSTER_NAV = [
  { label: 'Overview', icon: 'dashboard', href: '/' },
  { label: 'Nodes', icon: 'dns', href: '/nodes' },
  { label: 'Events', icon: 'event_note', href: '/events' },
  { label: 'Namespaces', icon: 'folder', href: '/namespaces' },
] as const

const GROUP_ICONS: Record<string, string> = {
  Workloads: 'deployed_code',
  Networking: 'lan',
  Storage: 'database',
  Config: 'settings',
  'Custom Resources': 'extension',
  Other: 'category',
}

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

function buildResourceHref(resource: { group: string; version: string; name: string }): string {
  const groupVersion = resource.group ? `${resource.group}/${resource.version}` : resource.version
  return `/resources/${groupVersion}/${resource.name}`
}

export function Sidebar() {
  const { data: apiData } = useAPIResources()
  const [collapsed, setCollapsed] = useState(false)
  const groups: ResourceGroup[] = apiData?.groups ?? []

  if (collapsed) {
    return (
      <aside className="w-14 flex-col bg-surface-dark border-r border-border-dark hidden lg:flex">
        <div className="p-3 flex justify-center">
          <button
            onClick={() => setCollapsed(false)}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">menu</span>
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="w-64 flex-col bg-surface-dark border-r border-border-dark hidden lg:flex overflow-y-auto">
      <div className="p-3 flex justify-end">
        <button
          onClick={() => setCollapsed(true)}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">menu_open</span>
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-1 pb-4">
        <div>
          <div className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Cluster
          </div>
          {CLUSTER_NAV.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800/50 hover:text-slate-100 transition-colors"
              activeProps={{
                className: 'flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/10 text-primary font-medium',
              }}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>

        {groups.map((group) => (
          <div key={group.label} className="mt-6">
            <div className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {group.label}
            </div>
            {group.resources
              .filter((r) => r.verbs.includes('list'))
              .map((resource) => (
                <Link
                  key={`${resource.group}/${resource.version}/${resource.name}`}
                  to={buildResourceHref(resource)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800/50 hover:text-slate-100 transition-colors"
                  activeProps={{
                    className: 'flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/10 text-primary font-medium',
                  }}
                >
                  <span className="material-symbols-outlined">{getKindIcon(resource.kind)}</span>
                  <span>{resource.kind}</span>
                </Link>
              ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
