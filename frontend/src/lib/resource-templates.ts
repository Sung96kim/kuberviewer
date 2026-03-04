export type TemplateEntry = {
  label: string
  icon: string
  yaml: string
}

export const NS_PLACEHOLDER = '{{NAMESPACE}}'

export const TEMPLATES: TemplateEntry[] = [
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

export const API_VERSION_MAP: Record<string, { group: string; version: string }> = {
  v1: { group: '', version: 'v1' },
  'apps/v1': { group: 'apps', version: 'v1' },
  'batch/v1': { group: 'batch', version: 'v1' },
  'networking.k8s.io/v1': { group: 'networking.k8s.io', version: 'v1' },
}

export const KIND_TO_PLURAL: Record<string, string> = {
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

type APIResource = {
  kind: string
  group: string
  version: string
  name: string
  namespaced: boolean
}

export type ResolvedResource = {
  group: string
  version: string
  name: string
  namespaced: boolean
}

export function resolveResource(
  parsed: Record<string, unknown>,
  allResources: APIResource[],
): ResolvedResource | null {
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
}
