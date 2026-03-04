import { useState, useCallback, useMemo } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { parse as yamlParse } from 'yaml'
import { useAPIResources } from '#/hooks/use-api-resources'
import { Breadcrumb } from '#/components/layout/Breadcrumb'
import { Button } from '#/components/ui/button'
import { api } from '#/api'

export const Route = createFileRoute('/create')({ component: CreateResourcePage })

type TemplateEntry = {
  label: string
  icon: string
  yaml: string
}

const NS_PLACEHOLDER = '{{NAMESPACE}}'

const TEMPLATES: TemplateEntry[] = [
  {
    label: 'Pod',
    icon: 'deployed_code',
    yaml: `apiVersion: v1
kind: Pod
metadata:
  name: my-pod
  namespace: ${NS_PLACEHOLDER}
spec:
  containers:
    - name: main
      image: nginx:latest
      ports:
        - containerPort: 80`,
  },
  {
    label: 'Deployment',
    icon: 'layers',
    yaml: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deployment
  namespace: ${NS_PLACEHOLDER}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-deployment
  template:
    metadata:
      labels:
        app: my-deployment
    spec:
      containers:
        - name: main
          image: nginx:latest
          ports:
            - containerPort: 80`,
  },
  {
    label: 'Service',
    icon: 'lan',
    yaml: `apiVersion: v1
kind: Service
metadata:
  name: my-service
  namespace: ${NS_PLACEHOLDER}
spec:
  selector:
    app: my-app
  ports:
    - port: 80
      targetPort: 80
  type: ClusterIP`,
  },
  {
    label: 'ConfigMap',
    icon: 'settings',
    yaml: `apiVersion: v1
kind: ConfigMap
metadata:
  name: my-config
  namespace: ${NS_PLACEHOLDER}
data:
  key: value`,
  },
  {
    label: 'Secret',
    icon: 'lock',
    yaml: `apiVersion: v1
kind: Secret
metadata:
  name: my-secret
  namespace: ${NS_PLACEHOLDER}
type: Opaque
stringData:
  username: admin
  password: changeme`,
  },
  {
    label: 'Job',
    icon: 'work',
    yaml: `apiVersion: batch/v1
kind: Job
metadata:
  name: my-job
  namespace: ${NS_PLACEHOLDER}
spec:
  template:
    spec:
      containers:
        - name: worker
          image: busybox:latest
          command: ["echo", "Hello from job"]
      restartPolicy: Never
  backoffLimit: 3`,
  },
  {
    label: 'CronJob',
    icon: 'schedule',
    yaml: `apiVersion: batch/v1
kind: CronJob
metadata:
  name: my-cronjob
  namespace: ${NS_PLACEHOLDER}
spec:
  schedule: "*/5 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: worker
              image: busybox:latest
              command: ["echo", "Hello from cronjob"]
          restartPolicy: Never`,
  },
  {
    label: 'Ingress',
    icon: 'input',
    yaml: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-ingress
  namespace: ${NS_PLACEHOLDER}
spec:
  rules:
    - host: example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: my-service
                port:
                  number: 80`,
  },
  {
    label: 'PVC',
    icon: 'hard_drive',
    yaml: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-pvc
  namespace: ${NS_PLACEHOLDER}
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi`,
  },
  {
    label: 'Blank',
    icon: 'description',
    yaml: '',
  },
]

type ApplyStatus = 'idle' | 'applying' | 'success' | 'error'

const API_VERSION_MAP: Record<string, { group: string; version: string }> = {
  v1: { group: '', version: 'v1' },
  'apps/v1': { group: 'apps', version: 'v1' },
  'batch/v1': { group: 'batch', version: 'v1' },
  'networking.k8s.io/v1': { group: 'networking.k8s.io', version: 'v1' },
}

const KIND_TO_PLURAL: Record<string, string> = {
  Pod: 'pods',
  Deployment: 'deployments',
  Service: 'services',
  ConfigMap: 'configmaps',
  Secret: 'secrets',
  Job: 'jobs',
  CronJob: 'cronjobs',
  Ingress: 'ingresses',
  PersistentVolumeClaim: 'persistentvolumeclaims',
  Namespace: 'namespaces',
  ServiceAccount: 'serviceaccounts',
  ReplicaSet: 'replicasets',
  StatefulSet: 'statefulsets',
  DaemonSet: 'daemonsets',
}

function CreateResourcePage() {
  const navigate = useNavigate()
  const { data: apiData } = useAPIResources()
  const [selectedTemplate, setSelectedTemplate] = useState(0)
  const [namespace, setNamespace] = useState('default')
  const [content, setContent] = useState(TEMPLATES[0].yaml.replaceAll(NS_PLACEHOLDER, 'default'))
  const [status, setStatus] = useState<ApplyStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  const allResources = useMemo(() => {
    if (!apiData?.groups) return []
    return apiData.groups.flatMap((g) => g.resources)
  }, [apiData])

  const selectTemplate = useCallback((idx: number) => {
    setSelectedTemplate(idx)
    setContent(TEMPLATES[idx].yaml.replaceAll(NS_PLACEHOLDER, namespace))
    setStatus('idle')
    setError(null)
    setParseError(null)
  }, [namespace])

  const handleContentChange = useCallback((value: string) => {
    setContent(value)
    setStatus('idle')
    setError(null)
    try {
      yamlParse(value)
      setParseError(null)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Invalid YAML')
    }
  }, [])

  const handleNamespaceChange = useCallback((ns: string) => {
    setNamespace(ns)
    setContent((prev) => {
      try {
        const parsed = yamlParse(prev)
        if (parsed?.metadata) {
          parsed.metadata.namespace = ns
          const { stringify } = require('yaml') as typeof import('yaml')
          return stringify(parsed, { indent: 2, lineWidth: 0 })
        }
      } catch {}
      return prev
    })
  }, [])

  const resolveResource = useCallback((parsed: Record<string, unknown>) => {
    const apiVersion = parsed.apiVersion as string
    const kind = parsed.kind as string

    const discovered = allResources.find(
      (r) => r.kind === kind && `${r.group ? r.group + '/' : ''}${r.version}` === apiVersion,
    )
    if (discovered) {
      return {
        group: discovered.group,
        version: discovered.version,
        name: discovered.name,
        namespaced: discovered.namespaced,
      }
    }

    const mapped = API_VERSION_MAP[apiVersion]
    const plural = KIND_TO_PLURAL[kind]
    if (mapped && plural) {
      return { group: mapped.group, version: mapped.version, name: plural, namespaced: true }
    }

    return null
  }, [allResources])

  const handleApply = useCallback(async () => {
    setError(null)
    setParseError(null)

    let parsed: Record<string, unknown>
    try {
      parsed = yamlParse(content)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Invalid YAML')
      return
    }

    if (!parsed?.apiVersion || !parsed?.kind) {
      setError('YAML must include apiVersion and kind')
      return
    }

    const metadata = parsed.metadata as Record<string, unknown> | undefined
    if (!metadata?.name) {
      setError('YAML must include metadata.name')
      return
    }

    const resource = resolveResource(parsed)
    if (!resource) {
      setError(`Unknown resource type: ${parsed.apiVersion}/${parsed.kind}`)
      return
    }

    const ns = metadata.namespace as string | undefined

    setStatus('applying')
    try {
      await api.applyResource({
        group: resource.group,
        version: resource.version,
        name: resource.name,
        namespaced: resource.namespaced,
        namespace: ns,
        body: parsed,
      })
      setStatus('success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create resource'
      setError(message)
      setStatus('error')
    }
  }, [content, resolveResource])

  const handleGoToResource = useCallback(() => {
    try {
      const parsed = yamlParse(content)
      const resource = resolveResource(parsed)
      if (!resource) return
      const metadata = parsed.metadata as Record<string, unknown>
      const groupVersion = resource.group ? `${resource.group}/${resource.version}` : resource.version
      const ns = metadata.namespace as string | undefined
      const name = metadata.name as string

      let path = `${groupVersion}/${resource.name}`
      if (ns) path += `/${ns}`
      path += `/${name}`

      navigate({ to: '/resources/$', params: { _splat: path } })
    } catch {}
  }, [content, resolveResource, navigate])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 pb-0">
        <Breadcrumb items={[{ label: 'Create Resource' }]} />
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-48 shrink-0 border-r border-border-light dark:border-border-dark p-3 overflow-y-auto">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 mb-2 block">
            Templates
          </span>
          {TEMPLATES.map((t, idx) => (
            <button
              key={t.label}
              onClick={() => selectTemplate(idx)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                selectedTemplate === idx
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-hover/50'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-12 bg-[#252526] border-b border-[#333] flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px] text-slate-400">code</span>
              <span className="text-sm font-mono text-slate-300">new-resource.yaml</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-400">Namespace</label>
              <input
                type="text"
                value={namespace}
                onChange={(e) => handleNamespaceChange(e.target.value)}
                className="w-32 px-2 py-1 text-xs rounded border border-[#444] bg-[#1e1e1e] text-slate-200 focus:outline-none focus:border-primary"
              />
              <div className="h-4 w-px bg-[#444]" />
              <Button
                size="sm"
                onClick={handleApply}
                disabled={status === 'applying' || !content.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
              >
                <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
                {status === 'applying' ? 'Creating...' : 'Apply'}
              </Button>
            </div>
          </div>

          {status === 'success' && (
            <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-[16px]">check_circle</span>
                <span className="text-xs text-emerald-400 font-medium">Resource created successfully</span>
              </div>
              <Button variant="ghost" size="xs" onClick={handleGoToResource} className="text-emerald-400 hover:text-emerald-300">
                View Resource
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Button>
            </div>
          )}

          {status === 'error' && error && (
            <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2 shrink-0">
              <span className="material-symbols-outlined text-red-400 text-[16px]">error</span>
              <span className="text-xs text-red-400">{error}</span>
            </div>
          )}

          <div className="flex-1 overflow-auto bg-[#1e1e1e]">
            <textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              spellCheck={false}
              className="w-full h-full min-h-full p-4 font-mono text-xs leading-6 text-[#d4d4d4] bg-transparent resize-none outline-none whitespace-pre"
            />
          </div>

          {parseError && (
            <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20 flex items-center gap-2 shrink-0">
              <span className="material-symbols-outlined text-amber-400 text-[16px]">warning</span>
              <span className="text-xs text-amber-400 font-mono">{parseError}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
