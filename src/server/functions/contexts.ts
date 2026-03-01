import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { KubeManager } from '../kube/manager'

export const getContexts = createServerFn({ method: 'GET' }).handler(
  async () => {
    const manager = KubeManager.getInstance()
    return {
      contexts: manager.getContexts(),
      current: manager.getCurrentContext(),
    }
  },
)

export const switchContext = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ name: z.string() }))
  .handler(async ({ data }) => {
    const manager = KubeManager.getInstance()
    manager.setContext(data.name)
    return { current: manager.getCurrentContext() }
  })
