import { useState } from 'react'
import { useNamespace } from '@kite-dev/plugin-sdk/hooks'
import { useResources } from '@kite-dev/plugin-sdk/resources'
import { Button, ResourceTable, type ColumnDef } from '@kite-dev/plugin-sdk/ui'

import { ApplyDialog } from '../components/apply-dialog'
import { formatDate, ResourceLink, Status } from '../components/common'
import { useTranslation } from '../i18n'
import {
  resources,
  type GatewayResource,
  type ResourceType,
} from '../resources'
import styles from '../style.module.css'

export default function ResourceList({ type }: { type: ResourceType }) {
  const { t, language } = useTranslation()
  const definition = resources[type]
  const { namespace, setNamespace } = useNamespace()
  const [refreshInterval, setRefreshInterval] = useState(0)
  const [applying, setApplying] = useState(false)
  const query = useResources<GatewayResource>(definition.reference, {
    refreshInterval,
  })
  const columns: ColumnDef<GatewayResource>[] = [
    {
      accessorKey: 'metadata.name',
      header: t('fields.name'),
      cell: ({ row }) => (
        <ResourceLink
          type={type}
          name={row.original.metadata.name}
          namespace={row.original.metadata.namespace!}
        />
      ),
    },
    { accessorKey: 'metadata.namespace', header: t('fields.namespace') },
    {
      id: 'status',
      header: t('fields.status'),
      cell: ({ row }) => <Status resource={row.original} />,
    },
    ...(type === 'gateways'
      ? [
          {
            id: 'gatewayClass',
            header: t('fields.gatewayClass'),
            accessorFn: (resource: GatewayResource) =>
              resource.kind === 'Gateway' ? resource.spec.gatewayClassName : '',
          },
          {
            id: 'addresses',
            header: t('fields.addresses'),
            accessorFn: (resource: GatewayResource) =>
              resource.kind === 'Gateway'
                ? resource.status?.addresses
                    ?.map(({ value }) => value)
                    .join(', ')
                : '',
          },
          {
            id: 'listeners',
            header: t('sections.listeners'),
            accessorFn: (resource: GatewayResource) =>
              resource.kind === 'Gateway'
                ? resource.spec.listeners
                    .map((listener) => `${listener.protocol}:${listener.port}`)
                    .join(', ')
                : '',
          },
        ]
      : [
          {
            id: 'hostnames',
            header: t('fields.hostnames'),
            accessorFn: (resource: GatewayResource) =>
              resource.kind === 'HTTPRoute'
                ? resource.spec.hostnames?.join(', ') || '*'
                : '',
          },
          {
            id: 'parents',
            header: t('sections.parents'),
            accessorFn: (resource: GatewayResource) =>
              resource.kind === 'HTTPRoute'
                ? resource.spec.parentRefs?.map(({ name }) => name).join(', ')
                : '',
          },
        ]),
    {
      accessorKey: 'metadata.creationTimestamp',
      header: t('fields.created'),
      cell: ({ getValue }) => (
        <span className={styles.date}>
          {formatDate(getValue() as string | undefined, language)}
        </span>
      ),
    },
  ]
  return (
    <div className={styles.stack}>
      <ResourceTable
        id={type}
        resourceName={t(definition.label)}
        data={query.data}
        columns={columns}
        isLoading={query.isLoading}
        error={query.error}
        onRefresh={query.refetch}
        namespace={{ value: namespace, onChange: setNamespace }}
        refreshInterval={refreshInterval}
        onRefreshIntervalChange={setRefreshInterval}
        onCreateClick={() => setApplying(true)}
        emptyState={
          <div className={styles.empty}>
            <p>{t('list.empty')}</p>
            <Button onClick={() => setApplying(true)}>
              {t('actions.create')}
            </Button>
          </div>
        }
      />
      {applying && (
        <ApplyDialog
          type={type}
          onClose={() => setApplying(false)}
          onApplied={query.refetch}
        />
      )}
    </div>
  )
}
