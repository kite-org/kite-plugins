import { lazy } from 'react'
import { definePlugin } from '@kite-dev/plugin-sdk'

import { label, translations } from './src/i18n'
import { resources } from './src/resources'

const ResourceList = lazy(() => import('./src/pages/resource-list'))
const ResourceDetail = lazy(() => import('./src/pages/resource-detail'))

export default definePlugin({
  i18n: translations,
  menus: [
    {
      id: 'gateways',
      parent: 'core:traffic',
      label: label('resources.gateways'),
      resource: resources.gateways.reference,
      icon: 'IconLoadBalancer',
      order: 3,
    },
    {
      id: 'httproutes',
      parent: 'core:traffic',
      label: label('resources.httproutes'),
      resource: resources.httproutes.reference,
      icon: 'IconRoute',
      order: 4,
    },
  ],
  resources: [
    {
      ...resources.gateways.reference,
      list: <ResourceList type="gateways" />,
      detail: <ResourceDetail type="gateways" />,
    },
    {
      ...resources.httproutes.reference,
      list: <ResourceList type="httproutes" />,
      detail: <ResourceDetail type="httproutes" />,
    },
  ],
})
