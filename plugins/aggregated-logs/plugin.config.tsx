import { lazy } from 'react'
import { definePlugin } from '@kite-dev/plugin-sdk'
import { IconLogs } from '@tabler/icons-react'

import { label, translations } from './src/i18n'

const LogsPage = lazy(() => import('./src/page'))

export default definePlugin({
  i18n: translations,
  routes: [
    { id: 'logs', path: '', title: label('title'), element: <LogsPage /> },
  ],
  menus: [
    {
      id: 'logs',
      parent: 'core:application',
      label: label('title'),
      route: 'logs',
      icon: <IconLogs />,
    },
  ],
})
