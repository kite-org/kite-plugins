import type { CoreV1 } from '@kite-dev/plugin-sdk/k8s'

export type Pod = CoreV1.Pod
export type PVC = CoreV1.PersistentVolumeClaim
export const podsResource = { group: '', resource: 'pods' }
export const helperLabel = 'kite.dev/pvc-file-browser'

export function consumesClaim(pod: Pod, claim: PVC) {
  return pod.spec?.volumes?.some(
    (volume) => volume.persistentVolumeClaim?.claimName === claim.metadata!.name
  )
}

export function isHelper(pod: Pod, claim: PVC) {
  return (
    pod.metadata?.labels?.[helperLabel] === claim.metadata!.uid &&
    pod.metadata?.ownerReferences?.some(
      (owner) =>
        owner.uid === claim.metadata!.uid &&
        owner.kind === 'PersistentVolumeClaim'
    )
  )
}

export function getMounts(pods: Pod[], claim: PVC) {
  return pods.flatMap((pod) => {
    const volumes =
      pod.spec?.volumes?.filter(
        (volume) =>
          volume.persistentVolumeClaim?.claimName === claim.metadata!.name
      ) ?? []
    const statuses = [
      ...(pod.status?.containerStatuses ?? []),
      ...(pod.status?.initContainerStatuses ?? []),
      ...(pod.status?.ephemeralContainerStatuses ?? []),
    ]
    return [
      ...(pod.spec?.containers ?? []),
      ...(pod.spec?.initContainers ?? []),
      ...(pod.spec?.ephemeralContainers ?? []),
    ].flatMap((container) =>
      (container.volumeMounts ?? []).flatMap((mount) => {
        const volume = volumes.find((entry) => entry.name === mount.name)
        if (!volume) return []
        return [
          {
            id: `${pod.metadata!.uid}/${container.name}/${mount.mountPath}`,
            pod,
            container: container.name,
            path: mount.mountPath,
            subPath: mount.subPath || mount.subPathExpr,
            readOnly: !!(
              mount.readOnly || volume.persistentVolumeClaim?.readOnly
            ),
            running:
              !pod.metadata!.deletionTimestamp &&
              !!statuses.find((status) => status.name === container.name)?.state
                ?.running,
          },
        ]
      })
    )
  })
}

export function browsingPod(claim: PVC, image: string, consumer?: Pod): Pod {
  const readOnly =
    claim.spec?.accessModes?.every((mode) => mode === 'ReadOnlyMany') ?? false
  return {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: {
      name: `pvc-files-${claim.metadata!.uid}`,
      namespace: claim.metadata!.namespace,
      labels: { [helperLabel]: claim.metadata!.uid! },
      ownerReferences: [
        {
          apiVersion: 'v1',
          kind: 'PersistentVolumeClaim',
          name: claim.metadata!.name!,
          uid: claim.metadata!.uid!,
        },
      ],
    },
    spec: {
      automountServiceAccountToken: false,
      restartPolicy: 'Never',
      terminationGracePeriodSeconds: 5,
      ...(consumer?.spec?.nodeName
        ? {
            affinity: {
              nodeAffinity: {
                requiredDuringSchedulingIgnoredDuringExecution: {
                  nodeSelectorTerms: [
                    {
                      matchFields: [
                        {
                          key: 'metadata.name',
                          operator: 'In',
                          values: [consumer.spec.nodeName],
                        },
                      ],
                    },
                  ],
                },
              },
            },
            tolerations: consumer.spec.tolerations,
          }
        : {}),
      containers: [
        {
          name: 'files',
          image,
          command: ['sleep', 'infinity'],
          resources: {
            requests: { cpu: '10m', memory: '16Mi' },
            limits: { cpu: '100m', memory: '128Mi' },
          },
          securityContext: {
            allowPrivilegeEscalation: false,
            capabilities: { drop: ['ALL'] },
            seccompProfile: { type: 'RuntimeDefault' },
          },
          volumeMounts: [{ name: 'data', mountPath: '/volume', readOnly }],
        },
      ],
      volumes: [
        {
          name: 'data',
          persistentVolumeClaim: { claimName: claim.metadata!.name!, readOnly },
        },
      ],
    },
  }
}
