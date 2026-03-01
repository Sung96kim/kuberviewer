import { createServerFn } from '@tanstack/react-start'
import { discoverAPIs, groupResources } from '../kube/discovery'

export const getAPIResources = createServerFn({ method: 'GET' }).handler(
  async () => {
    const resources = await discoverAPIs()
    return {
      resources,
      groups: groupResources(resources),
    }
  },
)
