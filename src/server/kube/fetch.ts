import type { KubeConfig } from '@kubernetes/client-node'

export async function kubeRequest<T>(
  kubeConfig: KubeConfig,
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const cluster = kubeConfig.getCurrentCluster()
  if (!cluster) {
    throw new Error('No active cluster found in kubeconfig')
  }
  const url = `${cluster.server}${path}`
  const fetchOpts = await kubeConfig.applyToFetchOptions(
    {} as Parameters<typeof kubeConfig.applyToFetchOptions>[0],
  )
  const headers: Record<string, string> = {
    ...(fetchOpts.headers as Record<string, string> | undefined),
    Accept: 'application/json',
  }
  if (body) {
    headers['Content-Type'] = 'application/json'
  }
  const response = await fetch(url, {
    ...fetchOpts,
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`HTTP ${response.status}: ${text}`)
  }
  return response.json() as Promise<T>
}
