import { useResources } from '@kite-dev/plugin-sdk/resources'
import { ResourceTable } from '@kite-dev/plugin-sdk/ui'
import { Link } from 'react-router-dom'

import { useTranslation } from '../i18n'
import {
  group,
  resources,
  type Gateway,
  type GatewayResource,
  type HTTPRoute,
} from '../resources'
import styles from '../style.module.css'
import { ParentReference, ResourceLink, Section, Status } from './common'

function GatewayRoutes({ gateway }: { gateway: Gateway }) {
  const { t } = useTranslation()
  const query = useResources<HTTPRoute>(resources.httproutes.reference, {
    namespace: '_all',
  })
  const routes = query.data?.filter((route) =>
    route.spec.parentRefs?.some(
      (parent) =>
        (parent.group ?? group) === group &&
        (parent.kind ?? 'Gateway') === 'Gateway' &&
        parent.name === gateway.metadata.name &&
        (parent.namespace ?? route.metadata.namespace) ===
          gateway.metadata.namespace
    )
  )
  return (
    <ResourceTable
      id="gateway-routes"
      resourceName={t('resources.httproutes')}
      data={routes}
      isLoading={query.isLoading}
      error={query.error}
      onRefresh={query.refetch}
      columns={[
        {
          accessorKey: 'metadata.name',
          header: t('fields.name'),
          cell: ({ row }) => (
            <ResourceLink
              type="httproutes"
              name={row.original.metadata.name}
              namespace={row.original.metadata.namespace!}
            />
          ),
        },
        { accessorKey: 'metadata.namespace', header: t('fields.namespace') },
        {
          id: 'hostnames',
          header: t('fields.hostnames'),
          accessorFn: (route) => route.spec.hostnames?.join(', ') || '*',
        },
        {
          id: 'status',
          header: t('fields.status'),
          cell: ({ row }) => <Status resource={row.original} />,
        },
      ]}
    />
  )
}

export function Relations({ resource }: { resource: GatewayResource }) {
  const { t } = useTranslation()
  if (resource.kind === 'Gateway') return <GatewayRoutes gateway={resource} />
  const namespace = resource.metadata.namespace!
  return (
    <div className={styles.stack}>
      <Section title={t('sections.parents')}>
        <div className={styles.stack}>
          {resource.spec.parentRefs?.map((parent, index) => (
            <ParentReference
              key={index}
              reference={parent}
              namespace={namespace}
            />
          ))}
          {!resource.spec.parentRefs?.length && (
            <p className={styles.muted}>{t('common.none')}</p>
          )}
        </div>
      </Section>
      <Section title={t('sections.backends')}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('sections.rule', { number: '' })}</th>
                <th>{t('fields.kind')}</th>
                <th>{t('fields.name')}</th>
                <th>{t('fields.namespace')}</th>
                <th>{t('fields.port')}</th>
                <th>{t('fields.weight')}</th>
              </tr>
            </thead>
            <tbody>
              {resource.spec.rules?.flatMap(
                (rule, ruleIndex) =>
                  rule.backendRefs?.map((backend, index) => (
                    <tr key={`${ruleIndex}:${index}`}>
                      <td>{ruleIndex + 1}</td>
                      <td>{backend.kind ?? 'Service'}</td>
                      <td>
                        {(backend.group ?? '') === '' &&
                        (backend.kind ?? 'Service') === 'Service' ? (
                          <Link
                            className={styles.link}
                            to={`/services/${encodeURIComponent(backend.namespace ?? namespace)}/${encodeURIComponent(backend.name)}`}
                          >
                            {backend.name}
                          </Link>
                        ) : (
                          backend.name
                        )}
                      </td>
                      <td>{backend.namespace ?? namespace}</td>
                      <td>{backend.port ?? '—'}</td>
                      <td>{backend.weight ?? 1}</td>
                    </tr>
                  )) ?? []
              )}
            </tbody>
          </table>
        </div>
        {!resource.spec.rules?.some((rule) => rule.backendRefs?.length) && (
          <p className={styles.muted}>{t('common.none')}</p>
        )}
      </Section>
    </div>
  )
}
