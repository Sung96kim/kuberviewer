import type { ColumnDef } from '@tanstack/react-table'
import { relativeTime } from '#/lib/time'

type KubeItem = Record<string, unknown>

type KubeMetadata = {
  name?: string
  namespace?: string
  creationTimestamp?: string
}

type PodContainerStatus = {
  name?: string
  ready?: boolean
  restartCount?: number
  state?: Record<string, unknown>
}

type PodStatus = {
  phase?: string
  containerStatuses?: PodContainerStatus[]
  initContainerStatuses?: PodContainerStatus[]
  conditions?: Array<{ type?: string; status?: string }>
}

type DeploymentStatus = {
  replicas?: number
  readyReplicas?: number
  updatedReplicas?: number
  availableReplicas?: number
}

type ServiceSpec = {
  type?: string
  clusterIP?: string
  externalIPs?: string[]
  ports?: Array<{
    port?: number
    protocol?: string
    targetPort?: number | string
    nodePort?: number
  }>
}

type ServiceStatus = {
  loadBalancer?: {
    ingress?: Array<{
      ip?: string
      hostname?: string
    }>
  }
}

function getMetadata(item: KubeItem): KubeMetadata {
  return (item.metadata ?? {}) as KubeMetadata
}

function getStatus<T>(item: KubeItem): T {
  return (item.status ?? {}) as T
}

function getSpec<T>(item: KubeItem): T {
  return (item.spec ?? {}) as T
}

const STATUS_CLASSES: Record<string, { badge: string; dot: string }> = {
  running: {
    badge: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]',
  },
  succeeded: {
    badge: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  active: {
    badge: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]',
  },
  bound: {
    badge: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  available: {
    badge: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  pending: {
    badge: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(234,179,8,0.4)]',
  },
  waiting: {
    badge: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
    dot: 'bg-amber-500',
  },
  terminating: {
    badge: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
    dot: 'bg-amber-500',
  },
  failed: {
    badge: 'bg-red-500/10 text-red-500 border border-red-500/20',
    dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]',
  },
  crashloopbackoff: {
    badge: 'bg-red-500/10 text-red-500 border border-red-500/20',
    dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]',
  },
  error: {
    badge: 'bg-red-500/10 text-red-500 border border-red-500/20',
    dot: 'bg-red-500',
  },
  unknown: {
    badge: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
    dot: 'bg-slate-400',
  },
}

const DEFAULT_STATUS_CLASSES = {
  badge: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
  dot: 'bg-slate-400',
}

export function getStatusClasses(status: string): { badge: string; dot: string } {
  return STATUS_CLASSES[status.toLowerCase()] ?? DEFAULT_STATUS_CLASSES
}

const GENERATED_SUFFIX_RE = /^[a-z0-9]{1,10}$/
const HEX_HASH_RE = /^[a-f0-9]{6,10}$/

export function extractPodPrefix(name: string): string {
  const segments = name.split('-')
  if (segments.length <= 1) return name

  let end = segments.length
  while (end > 1) {
    const seg = segments[end - 1]
    if (HEX_HASH_RE.test(seg) || (GENERATED_SUFFIX_RE.test(seg) && seg.length <= 5)) {
      end--
    } else {
      break
    }
  }

  if (end < 1) end = 1
  return segments.slice(0, end).join('-')
}

export function getPodPhase(item: KubeItem): string {
  const status = getStatus<PodStatus>(item)
  const containerStatuses = status.containerStatuses ?? []

  for (const cs of containerStatuses) {
    if (cs.state) {
      const stateKeys = Object.keys(cs.state)
      if (stateKeys.includes('waiting')) {
        const waitingState = cs.state.waiting as { reason?: string } | undefined
        if (waitingState?.reason) return waitingState.reason
      }
      if (stateKeys.includes('terminated')) {
        const terminatedState = cs.state.terminated as { reason?: string } | undefined
        if (terminatedState?.reason) return terminatedState.reason
      }
    }
  }

  return status.phase ?? 'Unknown'
}

function getPodContainerInfo(item: KubeItem): string {
  const status = getStatus<PodStatus>(item)
  const containerStatuses = status.containerStatuses ?? []
  const total = containerStatuses.length
  const ready = containerStatuses.filter((cs) => cs.ready).length
  return `${ready}/${total}`
}

function getPodRestarts(item: KubeItem): number {
  const status = getStatus<PodStatus>(item)
  const containerStatuses = status.containerStatuses ?? []
  return containerStatuses.reduce((sum, cs) => sum + (cs.restartCount ?? 0), 0)
}

function getPodNode(item: KubeItem): string {
  const spec = item.spec as { nodeName?: string } | undefined
  return spec?.nodeName ?? '-'
}

function getDeploymentReady(item: KubeItem): string {
  const status = getStatus<DeploymentStatus>(item)
  const spec = item.spec as { replicas?: number } | undefined
  const desired = spec?.replicas ?? 0
  const ready = status.readyReplicas ?? 0
  return `${ready}/${desired}`
}

function getServicePorts(item: KubeItem): string {
  const spec = getSpec<ServiceSpec>(item)
  const ports = spec.ports ?? []
  if (ports.length === 0) return '-'
  return ports
    .map((p) => {
      const port = p.port ?? 0
      const protocol = p.protocol ?? 'TCP'
      const nodePort = p.nodePort ? `:${p.nodePort}` : ''
      return `${port}${nodePort}/${protocol}`
    })
    .join(', ')
}

function getServiceExternalIP(item: KubeItem): string {
  const spec = getSpec<ServiceSpec>(item)
  const status = getStatus<ServiceStatus>(item)

  if (spec.externalIPs && spec.externalIPs.length > 0) {
    return spec.externalIPs.join(', ')
  }

  const ingress = status.loadBalancer?.ingress
  if (ingress && ingress.length > 0) {
    return ingress.map((i) => i.ip ?? i.hostname ?? '').filter(Boolean).join(', ') || '<pending>'
  }

  return '<none>'
}

function nameColumn(): ColumnDef<KubeItem> {
  return {
    id: 'name',
    accessorFn: (row) => getMetadata(row).name ?? '',
    header: 'Name',
    cell: (info) => info.getValue() as string,
    enableSorting: true,
  }
}

function namespaceColumn(): ColumnDef<KubeItem> {
  return {
    id: 'namespace',
    accessorFn: (row) => getMetadata(row).namespace ?? '',
    header: 'Namespace',
    cell: (info) => info.getValue() as string,
    enableSorting: true,
  }
}

function ageColumn(): ColumnDef<KubeItem> {
  return {
    id: 'age',
    accessorFn: (row) => getMetadata(row).creationTimestamp ?? '',
    header: 'Age',
    cell: (info) => {
      const ts = info.getValue() as string
      return ts ? relativeTime(ts) : '-'
    },
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = getMetadata(rowA.original).creationTimestamp ?? ''
      const b = getMetadata(rowB.original).creationTimestamp ?? ''
      return new Date(a).getTime() - new Date(b).getTime()
    },
  }
}

export function precomputePodRows(items: KubeItem[]): KubeItem[] {
  return items.map((item) => {
    const metadata = getMetadata(item)
    return {
      ...item,
      _computed: {
        podPrefix: extractPodPrefix(metadata.name ?? ''),
        phase: getPodPhase(item),
        containers: getPodContainerInfo(item),
        restarts: getPodRestarts(item),
        node: getPodNode(item),
      },
    }
  })
}

type ComputedPod = {
  podPrefix: string
  phase: string
  containers: string
  restarts: number
  node: string
}

function getComputed(row: KubeItem): ComputedPod {
  return row._computed as ComputedPod
}

function podColumns(): ColumnDef<KubeItem>[] {
  return [
    {
      id: 'podPrefix',
      accessorFn: (row) => getComputed(row).podPrefix,
      header: 'Group',
      enableGrouping: true,
      enableSorting: false,
    },
    nameColumn(),
    namespaceColumn(),
    {
      id: 'status',
      accessorFn: (row) => getComputed(row).phase,
      header: 'Status',
      cell: (info) => info.getValue() as string,
      enableSorting: true,
      meta: { isStatus: true },
    },
    {
      id: 'containers',
      accessorFn: (row) => getComputed(row).containers,
      header: 'Containers',
      enableSorting: false,
    },
    {
      id: 'restarts',
      accessorFn: (row) => getComputed(row).restarts,
      header: 'Restarts',
      enableSorting: true,
    },
    {
      id: 'node',
      accessorFn: (row) => getComputed(row).node,
      header: 'Node',
      enableSorting: true,
    },
    ageColumn(),
  ]
}

function deploymentColumns(): ColumnDef<KubeItem>[] {
  return [
    nameColumn(),
    namespaceColumn(),
    {
      id: 'ready',
      accessorFn: (row) => getDeploymentReady(row),
      header: 'Ready',
      enableSorting: false,
    },
    {
      id: 'upToDate',
      accessorFn: (row) => getStatus<DeploymentStatus>(row).updatedReplicas ?? 0,
      header: 'Up-to-date',
      enableSorting: true,
    },
    {
      id: 'available',
      accessorFn: (row) => getStatus<DeploymentStatus>(row).availableReplicas ?? 0,
      header: 'Available',
      enableSorting: true,
    },
    ageColumn(),
  ]
}

function serviceColumns(): ColumnDef<KubeItem>[] {
  return [
    nameColumn(),
    namespaceColumn(),
    {
      id: 'type',
      accessorFn: (row) => getSpec<ServiceSpec>(row).type ?? '',
      header: 'Type',
      enableSorting: true,
    },
    {
      id: 'clusterIP',
      accessorFn: (row) => getSpec<ServiceSpec>(row).clusterIP ?? '',
      header: 'Cluster IP',
      enableSorting: false,
    },
    {
      id: 'externalIP',
      accessorFn: (row) => getServiceExternalIP(row),
      header: 'External IP',
      enableSorting: false,
    },
    {
      id: 'ports',
      accessorFn: (row) => getServicePorts(row),
      header: 'Ports',
      enableSorting: false,
    },
    ageColumn(),
  ]
}

function defaultColumns(): ColumnDef<KubeItem>[] {
  return [nameColumn(), namespaceColumn(), ageColumn()]
}

const KIND_COLUMN_MAP: Record<string, () => ColumnDef<KubeItem>[]> = {
  Pod: podColumns,
  Deployment: deploymentColumns,
  Service: serviceColumns,
}

export function getColumnsForKind(kind: string): ColumnDef<KubeItem>[] {
  const factory = KIND_COLUMN_MAP[kind]
  return factory ? factory() : defaultColumns()
}

type ParsedListPath = {
  type: 'list'
  group: string
  version: string
  resourceName: string
}

type ParsedDetailPath = {
  type: 'detail'
  group: string
  version: string
  resourceName: string
  namespace?: string
  name: string
}

export type ParsedResourcePath = ParsedListPath | ParsedDetailPath

export function parseResourcePath(splatPath: string): ParsedResourcePath | null {
  const segments = splatPath.split('/').filter(Boolean)

  // Core resource list: v1/pods
  if (segments.length === 2) {
    return { type: 'list', group: '', version: segments[0], resourceName: segments[1] }
  }

  // Group resource list: apps/v1/deployments
  // OR core non-namespaced detail: v1/nodes/my-node
  if (segments.length === 3) {
    // Check if segment[1] looks like a version (starts with v)
    if (segments[1].match(/^v\d/)) {
      return { type: 'list', group: segments[0], version: segments[1], resourceName: segments[2] }
    }
    return { type: 'detail', group: '', version: segments[0], resourceName: segments[1], name: segments[2] }
  }

  // Core namespaced detail: v1/pods/default/my-pod
  // OR group non-namespaced detail: apps/v1/deployments/my-deploy
  if (segments.length === 4) {
    if (segments[1].match(/^v\d/)) {
      return { type: 'detail', group: segments[0], version: segments[1], resourceName: segments[2], name: segments[3] }
    }
    return { type: 'detail', group: '', version: segments[0], resourceName: segments[1], namespace: segments[2], name: segments[3] }
  }

  // Group namespaced detail: apps/v1/deployments/default/my-deploy
  if (segments.length === 5) {
    return { type: 'detail', group: segments[0], version: segments[1], resourceName: segments[2], namespace: segments[3], name: segments[4] }
  }

  return null
}
