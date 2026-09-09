import type { ReactNode } from 'react'
import { PluginLink } from '@kite-dev/plugin-sdk/navigation'
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@kite-dev/plugin-sdk/ui'
import { Link } from 'react-router-dom'

import { useTranslation, type TranslationKey } from '../i18n'
import styles from '../pages/page.module.css'
import {
  getCondition,
  isCurrentCondition,
  resources,
  type CertManagerResource,
  type Condition,
  type IssuerReference,
  type ResourceType,
} from '../resources'

type Tone = 'success' | 'warning' | 'danger' | 'neutral'

function Status({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode
  tone?: Tone
  title?: string
}) {
  return (
    <Badge
      variant="outline"
      className={styles.status}
      data-tone={tone}
      title={title}
    >
      {children}
    </Badge>
  )
}

export function ConditionBadge({
  resource,
  type,
}: {
  resource: CertManagerResource
  type: string
}) {
  const { t } = useTranslation()
  const condition = getCondition(resource, type)
  if (!condition) return <Status>{t('status.unknown')}</Status>
  if (!isCurrentCondition(resource, condition))
    return <Status tone="warning">{t('status.reconciling')}</Status>
  const positive = type !== 'Denied' && type !== 'InvalidRequest'
  const tone =
    condition.status === 'Unknown'
      ? 'neutral'
      : type === 'Issuing'
        ? condition.status === 'True'
          ? 'warning'
          : 'neutral'
        : (condition.status === 'True') === positive
          ? 'success'
          : 'danger'
  return (
    <Status tone={tone} title={condition.message}>
      {t(
        condition.status === 'True'
          ? 'status.true'
          : condition.status === 'False'
            ? 'status.false'
            : 'status.unknown'
      )}
    </Status>
  )
}

export function StatusBadge({ resource }: { resource: CertManagerResource }) {
  const { t } = useTranslation()
  if (resource.metadata.deletionTimestamp)
    return <Status>{t('status.deleting')}</Status>
  if (resource.kind === 'Order' || resource.kind === 'Challenge') {
    const state = resource.status?.state
    const labels: Record<string, TranslationKey | undefined> = {
      valid: 'status.valid',
      invalid: 'status.invalid',
      expired: 'status.expired',
      errored: 'status.errored',
      pending: 'status.pending',
      ready: 'status.ready',
      processing: 'status.processing',
    }
    const stateLabel = state ? labels[state] : undefined
    const tone: Tone =
      state === 'valid'
        ? 'success'
        : ['invalid', 'expired', 'errored'].includes(state ?? '')
          ? 'danger'
          : state
            ? 'warning'
            : 'neutral'
    return (
      <Status tone={tone} title={resource.status?.reason}>
        {state ? (stateLabel ? t(stateLabel) : state) : t('status.unknown')}
      </Status>
    )
  }
  if (
    resource.kind === 'Certificate' &&
    resource.status?.notAfter &&
    Date.parse(resource.status.notAfter) <= Date.now()
  ) {
    return <Status tone="danger">{t('status.expired')}</Status>
  }
  if (resource.kind === 'CertificateRequest') {
    const denied = getCondition(resource, 'Denied')
    if (denied?.status === 'True')
      return (
        <Status tone="danger" title={denied.message}>
          {t('status.denied')}
        </Status>
      )
    const invalid = getCondition(resource, 'InvalidRequest')
    if (invalid?.status === 'True')
      return (
        <Status tone="danger" title={invalid.message}>
          {t('status.invalidRequest')}
        </Status>
      )
    if (getCondition(resource, 'Approved')?.status !== 'True')
      return <Status tone="warning">{t('status.awaitingApproval')}</Status>
  }
  const ready = getCondition(resource, 'Ready')
  const issuing = getCondition(resource, 'Issuing')
  if (ready && !isCurrentCondition(resource, ready))
    return <Status tone="warning">{t('status.reconciling')}</Status>
  if (ready?.status === 'True')
    return (
      <Status tone="success" title={ready.message}>
        {t('status.ready')}
      </Status>
    )
  if (issuing?.status === 'True' && isCurrentCondition(resource, issuing))
    return (
      <Status tone="warning" title={issuing.message}>
        {t('status.issuing')}
      </Status>
    )
  if (ready?.status === 'False')
    return (
      <Status tone="danger" title={ready.message}>
        {t('status.notReady')}
      </Status>
    )
  return <Status>{t('status.unknown')}</Status>
}

export function ResourceLink({
  type,
  name,
  namespace,
  children,
}: {
  type: ResourceType
  name: string
  namespace?: string
  children?: ReactNode
}) {
  const definition = resources[type]
  const params: Record<string, string> =
    definition.reference.scope === 'Cluster'
      ? { name }
      : { name, namespace: namespace! }
  return (
    <PluginLink
      className={styles.link}
      route={definition.detailRoute}
      params={params}
    >
      {children ?? name}
    </PluginLink>
  )
}

export function IssuerLink({
  reference,
  namespace,
}: {
  reference: IssuerReference
  namespace?: string
}) {
  const kind = reference.kind ?? 'Issuer'
  if (
    (reference.group && reference.group !== 'cert-manager.io') ||
    !['Issuer', 'ClusterIssuer'].includes(kind)
  ) {
    return (
      <span>
        {kind}/{reference.name}
        {reference.group ? ` (${reference.group})` : ''}
      </span>
    )
  }
  return (
    <ResourceLink
      type={kind === 'ClusterIssuer' ? 'clusterissuers' : 'issuers'}
      name={reference.name}
      namespace={namespace}
    >
      {kind}/{reference.name}
    </ResourceLink>
  )
}

export function SecretLink({
  name,
  namespace,
}: {
  name: string
  namespace?: string
}) {
  if (!namespace) return <span>{name}</span>
  return (
    <Link
      className={styles.link}
      to={`/secrets/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`}
    >
      {name}
    </Link>
  )
}

export function formatDate(value?: string, language?: string): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' })
}

export function Fields({
  title,
  fields,
}: {
  title: ReactNode
  fields: { label: ReactNode; value: ReactNode }[]
}) {
  return (
    <Card className={styles.card}>
      <CardHeader className={styles.cardHeader}>
        <CardTitle className={styles.sectionTitle}>{title}</CardTitle>
      </CardHeader>
      <CardContent className={styles.cardContent}>
        <dl className={styles.fields}>
          {fields.map((field, index) => (
            <div className={styles.field} key={index}>
              <dt>{field.label}</dt>
              <dd>{field.value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}

export function Conditions({ resource }: { resource: CertManagerResource }) {
  const { t, language } = useTranslation()
  const conditions: Condition[] = resource.status?.conditions ?? []
  if (!conditions.length)
    return <p className={styles.muted}>{t('conditions.empty')}</p>
  return (
    <div className={styles.tableScroll}>
      <table className={styles.conditionTable}>
        <caption className={styles.srOnly}>{t('conditions.title')}</caption>
        <thead>
          <tr>
            {[
              t('fields.type'),
              t('fields.status'),
              t('fields.reason'),
              t('fields.message'),
              t('fields.lastTransition'),
            ].map((label) => (
              <th scope="col" key={label}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {conditions.map((condition) => (
            <tr key={condition.type}>
              <td>{condition.type}</td>
              <td>
                <ConditionBadge resource={resource} type={condition.type} />
              </td>
              <td>{condition.reason ?? '—'}</td>
              <td className={styles.message}>{condition.message ?? '—'}</td>
              <td className={styles.date}>
                {formatDate(condition.lastTransitionTime, language)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
