import { lazy } from 'react'
import { definePlugin } from '@kite-dev/plugin-sdk'

import { label, translations } from './src/i18n'

const ResourceMap = lazy(() => import('./src/resource-map'))

export default definePlugin({
  i18n: translations,
  routes: [
    { id: 'map', path: '', title: label('title'), element: <ResourceMap /> },
  ],
  menus: [
    {
      id: 'map',
      parent: 'core:application',
      label: label('title'),
      route: 'map',
      icon: 'IconMap',
      order: 1,
    },
  ],
})
