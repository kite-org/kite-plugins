import { lazy } from 'react'
import { definePlugin } from '@kite-dev/plugin-sdk'

import { label, translations } from './src/i18n'
import { resources, type ResourceType } from './src/resources'

const ResourceList = lazy(() => import('./src/pages/resource-list'))
const ResourceDetail = lazy(() => import('./src/pages/resource-detail'))

export default definePlugin({
  i18n: translations,
  menus: [
    {
      id: 'manager',
      label: 'cert-manager',
      order: 50,
    },
    ...Object.entries(resources).map(([type, resource], order) => ({
      id: type,
      parent: 'cert-manager:manager',
      label: label(resource.label),
      resource: resource.reference,
      icon: 'IconShieldCheck',
      order,
    })),
  ],
  resources: (Object.keys(resources) as ResourceType[]).map((type) => ({
    ...resources[type].reference,
    list: <ResourceList type={type} />,
    detail: <ResourceDetail type={type} />,
  })),
})
