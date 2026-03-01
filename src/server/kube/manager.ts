import {
  KubeConfig,
  CoreV1Api,
  CustomObjectsApi,
} from '@kubernetes/client-node'
import type { ContextInfo } from './types'

type ClientSet = {
  coreV1: CoreV1Api
  customObjects: CustomObjectsApi
}

export class KubeManager {
  private static instance: KubeManager | null = null
  private kubeConfig: KubeConfig
  private clientCache = new Map<string, ClientSet>()

  private constructor() {
    this.kubeConfig = new KubeConfig()
    this.kubeConfig.loadFromDefault()
  }

  static getInstance(): KubeManager {
    if (!KubeManager.instance) {
      KubeManager.instance = new KubeManager()
    }
    return KubeManager.instance
  }

  static resetInstance(): void {
    KubeManager.instance = null
  }

  getContexts(): ContextInfo[] {
    return this.kubeConfig.getContexts().map((ctx) => ({
      name: ctx.name,
      cluster: ctx.cluster,
      user: ctx.user,
      namespace: ctx.namespace,
    }))
  }

  getCurrentContext(): string {
    return this.kubeConfig.getCurrentContext()
  }

  setContext(name: string): void {
    this.kubeConfig.setCurrentContext(name)
  }

  getKubeConfig(): KubeConfig {
    return this.kubeConfig
  }

  getCoreV1Api(): CoreV1Api {
    return this.getClients().coreV1
  }

  getCustomObjectsApi(): CustomObjectsApi {
    return this.getClients().customObjects
  }

  private getClients(): ClientSet {
    const context = this.getCurrentContext()
    let clients = this.clientCache.get(context)
    if (!clients) {
      clients = {
        coreV1: this.kubeConfig.makeApiClient(CoreV1Api),
        customObjects: this.kubeConfig.makeApiClient(CustomObjectsApi),
      }
      this.clientCache.set(context, clients)
    }
    return clients
  }
}
