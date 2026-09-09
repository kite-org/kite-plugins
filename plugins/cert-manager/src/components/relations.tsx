import { useResources } from '@kite-dev/plugin-sdk/resources'
import { ResourceTable, type ColumnDef } from '@kite-dev/plugin-sdk/ui'

import { useTranslation } from '../i18n'
import styles from '../pages/page.module.css'
import type { CertManagerResource, ResourceType } from '../resources'
import { resources } from '../resources'
import { Fields, formatDate, ResourceLink, StatusBadge } from './common'

function RelatedList({
  type,
  namespace,
  matches,
}: {
  type: ResourceType
  namespace: string
  matches: (resource: CertManagerResource) => boolean
}) {
  const { t, language } = useTranslation()
  const definition = resources[type]
  const query = useResources<CertManagerResource>(definition.reference, {
    namespace,
    reduce: false,
  })
  const columns: ColumnDef<CertManagerResource, unknown>[] = [
    {
      id: 'name',
      accessorFn: (resource) => resource.metadata.name,
      header: t('fields.name'),
      cell: ({ row }) => (
        <ResourceLink
          type={type}
          name={row.original.metadata.name}
          namespace={row.original.metadata.namespace}
        />
      ),
    },
    {
      id: 'namespace',
      accessorFn: (resource) => resource.metadata.namespace,
      header: t('fields.namespace'),
    },
    {
      id: 'status',
      header: t('fields.status'),
      cell: ({ row }) => <StatusBadge resource={row.original} />,
    },
    ...(type === 'certificaterequests'
      ? [
          {
            id: 'revision',
            accessorFn: (resource: CertManagerResource) =>
              resource.metadata.annotations?.[
                'cert-manager.io/certificate-revision'
              ] ?? '—',
            header: t('fields.revision'),
          },
        ]
      : []),
    {
      id: 'created',
      accessorFn: (resource) => resource.metadata.creationTimestamp,
      header: t('fields.created'),
      cell: ({ row }) =>
        formatDate(row.original.metadata.creationTimestamp, language),
    },
  ]

  return (
    <section className={styles.stack}>
      <h2 className={styles.sectionTitle}>{t(definition.label)}</h2>
      <ResourceTable
        id={`related-${type}`}
        resourceName={t(definition.label)}
        data={query.data?.filter(matches)}
        columns={columns}
        isLoading={query.isLoading}
        error={query.error}
        onRefresh={query.refetch}
        emptyState={<p className={styles.empty}>{t('relations.empty')}</p>}
      />
    </section>
  )
}

export function Relations({ resource }: { resource: CertManagerResource }) {
  const { t } = useTranslation()
  const namespace = resource.metadata.namespace ?? '_all'
  const owners = (resource.metadata.ownerReferences ?? []).flatMap((owner) => {
    const entry = (
      Object.entries(resources) as [
        ResourceType,
        (typeof resources)[ResourceType],
      ][]
    ).find(
      ([, definition]) =>
        definition.kind === owner.kind &&
        definition.reference.group === owner.apiVersion.split('/')[0]
    )
    return entry ? [{ owner, type: entry[0] }] : []
  })
  const childType =
    resource.kind === 'Certificate'
      ? 'certificaterequests'
      : resource.kind === 'CertificateRequest'
        ? 'orders'
        : resource.kind === 'Order'
          ? 'challenges'
          : undefined
  const matchesOwner = (child: CertManagerResource) =>
    !!resource.metadata.uid &&
    child.metadata.namespace === resource.metadata.namespace &&
    !!child.metadata.ownerReferences?.some(
      (owner) =>
        owner.uid === resource.metadata.uid &&
        owner.kind === resource.kind &&
        owner.apiVersion.split('/')[0] === resource.apiVersion.split('/')[0]
    )
  const isIssuer =
    resource.kind === 'Issuer' || resource.kind === 'ClusterIssuer'
  const matchesIssuer = (child: CertManagerResource) => {
    if (!('issuerRef' in child.spec)) return false
    const reference = child.spec.issuerRef
    return (
      reference.name === resource.metadata.name &&
      (reference.group ?? 'cert-manager.io') === 'cert-manager.io' &&
      (reference.kind ?? 'Issuer') === resource.kind &&
      (resource.kind === 'ClusterIssuer' ||
        child.metadata.namespace === resource.metadata.namespace)
    )
  }

  return (
    <div className={styles.stack}>
      {owners.length > 0 && (
        <Fields
          title={t('sections.owners')}
          fields={owners.map(({ owner, type }) => ({
            label: t(resources[type].singular),
            value: (
              <ResourceLink
                type={type}
                name={owner.name}
                namespace={resource.metadata.namespace}
              />
            ),
          }))}
        />
      )}
      {childType && (
        <RelatedList
          type={childType}
          namespace={namespace}
          matches={matchesOwner}
        />
      )}
      {isIssuer && (
        <>
          <RelatedList
            type="certificates"
            namespace={namespace}
            matches={matchesIssuer}
          />
          <RelatedList
            type="certificaterequests"
            namespace={namespace}
            matches={matchesIssuer}
          />
        </>
      )}
      {!owners.length && !childType && !isIssuer && (
        <p className={styles.empty}>{t('relations.empty')}</p>
      )}
    </div>
  )
}
