import { lazy } from 'react'
import { definePlugin } from '@kite-dev/plugin-sdk'

import { label, translations } from './src/i18n'

const PoliciesPage = lazy(() => import('./src/policies'))

export default definePlugin({
  i18n: translations,
  routes: [
    {
      id: 'policies',
      path: '',
      title: label('title'),
      element: <PoliciesPage />,
    },
  ],
  menus: [
    {
      id: 'policies',
      parent: 'core:security',
      label: label('title'),
      route: 'policies',
      icon: 'IconShieldCheck',
    },
  ],
})
