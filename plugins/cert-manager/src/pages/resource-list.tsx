import { useState } from 'react'
import { useNamespace } from '@kite-dev/plugin-sdk/hooks'
import { useResources } from '@kite-dev/plugin-sdk/resources'
import { Button, ResourceTable, type ColumnDef } from '@kite-dev/plugin-sdk/ui'

import { ApplyDialog } from '../components/apply-dialog'
import {
  ConditionBadge,
  formatDate,
  IssuerLink,
  ResourceLink,
  SecretLink,
  StatusBadge,
} from '../components/common'
import { useTranslation } from '../i18n'
import {
  getCondition,
  issuerType,
  resources,
  type CertManagerResource,
  type ResourceType,
} from '../resources'
import styles from './page.module.css'

export default function ResourceListPage({ type }: { type: ResourceType }) {
  const definition = resources[type]
  const { namespace, setNamespace } = useNamespace()
  const { t, language } = useTranslation()
  const [refreshInterval, setRefreshInterval] = useState(0)
  const [applying, setApplying] = useState(false)
  const query = useResources<CertManagerResource>(definition.reference, {
    refreshInterval,
  })

  const columns: ColumnDef<CertManagerResource, unknown>[] = [
    {
      accessorKey: 'metadata.name',
      header: t('fields.name'),
      cell: ({ row }) => (
        <ResourceLink
          type={type}
          name={row.original.metadata.name}
          namespace={row.original.metadata.namespace}
        />
      ),
    },
    ...(definition.reference.scope !== 'Cluster'
      ? [
          {
            accessorKey: 'metadata.namespace',
            header: t('fields.namespace'),
          },
        ]
      : []),
    {
      id: 'status',
      accessorFn: (resource) =>
        resource.kind === 'Order' || resource.kind === 'Challenge'
          ? resource.status?.state
          : getCondition(resource, 'Ready')?.status,
      header: t('fields.status'),
      cell: ({ row }) => <StatusBadge resource={row.original} />,
    },
  ]

  if (type === 'certificates') {
    columns.push(
      {
        id: 'dnsNames',
        header: t('fields.dnsNames'),
        accessorFn: (resource) =>
          resource.kind === 'Certificate'
            ? resource.spec.dnsNames?.join(', ')
            : undefined,
        cell: ({ getValue }) => (
          <span className={styles.domains} title={String(getValue() ?? '')}>
            {String(getValue() ?? '—')}
          </span>
        ),
      },
      {
        id: 'secret',
        header: t('fields.secret'),
        accessorFn: (resource) =>
          resource.kind === 'Certificate'
            ? resource.spec.secretName
            : undefined,
        cell: ({ row }) =>
          row.original.kind === 'Certificate' ? (
            <SecretLink
              name={row.original.spec.secretName}
              namespace={row.original.metadata.namespace}
            />
          ) : null,
      },
      {
        id: 'expires',
        header: t('fields.expires'),
        accessorFn: (resource) =>
          resource.kind === 'Certificate'
            ? resource.status?.notAfter
            : undefined,
        cell: ({ getValue }) => (
          <span className={styles.date}>
            {formatDate(getValue() as string | undefined, language)}
          </span>
        ),
      }
    )
  }

  if (type === 'certificaterequests') {
    for (const condition of ['Approved', 'Denied']) {
      columns.push({
        id: condition,
        header:
          condition === 'Approved' ? t('status.approved') : t('status.denied'),
        accessorFn: (resource) => getCondition(resource, condition)?.status,
        cell: ({ row }) => (
          <ConditionBadge resource={row.original} type={condition} />
        ),
      })
    }
    columns.push({
      id: 'requester',
      header: t('fields.requester'),
      accessorFn: (resource) =>
        resource.kind === 'CertificateRequest'
          ? resource.spec.username
          : undefined,
      cell: ({ getValue }) => (
        <span className={styles.domains} title={String(getValue() ?? '')}>
          {String(getValue() ?? '—')}
        </span>
      ),
    })
  }

  if (type === 'issuers' || type === 'clusterissuers') {
    columns.push({
      id: 'issuerType',
      header: t('fields.type'),
      accessorFn: (resource) =>
        resource.kind === 'Issuer' || resource.kind === 'ClusterIssuer'
          ? issuerType(resource)
          : undefined,
    })
  } else {
    columns.push({
      id: 'issuer',
      header: t('resources.issuer'),
      accessorFn: (resource) =>
        'issuerRef' in resource.spec ? resource.spec.issuerRef.name : undefined,
      cell: ({ row }) =>
        'issuerRef' in row.original.spec ? (
          <IssuerLink
            reference={row.original.spec.issuerRef}
            namespace={row.original.metadata.namespace}
          />
        ) : null,
    })
  }

  if (type === 'challenges') {
    columns.push(
      {
        id: 'dnsName',
        header: t('fields.domain'),
        accessorFn: (resource) =>
          resource.kind === 'Challenge' ? resource.spec.dnsName : undefined,
      },
      {
        id: 'challengeType',
        header: t('fields.type'),
        accessorFn: (resource) =>
          resource.kind === 'Challenge' ? resource.spec.type : undefined,
      },
      {
        id: 'presented',
        header: t('fields.presented'),
        accessorFn: (resource) =>
          resource.kind === 'Challenge'
            ? resource.status?.presented
            : undefined,
        cell: ({ getValue }) =>
          getValue() === undefined
            ? '—'
            : getValue()
              ? t('common.yes')
              : t('common.no'),
      }
    )
  }

  columns.push({
    accessorKey: 'metadata.creationTimestamp',
    header: t('fields.created'),
    cell: ({ getValue }) => (
      <span className={styles.date}>
        {formatDate(getValue() as string | undefined, language)}
      </span>
    ),
  })

  const search = (resource: CertManagerResource, value: string) => {
    const values = [
      resource.metadata.name,
      resource.metadata.namespace,
      ...Object.keys(resource.metadata.labels ?? {}),
      ...Object.values(resource.metadata.labels ?? {}),
    ]
    if ('issuerRef' in resource.spec) values.push(resource.spec.issuerRef.name)
    if (resource.kind === 'Certificate')
      values.push(resource.spec.secretName, ...(resource.spec.dnsNames ?? []))
    if (resource.kind === 'Challenge')
      values.push(resource.spec.dnsName, resource.spec.type)
    if (resource.kind === 'CertificateRequest')
      values.push(resource.spec.username)
    if (resource.kind === 'Issuer' || resource.kind === 'ClusterIssuer')
      values.push(issuerType(resource))
    return values.some((candidate) =>
      candidate?.toLowerCase().includes(value.toLowerCase())
    )
  }

  const missingCRD = query.error?.message.includes(
    'CustomResourceDefinition not found'
  )

  return (
    <div className={styles.page}>
      {missingCRD ? (
        <div className={styles.empty} role="alert">
          <h2 className={styles.sectionTitle}>{t('list.unavailable')}</h2>
          <p className={styles.muted}>{t('list.missingCrd')}</p>
          <code>
            {definition.reference.resource}.{definition.reference.group}
          </code>
          <a
            className={styles.link}
            href="https://cert-manager.io/docs/installation/"
            target="_blank"
            rel="noreferrer"
          >
            {t('list.installationGuide')}
          </a>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t('actions.refresh')}
          </Button>
        </div>
      ) : (
        <ResourceTable
          id={type}
          resourceName={t(definition.label)}
          data={query.data}
          columns={columns}
          isLoading={query.isLoading}
          error={query.error}
          onRefresh={() => query.refetch()}
          refreshInterval={refreshInterval}
          onRefreshIntervalChange={setRefreshInterval}
          namespace={
            definition.reference.scope === 'Cluster'
              ? undefined
              : { value: namespace, onChange: setNamespace }
          }
          searchQueryFilter={search}
          onCreateClick={
            definition.editable ? () => setApplying(true) : undefined
          }
          emptyState={
            <div className={styles.empty}>
              <p>{t('list.empty')}</p>
              <p className={styles.muted}>
                {definition.editable
                  ? t('list.emptyEditable')
                  : t('list.emptyGenerated')}
              </p>
              {definition.editable ? (
                <Button onClick={() => setApplying(true)}>
                  {t('actions.applyYaml')}
                </Button>
              ) : (
                <Button variant="outline" onClick={() => void query.refetch()}>
                  {t('actions.refresh')}
                </Button>
              )}
            </div>
          }
        />
      )}
      {applying && (
        <ApplyDialog
          type={type}
          open={applying}
          onOpenChange={setApplying}
          onApplied={() => query.refetch()}
        />
      )}
    </div>
  )
}
