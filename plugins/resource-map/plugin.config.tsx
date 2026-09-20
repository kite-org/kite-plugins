import { lazy } from 'react'
import { definePlugin } from '@kite-dev/plugin-sdk'

import { label, translations } from './src/i18n'

const ResourceMap = lazy(() => import('./src/resource-map'))
const Settings = lazy(() => import('./src/settings'))

export default definePlugin({
  i18n: translations,
  settings: {
    label: label('settings.title'),
    element: <Settings />,
  },
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
