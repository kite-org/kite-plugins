import type { MetaV1 } from '@kite-dev/plugin-sdk/k8s'
import type { ResourceMetadata } from '@kite-dev/plugin-sdk/resources'

export const group = 'gateway.networking.k8s.io'
export const resources = {
  gateways: {
    reference: { group, resource: 'gateways' },
    kind: 'Gateway',
    label: 'resources.gateways',
    singular: 'resources.gateway',
  },
  httproutes: {
    reference: { group, resource: 'httproutes' },
    kind: 'HTTPRoute',
    label: 'resources.httproutes',
    singular: 'resources.httproute',
  },
} as const
export type ResourceType = keyof typeof resources

export interface ObjectReference {
  group?: string
  kind?: string
  name: string
  namespace?: string
  sectionName?: string
  port?: number
}

export interface Gateway {
  apiVersion: string
  kind: 'Gateway'
  metadata: ResourceMetadata
  spec: {
    gatewayClassName: string
    addresses?: { type?: string; value: string }[]
    listeners: {
      name: string
      hostname?: string
      port: number
      protocol: string
      tls?: { mode?: string; certificateRefs?: ObjectReference[] }
    }[]
  }
  status?: {
    addresses?: { type?: string; value: string }[]
    conditions?: MetaV1.Condition[]
    listeners?: {
      name: string
      attachedRoutes: number
      conditions?: MetaV1.Condition[]
    }[]
  }
}

export interface HTTPRoute {
  apiVersion: string
  kind: 'HTTPRoute'
  metadata: ResourceMetadata
  spec: {
    hostnames?: string[]
    parentRefs?: ObjectReference[]
    rules?: {
      matches?: {
        path?: { type?: string; value?: string }
        method?: string
        headers?: { type?: string; name: string; value: string }[]
        queryParams?: { type?: string; name: string; value: string }[]
      }[]
      backendRefs?: (ObjectReference & { weight?: number })[]
      filters?: { type: string; [key: string]: unknown }[]
    }[]
  }
  status?: {
    parents?: {
      parentRef: ObjectReference
      controllerName: string
      conditions?: MetaV1.Condition[]
    }[]
  }
}

export type GatewayResource = Gateway | HTTPRoute
