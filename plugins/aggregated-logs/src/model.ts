import type { CoreV1, MetaV1 } from '@kite-dev/plugin-sdk/k8s'
import type {
  KubernetesResource,
  ResourceReference,
} from '@kite-dev/plugin-sdk/resources'

export const resourceTypes = [
  { group: 'apps', resource: 'deployments', kind: 'Deployment' },
  { group: 'apps', resource: 'statefulsets', kind: 'StatefulSet' },
  { group: 'apps', resource: 'daemonsets', kind: 'DaemonSet' },
  { group: 'batch', resource: 'jobs', kind: 'Job' },
  { group: '', resource: 'pods', kind: 'Pod' },
] as const

export type Pod = CoreV1.Pod & KubernetesResource
export type LogResource = KubernetesResource & {
  spec?: { selector?: MetaV1.LabelSelector }
}
export interface Target {
  id: string
  reference: ResourceReference
  resource: LogResource
}
export interface Source {
  id: string
  instance: string
  namespace: string
  pod: string
  container: string
  kind: 'regular' | 'init' | 'ephemeral'
  isDefault: boolean
  restartCount: number
  readable: boolean
  terminated: boolean
  waitingReason?: string
}
export type TimeRange = 'tail' | '300' | '900' | '3600' | 'live' | 'previous'
export type StreamStatus =
  'connecting' | 'streaming' | 'ended' | 'error' | 'disconnected'
export interface SourceStatus {
  state: StreamStatus
  error?: string
}
export interface LogEntry {
  id: number
  source: Source
  timestamp?: number
  time: number
  message: string
  bytes: number
}

export const MAX_STREAMS = 20
export const MAX_LINES = 50_000
export const MAX_BYTES = 20 * 1024 * 1024

export function targetSelector(target: Target): string {
  const selector = target.resource.spec?.selector
  if (!selector) return ''
  const { matchLabels = {}, matchExpressions = [] } = selector
  return [
    ...Object.entries(matchLabels).map(([key, value]) => `${key}=${value}`),
    ...matchExpressions.map(({ key, operator, values }) => {
      switch (operator) {
        case 'In':
          return `${key} in (${values!.join(',')})`
        case 'NotIn':
          return `${key} notin (${values!.join(',')})`
        case 'Exists':
          return key
        case 'DoesNotExist':
          return `!${key}`
        default:
          return ''
      }
    }),
  ]
    .filter(Boolean)
    .join(',')
}

export function podSources(pod: Pod): Source[] {
  const defaultContainer =
    pod.metadata.annotations?.['kubectl.kubernetes.io/default-container']
  const defaultName = pod.spec?.containers.some(
    (c) => c.name === defaultContainer
  )
    ? defaultContainer
    : pod.spec?.containers[0]?.name
  return [
    {
      kind: 'regular' as const,
      containers: pod.spec?.containers,
      statuses: pod.status?.containerStatuses,
    },
    {
      kind: 'init' as const,
      containers: pod.spec?.initContainers,
      statuses: pod.status?.initContainerStatuses,
    },
    {
      kind: 'ephemeral' as const,
      containers: pod.spec?.ephemeralContainers,
      statuses: pod.status?.ephemeralContainerStatuses,
    },
  ].flatMap(({ kind, containers, statuses }) =>
    (containers ?? []).map((container) => {
      const status = statuses?.find((item) => item.name === container.name)
      const id = `${pod.metadata.uid}/${container.name}`
      return {
        id,
        instance: `${id}/${status?.restartCount ?? 0}`,
        namespace: pod.metadata.namespace!,
        pod: pod.metadata.name,
        container: container.name,
        kind,
        isDefault: kind === 'regular' && container.name === defaultName,
        restartCount: status?.restartCount ?? 0,
        readable: !!(status?.state?.running || status?.state?.terminated),
        terminated: !!status?.state?.terminated,
        waitingReason: status?.state?.waiting?.reason,
      }
    })
  )
}

export function sourceColor(source: Source): number {
  let hash = 0
  for (const character of `${source.namespace}/${source.pod}`) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0
  }
  return [96, 95, 92, 93, 94, 91][Math.abs(hash) % 6]
}
