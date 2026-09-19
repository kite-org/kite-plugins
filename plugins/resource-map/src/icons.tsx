import {
  IconApps,
  IconBox,
  IconClock,
  IconCube,
  IconDatabase,
  IconFileSettings,
  IconKey,
  IconLayersIntersect,
  IconNetwork,
  IconRoute,
  IconServer,
  IconStack,
  IconTopologyStar,
  IconWriting,
} from '@tabler/icons-react'

import type { ResourceType } from './model'

export const resourceIcons = {
  pods: IconCube,
  deployments: IconBox,
  replicasets: IconLayersIntersect,
  statefulsets: IconStack,
  daemonsets: IconApps,
  jobs: IconWriting,
  cronjobs: IconClock,
  services: IconTopologyStar,
  ingresses: IconRoute,
  configmaps: IconFileSettings,
  secrets: IconKey,
  persistentvolumeclaims: IconDatabase,
  persistentvolumes: IconDatabase,
  nodes: IconServer,
} satisfies Record<ResourceType, typeof IconNetwork>
