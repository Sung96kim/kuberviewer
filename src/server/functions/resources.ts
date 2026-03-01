import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  listResources,
  getResource,
  deleteResource,
  applyResource,
} from '../kube/resources'

const resourceIdentifierSchema = z.object({
  group: z.string(),
  version: z.string(),
  name: z.string(),
  namespaced: z.boolean(),
  namespace: z.string().optional(),
})

export const listResourcesFn = createServerFn({ method: 'GET' })
  .inputValidator(
    resourceIdentifierSchema.extend({
      labelSelector: z.string().optional(),
      fieldSelector: z.string().optional(),
      limit: z.number().optional(),
      continueToken: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    return listResources(data)
  })

export const getResourceFn = createServerFn({ method: 'GET' })
  .inputValidator(
    resourceIdentifierSchema.extend({
      resourceName: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    return getResource(data)
  })

export const deleteResourceFn = createServerFn({ method: 'POST' })
  .inputValidator(
    resourceIdentifierSchema.extend({
      resourceName: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    return deleteResource(data)
  })

export const applyResourceFn = createServerFn({ method: 'POST' })
  .inputValidator(
    resourceIdentifierSchema.extend({
      resourceName: z.string().optional(),
      body: z.unknown(),
    }),
  )
  .handler(async ({ data }) => {
    return applyResource(data)
  })
