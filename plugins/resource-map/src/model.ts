import type {
  AppsV1,
  BatchV1,
  CoreV1,
  MetaV1,
  NetworkingV1,
} from '@kite-dev/plugin-sdk/k8s'
import type { ResourceReference } from '@kite-dev/plugin-sdk/resources'

export const definitions = {
  ingresses: {
    group: 'networking.k8s.io',
    kind: 'Ingress',
    category: 'network',
  },
  services: { group: '', kind: 'Service', category: 'network' },
  deployments: { group: 'apps', kind: 'Deployment', category: 'workloads' },
  statefulsets: { group: 'apps', kind: 'StatefulSet', category: 'workloads' },
  daemonsets: { group: 'apps', kind: 'DaemonSet', category: 'workloads' },
  cronjobs: { group: 'batch', kind: 'CronJob', category: 'workloads' },
  jobs: { group: 'batch', kind: 'Job', category: 'workloads' },
  replicasets: { group: 'apps', kind: 'ReplicaSet', category: 'workloads' },
  pods: { group: '', kind: 'Pod', category: 'workloads' },
  configmaps: { group: '', kind: 'ConfigMap', category: 'config' },
  secrets: { group: '', kind: 'Secret', category: 'config' },
  persistentvolumeclaims: {
    group: '',
    kind: 'PersistentVolumeClaim',
    category: 'storage',
  },
  persistentvolumes: {
    group: '',
    kind: 'PersistentVolume',
    category: 'storage',
  },
  nodes: { group: '', kind: 'Node', category: 'nodes' },
} as const

export interface ResourceObjects {
  pods: CoreV1.Pod
  deployments: AppsV1.Deployment
  replicasets: AppsV1.ReplicaSet
  statefulsets: AppsV1.StatefulSet
  daemonsets: AppsV1.DaemonSet
  jobs: BatchV1.Job
  cronjobs: BatchV1.CronJob
  services: CoreV1.Service
  ingresses: NetworkingV1.Ingress
  configmaps: CoreV1.ConfigMap
  secrets: CoreV1.Secret
  persistentvolumeclaims: CoreV1.PersistentVolumeClaim
  persistentvolumes: CoreV1.PersistentVolume
  nodes: CoreV1.Node
}

export type ResourceType = keyof ResourceObjects
export type Collections = { [K in ResourceType]: ResourceObjects[K][] }
export type Category = (typeof definitions)[ResourceType]['category']
export type Tone = 'healthy' | 'warning' | 'error' | 'neutral'
export type StatusKey =
  | 'ready'
  | 'notReady'
  | 'running'
  | 'pending'
  | 'completed'
  | 'failed'
  | 'unknown'
  | 'terminating'
  | 'available'
  | 'bound'
  | 'released'
  | 'suspended'
  | 'unschedulable'

export interface MapResource {
  id: string
  type: ResourceType
  kind: string
  name: string
  namespace?: string
  reference: ResourceReference
  metadata: MetaV1.ObjectMeta
  tone: Tone
  status: StatusKey
  reason?: string
  ready?: number
  desired?: number
  nodeName?: string
  restarts?: number
  current?: number
  helmRelease?: string
  details?: {
    label:
      | 'image'
      | 'ports'
      | 'address'
      | 'hosts'
      | 'schedule'
      | 'capacity'
      | 'storageClass'
      | 'keys'
      | 'secretType'
      | 'version'
    value: string
  }[]
}

export interface Relation {
  id: string
  source: string
  target: string
  kind: 'owner' | 'selector' | 'route' | 'config' | 'storage' | 'node'
}

export function resourcePath(resource: MapResource) {
  return `/${resource.type}/${resource.namespace ? `${encodeURIComponent(resource.namespace)}/` : ''}${encodeURIComponent(resource.name)}`
}

export function isIssue(resource: MapResource) {
  return resource.tone === 'warning' || resource.tone === 'error'
}

export function buildMap(collections: Collections) {
  const resources: MapResource[] = []
  const add = (
    type: ResourceType,
    object: { metadata?: MetaV1.ObjectMeta },
    status: Partial<MapResource> = {}
  ) => {
    const metadata = object.metadata!
    const definition = definitions[type]
    resources.push({
      id: metadata.uid!,
      type,
      kind: definition.kind,
      name: metadata.name!,
      namespace: metadata.namespace,
      metadata,
      reference: { group: definition.group, resource: type },
      tone: 'neutral',
      status: 'available',
      ...status,
      ...(metadata.deletionTimestamp
        ? ({ tone: 'neutral', status: 'terminating' } as const)
        : {}),
    })
  }
  for (const pod of collections.pods) {
    const statuses = [
      ...(pod.status?.initContainerStatuses ?? []),
      ...(pod.status?.containerStatuses ?? []),
    ]
    const failed = statuses.find(
      (s) =>
        s.state?.waiting?.reason &&
        !['ContainerCreating', 'PodInitializing'].includes(
          s.state.waiting.reason
        )
    )
    const terminated = statuses.find(
      (s) => s.state?.terminated && s.state.terminated.exitCode !== 0
    )
    const ready =
      pod.status?.containerStatuses?.filter((s) => s.ready).length ?? 0
    const desired = pod.spec?.containers.length ?? 0
    const phase = pod.status?.phase
    const complete = phase === 'Succeeded'
    const readyCondition = pod.status?.conditions?.some(
      (c) => c.type === 'Ready' && c.status === 'True'
    )
    add('pods', pod, {
      ready,
      desired,
      details: pod.spec?.containers.map((c) => ({
        label: 'image',
        value: c.image ?? '',
      })),
      nodeName: pod.spec?.nodeName,
      restarts: statuses.reduce((n, s) => n + s.restartCount, 0),
      tone: complete
        ? 'healthy'
        : failed || phase === 'Failed'
          ? 'error'
          : readyCondition
            ? 'healthy'
            : 'warning',
      status: complete
        ? 'completed'
        : phase === 'Failed'
          ? 'failed'
          : phase === 'Running'
            ? readyCondition
              ? 'running'
              : 'notReady'
            : phase === 'Pending'
              ? 'pending'
              : 'unknown',
      reason: complete
        ? undefined
        : (failed?.state?.waiting?.reason ??
          terminated?.state?.terminated?.reason),
    })
  }
  for (const type of ['deployments', 'statefulsets', 'replicasets'] as const) {
    for (const item of collections[type]) {
      const desired = item.spec?.replicas ?? 1
      const ready = item.status?.readyReplicas ?? 0
      const failure = item.status?.conditions?.find(
        (c) =>
          (c.type === 'ReplicaFailure' && c.status === 'True') ||
          (c.type === 'Progressing' && c.status === 'False')
      )
      add(type, item, {
        desired,
        ready,
        current: item.status?.replicas ?? 0,
        details: item.spec?.template?.spec?.containers.map((c) => ({
          label: 'image',
          value: c.image ?? '',
        })),
        tone: failure ? 'error' : ready >= desired ? 'healthy' : 'warning',
        status: ready >= desired ? 'ready' : 'notReady',
        reason: failure?.reason,
      })
    }
  }
  for (const item of collections.daemonsets) {
    const desired = item.status?.desiredNumberScheduled ?? 0
    const ready = item.status?.numberReady ?? 0
    add('daemonsets', item, {
      details: item.spec?.template?.spec?.containers.map((c) => ({
        label: 'image',
        value: c.image ?? '',
      })),
      desired,
      ready,
      tone: ready >= desired ? 'healthy' : 'warning',
      status: ready >= desired ? 'ready' : 'notReady',
    })
  }
  for (const item of collections.jobs) {
    const failed = item.status?.conditions?.find(
      (c) => c.type === 'Failed' && c.status === 'True'
    )
    const completed = item.status?.conditions?.some(
      (c) => c.type === 'Complete' && c.status === 'True'
    )
    add('jobs', item, {
      details: item.spec?.template?.spec?.containers.map((c) => ({
        label: 'image',
        value: c.image ?? '',
      })),
      tone: failed ? 'error' : completed ? 'healthy' : 'neutral',
      status: failed ? 'failed' : completed ? 'completed' : 'running',
      reason: failed?.reason,
    })
  }
  for (const item of collections.cronjobs)
    add('cronjobs', item, {
      details: [{ label: 'schedule', value: item.spec?.schedule ?? '' }],
      status: item.spec?.suspend ? 'suspended' : 'available',
    })
  for (const item of collections.services)
    add('services', item, {
      reason: item.spec?.type ?? 'ClusterIP',
      details: [
        {
          label: 'ports',
          value:
            item.spec?.ports
              ?.map(
                (p) =>
                  `${p.port} → ${p.targetPort ?? p.port}/${p.protocol ?? 'TCP'}`
              )
              .join(', ') ?? '',
        },
        {
          label: 'address',
          value: item.spec?.clusterIP ?? item.spec?.externalName ?? '',
        },
      ],
    })
  for (const item of collections.ingresses)
    add('ingresses', item, {
      details: [
        {
          label: 'hosts',
          value: item.spec?.rules?.map((r) => r.host ?? '*').join(', ') ?? '',
        },
      ],
    })
  for (const item of collections.configmaps)
    add('configmaps', item, {
      details: [
        {
          label: 'keys',
          value: String(
            new Set([
              ...Object.keys(item.data ?? {}),
              ...Object.keys(item.binaryData ?? {}),
            ]).size
          ),
        },
      ],
    })
  for (const item of collections.secrets)
    add('secrets', item, {
      helmRelease:
        item.type === 'helm.sh/release.v1' &&
        item.metadata?.labels?.owner === 'helm'
          ? item.metadata.labels.name
          : undefined,
      details: [
        { label: 'secretType', value: item.type ?? 'Opaque' },
        { label: 'keys', value: String(Object.keys(item.data ?? {}).length) },
      ],
    })
  for (const type of ['persistentvolumeclaims', 'persistentvolumes'] as const) {
    for (const item of collections[type]) {
      const phase = item.status?.phase
      add(type, item, {
        details: [
          {
            label: 'capacity',
            value:
              ('capacity' in (item.spec ?? {})
                ? (item as CoreV1.PersistentVolume).spec?.capacity?.storage
                : ((item as CoreV1.PersistentVolumeClaim).status?.capacity
                    ?.storage ??
                  (item as CoreV1.PersistentVolumeClaim).spec?.resources
                    ?.requests?.storage)) ?? '',
          },
          { label: 'storageClass', value: item.spec?.storageClassName ?? '' },
        ],
        tone:
          phase === 'Bound'
            ? 'healthy'
            : phase === 'Lost' || phase === 'Failed'
              ? 'error'
              : phase === 'Pending'
                ? 'warning'
                : 'neutral',
        status:
          phase === 'Bound'
            ? 'bound'
            : phase === 'Pending'
              ? 'pending'
              : phase === 'Released'
                ? 'released'
                : phase === 'Failed' || phase === 'Lost'
                  ? 'failed'
                  : 'available',
      })
    }
  }
  for (const item of collections.nodes) {
    const ready = item.status?.conditions?.some(
      (c) => c.type === 'Ready' && c.status === 'True'
    )
    const pressure = item.status?.conditions?.find(
      (c) =>
        ['MemoryPressure', 'DiskPressure', 'PIDPressure'].includes(c.type) &&
        c.status === 'True'
    )
    add('nodes', item, {
      details: [
        {
          label: 'version',
          value: item.status?.nodeInfo?.kubeletVersion ?? '',
        },
        {
          label: 'address',
          value:
            item.status?.addresses?.find((a) => a.type === 'InternalIP')
              ?.address ?? '',
        },
      ],
      nodeName: item.metadata!.name,
      tone: !ready
        ? 'error'
        : pressure || item.spec?.unschedulable
          ? 'warning'
          : 'healthy',
      status: !ready
        ? 'notReady'
        : item.spec?.unschedulable
          ? 'unschedulable'
          : 'ready',
      reason: pressure?.type,
    })
  }

  const byId = new Map(resources.map((r) => [r.id, r]))
  const byName = new Map(
    resources.map((r) => [`${r.type}/${r.namespace ?? ''}/${r.name}`, r.id])
  )
  const relations = new Map<string, Relation>()
  const connect = (
    source: string | undefined,
    target: string,
    kind: Relation['kind']
  ) => {
    if (!source || !byId.has(source) || !byId.has(target) || source === target)
      return
    const id = `${source}:${target}:${kind}`
    relations.set(id, { id, source, target, kind })
  }
  const reference = (
    type: ResourceType,
    name: string | undefined,
    namespace: string | undefined,
    target: string,
    kind: Relation['kind']
  ) => {
    if (name)
      connect(byName.get(`${type}/${namespace ?? ''}/${name}`), target, kind)
  }
  for (const resource of resources) {
    for (const owner of resource.metadata.ownerReferences ?? [])
      connect(owner.uid, resource.id, 'owner')
  }
  for (const service of collections.services) {
    const selector = Object.entries(service.spec?.selector ?? {})
    if (!selector.length) continue
    for (const pod of collections.pods) {
      if (
        service.metadata!.namespace === pod.metadata!.namespace &&
        selector.every(([key, value]) => pod.metadata!.labels?.[key] === value)
      ) {
        connect(service.metadata!.uid, pod.metadata!.uid!, 'selector')
      }
    }
  }
  for (const ingress of collections.ingresses) {
    const services = [
      ingress.spec?.defaultBackend?.service,
      ...(ingress.spec?.rules ?? []).flatMap(
        (rule) => rule.http?.paths.map((path) => path.backend.service) ?? []
      ),
    ]
    for (const service of services) {
      const target = byName.get(
        `services/${ingress.metadata!.namespace}/${service?.name}`
      )
      if (target) connect(ingress.metadata!.uid, target, 'route')
    }
    for (const tls of ingress.spec?.tls ?? [])
      reference(
        'secrets',
        tls.secretName,
        ingress.metadata!.namespace,
        ingress.metadata!.uid!,
        'config'
      )
  }
  for (const pod of collections.pods) {
    const id = pod.metadata!.uid!
    const namespace = pod.metadata!.namespace
    reference('nodes', pod.spec?.nodeName, undefined, id, 'node')
    for (const container of [
      ...(pod.spec?.containers ?? []),
      ...(pod.spec?.initContainers ?? []),
      ...(pod.spec?.ephemeralContainers ?? []),
    ]) {
      for (const env of container.env ?? []) {
        reference(
          'configmaps',
          env.valueFrom?.configMapKeyRef?.name,
          namespace,
          id,
          'config'
        )
        reference(
          'secrets',
          env.valueFrom?.secretKeyRef?.name,
          namespace,
          id,
          'config'
        )
      }
      for (const env of container.envFrom ?? []) {
        reference('configmaps', env.configMapRef?.name, namespace, id, 'config')
        reference('secrets', env.secretRef?.name, namespace, id, 'config')
      }
    }
    for (const secret of pod.spec?.imagePullSecrets ?? [])
      reference('secrets', secret.name, namespace, id, 'config')
    for (const volume of pod.spec?.volumes ?? []) {
      reference('configmaps', volume.configMap?.name, namespace, id, 'config')
      reference('secrets', volume.secret?.secretName, namespace, id, 'config')
      reference(
        'persistentvolumeclaims',
        volume.persistentVolumeClaim?.claimName,
        namespace,
        id,
        'storage'
      )
      for (const source of volume.projected?.sources ?? []) {
        reference('configmaps', source.configMap?.name, namespace, id, 'config')
        reference('secrets', source.secret?.name, namespace, id, 'config')
      }
    }
  }
  for (const pvc of collections.persistentvolumeclaims)
    reference(
      'persistentvolumes',
      pvc.spec?.volumeName,
      undefined,
      pvc.metadata!.uid!,
      'storage'
    )
  return { resources, relations: [...relations.values()] }
}
