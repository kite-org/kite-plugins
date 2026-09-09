import { lazy } from 'react'
import { definePlugin } from '@kite-dev/plugin-sdk'

import { label, translations } from './src/i18n'

const ResourceList = lazy(() => import('./src/pages/resource-list'))
const ResourceDetail = lazy(() => import('./src/pages/resource-detail'))

export default definePlugin({
  i18n: translations,
  routes: [
    {
      id: 'certificates',
      path: '',
      title: label('resources.certificates'),
      element: <ResourceList key="certificates" type="certificates" />,
    },
    {
      id: 'certificate',
      path: 'certificates/:namespace/:name',
      title: label('resources.certificate'),
      element: <ResourceDetail key="certificates" type="certificates" />,
    },
    {
      id: 'certificaterequests',
      path: 'certificate-requests',
      title: label('resources.certificateRequests'),
      element: (
        <ResourceList key="certificaterequests" type="certificaterequests" />
      ),
    },
    {
      id: 'certificate-request',
      path: 'certificate-requests/:namespace/:name',
      title: label('resources.certificateRequest'),
      element: (
        <ResourceDetail key="certificaterequests" type="certificaterequests" />
      ),
    },
    {
      id: 'issuers',
      path: 'issuers',
      title: label('resources.issuers'),
      element: <ResourceList key="issuers" type="issuers" />,
    },
    {
      id: 'issuer',
      path: 'issuers/:namespace/:name',
      title: label('resources.issuer'),
      element: <ResourceDetail key="issuers" type="issuers" />,
    },
    {
      id: 'clusterissuers',
      path: 'cluster-issuers',
      title: label('resources.clusterIssuers'),
      element: <ResourceList key="clusterissuers" type="clusterissuers" />,
    },
    {
      id: 'cluster-issuer',
      path: 'cluster-issuers/:name',
      title: label('resources.clusterIssuer'),
      element: <ResourceDetail key="clusterissuers" type="clusterissuers" />,
    },
    {
      id: 'orders',
      path: 'orders',
      title: label('resources.orders'),
      element: <ResourceList key="orders" type="orders" />,
    },
    {
      id: 'order',
      path: 'orders/:namespace/:name',
      title: label('resources.order'),
      element: <ResourceDetail key="orders" type="orders" />,
    },
    {
      id: 'challenges',
      path: 'challenges',
      title: label('resources.challenges'),
      element: <ResourceList key="challenges" type="challenges" />,
    },
    {
      id: 'challenge',
      path: 'challenges/:namespace/:name',
      title: label('resources.challenge'),
      element: <ResourceDetail key="challenges" type="challenges" />,
    },
  ],
  menus: [
    {
      id: 'manager',
      label: 'cert-manager',
      icon: 'IconCertificate',
      order: 50,
    },
    {
      id: 'certificates',
      parent: 'cert-manager:manager',
      label: label('resources.certificates'),
      route: 'certificates',
      icon: 'IconCertificate',
      order: 10,
    },
    {
      id: 'certificaterequests',
      parent: 'cert-manager:manager',
      label: label('resources.certificateRequests'),
      route: 'certificaterequests',
      icon: 'IconFileCertificate',
      order: 20,
    },
    {
      id: 'issuers',
      parent: 'cert-manager:manager',
      label: label('resources.issuers'),
      route: 'issuers',
      icon: 'IconKey',
      order: 30,
    },
    {
      id: 'clusterissuers',
      parent: 'cert-manager:manager',
      label: label('resources.clusterIssuers'),
      route: 'clusterissuers',
      icon: 'IconKey',
      order: 40,
    },
    {
      id: 'orders',
      parent: 'cert-manager:manager',
      label: label('resources.orders'),
      route: 'orders',
      icon: 'IconListDetails',
      order: 50,
    },
    {
      id: 'challenges',
      parent: 'cert-manager:manager',
      label: label('resources.challenges'),
      route: 'challenges',
      icon: 'IconShieldCheck',
      order: 60,
    },
  ],
})
