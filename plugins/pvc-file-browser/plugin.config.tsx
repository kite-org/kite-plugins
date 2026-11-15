import { lazy } from 'react'
import { definePlugin } from '@kite-dev/plugin-sdk'

import { label, translations } from './src/i18n'

const PvcFiles = lazy(() => import('./src/pvc-files'))

export default definePlugin({
  i18n: translations,
  resources: [
    {
      group: '',
      resource: 'persistentvolumeclaims',
      tabs: [{ id: 'files', label: label('title'), element: <PvcFiles /> }],
    },
  ],
})
