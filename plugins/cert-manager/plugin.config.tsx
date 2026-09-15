import { lazy } from 'react'
import { definePlugin } from '@kite-dev/plugin-sdk'

import { translations } from './src/i18n'
import { resources, type ResourceType } from './src/resources'

const ResourceList = lazy(() => import('./src/pages/resource-list'))
const ResourceDetail = lazy(() => import('./src/pages/resource-detail'))

export default definePlugin({
  i18n: translations,
  resources: (Object.keys(resources) as ResourceType[]).map((type) => ({
    ...resources[type].reference,
    list: <ResourceList type={type} />,
    detail: <ResourceDetail type={type} />,
  })),
})
