import { useMemo } from 'react'
import { useResources } from '@kite-dev/plugin-sdk/resources'

import { buildMap, type ResourceObjects } from './model'

export function useMapData(namespace: string, refreshInterval: number) {
  const options = { namespace, refreshInterval }
  const pods = useResources<ResourceObjects['pods']>(
    { group: '', resource: 'pods' },
    options
  )
  const deployments = useResources<ResourceObjects['deployments']>(
    { group: 'apps', resource: 'deployments' },
    options
  )
  const replicasets = useResources<ResourceObjects['replicasets']>(
    { group: 'apps', resource: 'replicasets' },
    options
  )
  const statefulsets = useResources<ResourceObjects['statefulsets']>(
    { group: 'apps', resource: 'statefulsets' },
    options
  )
  const daemonsets = useResources<ResourceObjects['daemonsets']>(
    { group: 'apps', resource: 'daemonsets' },
    options
  )
  const cronjobs = useResources<ResourceObjects['cronjobs']>(
    { group: 'batch', resource: 'cronjobs' },
    options
  )
  const jobs = useResources<ResourceObjects['jobs']>(
    { group: 'batch', resource: 'jobs' },
    options
  )
  const services = useResources<ResourceObjects['services']>(
    { group: '', resource: 'services' },
    options
  )
  const ingresses = useResources<ResourceObjects['ingresses']>(
    { group: 'networking.k8s.io', resource: 'ingresses' },
    options
  )
  const configmaps = useResources<ResourceObjects['configmaps']>(
    { group: '', resource: 'configmaps' },
    options
  )
  const secrets = useResources<ResourceObjects['secrets']>(
    { group: '', resource: 'secrets' },
    options
  )
  const persistentvolumeclaims = useResources<
    ResourceObjects['persistentvolumeclaims']
  >({ group: '', resource: 'persistentvolumeclaims' }, options)
  const persistentvolumes = useResources<ResourceObjects['persistentvolumes']>(
    { group: '', resource: 'persistentvolumes', scope: 'Cluster' },
    options
  )
  const nodes = useResources<ResourceObjects['nodes']>(
    { group: '', resource: 'nodes', scope: 'Cluster' },
    options
  )
  const queries = {
    pods,
    deployments,
    replicasets,
    statefulsets,
    daemonsets,
    cronjobs,
    jobs,
    services,
    ingresses,
    configmaps,
    secrets,
    persistentvolumeclaims,
    persistentvolumes,
    nodes,
  }
  const graph = useMemo(
    () =>
      buildMap({
        pods: pods.data ?? [],
        deployments: deployments.data ?? [],
        replicasets: replicasets.data ?? [],
        statefulsets: statefulsets.data ?? [],
        daemonsets: daemonsets.data ?? [],
        cronjobs: cronjobs.data ?? [],
        jobs: jobs.data ?? [],
        services: services.data ?? [],
        ingresses: ingresses.data ?? [],
        configmaps: configmaps.data ?? [],
        secrets: secrets.data ?? [],
        persistentvolumeclaims: persistentvolumeclaims.data ?? [],
        persistentvolumes: persistentvolumes.data ?? [],
        nodes: nodes.data ?? [],
      }),
    [
      pods.data,
      deployments.data,
      replicasets.data,
      statefulsets.data,
      daemonsets.data,
      cronjobs.data,
      jobs.data,
      services.data,
      ingresses.data,
      configmaps.data,
      secrets.data,
      persistentvolumeclaims.data,
      persistentvolumes.data,
      nodes.data,
    ]
  )
  return {
    ...graph,
    isLoading: Object.values(queries).some((q) => q.isLoading),
    isFetching: Object.values(queries).some((q) => q.isFetching),
    errors: Object.entries(queries).flatMap(([type, query]) =>
      query.error ? [{ type, error: query.error }] : []
    ),
    refresh: () => Promise.all(Object.values(queries).map((q) => q.refetch())),
  }
}
