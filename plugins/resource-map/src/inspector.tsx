import { useResourceEvents } from '@kite-dev/plugin-sdk/resources'
import { Button } from '@kite-dev/plugin-sdk/ui'
import {
  IconAlertCircle,
  IconArrowUpRight,
  IconChevronRight,
  IconX,
} from '@tabler/icons-react'
import { Link } from 'react-router-dom'

import { ResourceStatus } from './graph'
import { useTranslation } from './i18n'
import { resourceIcons } from './icons'
import styles from './map.module.css'
import { resourcePath, type MapResource, type Relation } from './model'

export function Inspector({
  resource,
  resources,
  relations,
  onSelect,
  onClose,
}: {
  resource: MapResource
  resources: MapResource[]
  relations: Relation[]
  onSelect: (resource: MapResource) => void
  onClose: () => void
}) {
  const { t, language } = useTranslation()
  const events = useResourceEvents(resource.reference, resource.name, {
    namespace: resource.namespace,
    refreshInterval: 15000,
  })
  const connectedIds = new Set(
    relations.flatMap((edge) =>
      edge.source === resource.id
        ? [edge.target]
        : edge.target === resource.id
          ? [edge.source]
          : []
    )
  )
  const connected = resources.filter((r) => connectedIds.has(r.id))
  const recent = [...(events.data ?? [])]
    .sort((a, b) =>
      (
        b.lastTimestamp ??
        b.eventTime ??
        b.metadata?.creationTimestamp ??
        ''
      ).localeCompare(
        a.lastTimestamp ?? a.eventTime ?? a.metadata?.creationTimestamp ?? ''
      )
    )
    .slice(0, 3)
  const Icon = resourceIcons[resource.type]
  const fields = [
    [t('fields.namespace'), resource.namespace ?? t('groups.cluster')],
    ...(resource.nodeName ? [[t('fields.node'), resource.nodeName]] : []),
    ...(resource.desired !== undefined
      ? [
          [
            t(
              resource.type === 'pods' ? 'fields.containers' : 'fields.replicas'
            ),
            `${resource.ready} / ${resource.desired}`,
          ],
        ]
      : []),
    ...(resource.restarts !== undefined
      ? [[t('fields.restarts'), String(resource.restarts)]]
      : []),
    ...(resource.details
      ?.filter((item) => item.value)
      .map((item) => [t(`fields.${item.label}`), item.value]) ?? []),
    ...(resource.metadata.creationTimestamp
      ? [
          [
            t('fields.created'),
            new Date(resource.metadata.creationTimestamp).toLocaleString(
              language
            ),
          ],
        ]
      : []),
  ]
  return (
    <aside className={styles.inspector} aria-label={t('inspector')}>
      <div className={styles.inspectorTop}>
        <span className={styles.resourceIcon}>
          <Icon size={22} />
        </span>
        <span className={styles.kind}>{resource.kind}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('actions.close')}
          onClick={onClose}
        >
          <IconX size={18} />
        </Button>
      </div>
      <h2>{resource.name}</h2>
      <ResourceStatus resource={resource} />
      <dl className={styles.fields}>
        {fields.map(([key, value], index) => (
          <div key={`${key}:${index}`}>
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <section className={styles.inspectorSection}>
        <h3>{t('events.title')}</h3>
        {events.isLoading ? (
          <p className={styles.muted}>{t('loading')}</p>
        ) : events.error ? (
          <p role="alert" className={styles.error}>
            {t('events.failed')}
          </p>
        ) : recent.length ? (
          <div className={styles.events}>
            {recent.map((event, index) => (
              <details
                key={event.metadata?.uid}
                className={styles.event}
                open={index === 0}
                data-warning={event.type === 'Warning' || undefined}
              >
                <summary>
                  <IconAlertCircle size={16} />
                  <strong>{event.reason}</strong>
                </summary>
                <div>
                  <p>{event.message}</p>
                  <span>
                    {(event.lastTimestamp ??
                      event.eventTime ??
                      event.metadata?.creationTimestamp) &&
                      new Date(
                        event.lastTimestamp ??
                          event.eventTime ??
                          event.metadata!.creationTimestamp!
                      ).toLocaleTimeString(language, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                  </span>
                </div>
              </details>
            ))}
          </div>
        ) : (
          <p className={styles.muted}>{t('events.empty')}</p>
        )}
      </section>
      <section className={styles.inspectorSection}>
        <h3>{t('related')}</h3>
        <div className={styles.related}>
          {connected.length ? (
            connected.map((item) => {
              const RelatedIcon = resourceIcons[item.type]
              return (
                <button key={item.id} onClick={() => onSelect(item)}>
                  <RelatedIcon size={20} />
                  <span>
                    <small>{item.kind}</small>
                    <span>{item.name}</span>
                  </span>
                  <IconChevronRight size={16} />
                </button>
              )
            })
          ) : (
            <p className={styles.muted}>{t('noRelations')}</p>
          )}
        </div>
      </section>
      <div className={styles.inspectorActions}>
        <Button asChild>
          <Link to={resourcePath(resource)}>
            {t('actions.details')}
            <IconArrowUpRight size={16} />
          </Link>
        </Button>
        {resource.type === 'pods' && (
          <Button variant="link" asChild>
            <Link to={`${resourcePath(resource)}?tab=logs`}>
              {t('actions.logs')}
            </Link>
          </Button>
        )}
      </div>
    </aside>
  )
}
