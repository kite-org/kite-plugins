import type { ReactNode } from 'react'
import type { MetaV1 } from '@kite-dev/plugin-sdk/k8s'
import { ResourceLink as KiteResourceLink } from '@kite-dev/plugin-sdk/navigation'
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@kite-dev/plugin-sdk/ui'

import { useTranslation } from '../i18n'
import {
  group,
  resources,
  type GatewayResource,
  type ObjectReference,
  type ResourceType,
} from '../resources'
import styles from '../style.module.css'

export function ResourceLink({
  type,
  name,
  namespace,
}: {
  type: ResourceType
  name: string
  namespace: string
}) {
  return (
    <KiteResourceLink
      className={styles.link}
      resource={resources[type].reference}
      name={name}
      namespace={namespace}
    >
      {name}
    </KiteResourceLink>
  )
}

export function ParentReference({
  reference,
  namespace,
}: {
  reference: ObjectReference
  namespace: string
}) {
  const resolvedNamespace = reference.namespace ?? namespace
  return (
    <span>
      {(reference.group ?? group) === group &&
      (reference.kind ?? 'Gateway') === 'Gateway' ? (
        <ResourceLink
          type="gateways"
          name={reference.name}
          namespace={resolvedNamespace}
        />
      ) : (
        `${reference.kind ?? 'Gateway'}/${reference.name}`
      )}
      {resolvedNamespace !== namespace && (
        <span className={styles.muted}> ({resolvedNamespace})</span>
      )}
      {reference.sectionName && (
        <span className={styles.muted}> / {reference.sectionName}</span>
      )}
    </span>
  )
}

export function Status({ resource }: { resource: GatewayResource }) {
  const { t } = useTranslation()
  const conditions =
    resource.kind === 'Gateway'
      ? (resource.status?.conditions?.filter(
          (condition) => condition.type === 'Programmed'
        ) ?? [])
      : (resource.status?.parents?.flatMap(
          (parent) =>
            parent.conditions?.filter(
              (condition) => condition.type === 'Accepted'
            ) ?? []
        ) ?? [])
  const current =
    conditions.length > 0 &&
    conditions.every(
      (condition) =>
        condition.observedGeneration === resource.metadata.generation
    )
  const status =
    !current || conditions.some((condition) => condition.status === 'Unknown')
      ? 'pending'
      : conditions.every((condition) => condition.status === 'True')
        ? 'ready'
        : 'notReady'
  return (
    <Badge
      variant={
        status === 'notReady'
          ? 'destructive'
          : status === 'ready'
            ? 'secondary'
            : 'outline'
      }
    >
      {t(`status.${status}`)}
    </Badge>
  )
}

export function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <Card className={styles.card}>
      <CardHeader className={styles.cardHeader}>
        <CardTitle className={styles.sectionTitle}>{title}</CardTitle>
      </CardHeader>
      <CardContent className={styles.cardContent}>{children}</CardContent>
    </Card>
  )
}

export function Conditions({
  conditions = [],
  generation,
}: {
  conditions?: MetaV1.Condition[]
  generation?: number
}) {
  const { t } = useTranslation()
  if (!conditions.length)
    return <p className={styles.muted}>{t('common.noStatus')}</p>
  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('fields.type')}</th>
            <th>{t('fields.status')}</th>
            <th>{t('fields.reason')}</th>
            <th>{t('fields.message')}</th>
          </tr>
        </thead>
        <tbody>
          {conditions.map((condition) => (
            <tr key={condition.type}>
              <td>{condition.type}</td>
              <td>
                {condition.observedGeneration !== generation
                  ? t('status.pending')
                  : condition.status}
              </td>
              <td>{condition.reason || '—'}</td>
              <td>{condition.message || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function formatDate(value: string | undefined, language: string) {
  if (!value) return '—'
  return new Date(value).toLocaleString(language)
}
