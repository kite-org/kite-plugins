import { lazy } from 'react'
import { definePlugin } from '@kite-dev/plugin-sdk'

import { label, translations } from './src/i18n'

const HomePage = lazy(() => import('./src/pages/home'))

export default definePlugin({
  i18n: translations,
  routes: [
    {
      id: 'home',
      path: '',
      title: label('navigation.home'),
      element: <HomePage />,
    },
  ],
  menus: [
    {
      id: 'home',
      parent: 'core:other',
      label: label('navigation.home'),
      route: 'home',
      icon: 'IconBox',
    },
  ],
})
