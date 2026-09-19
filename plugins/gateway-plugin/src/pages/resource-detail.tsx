import { resolveResourcePath } from '@kite-dev/plugin-sdk/navigation'
import { updateResource, useResource } from '@kite-dev/plugin-sdk/resources'
import {
  ResourceDetailShell,
  ResourceEvents,
  ResourceOverview,
  ResourceYaml,
} from '@kite-dev/plugin-sdk/ui'
import { Link, useNavigate, useParams } from 'react-router-dom'

import {
  Conditions,
  ParentReference,
  Section,
  Status,
} from '../components/common'
import { GatewayPods } from '../components/gateway-pods'
import { History } from '../components/history'
import { Relations } from '../components/relations'
import { useTranslation } from '../i18n'
import {
  resources,
  type GatewayResource,
  type ResourceType,
} from '../resources'
import styles from '../style.module.css'

function Overview({
  resource,
  type,
}: {
  resource: GatewayResource
  type: ResourceType
}) {
  const { t } = useTranslation()
  const namespace = resource.metadata.namespace!
  return (
    <ResourceOverview
      resource={resources[type].reference}
      name={resource.metadata.name}
      namespace={namespace}
      metadata={resource.metadata}
      relatedResources={null}
      fields={[
        { label: t('fields.status'), value: <Status resource={resource} /> },
        ...(resource.kind === 'Gateway'
          ? [
              {
                label: t('fields.gatewayClass'),
                value: resource.spec.gatewayClassName,
              },
              {
                label: t('fields.addresses'),
                value:
                  resource.status?.addresses
                    ?.map(({ value }) => value)
                    .join(', ') || '—',
              },
            ]
          : [
              {
                label: t('fields.hostnames'),
                value: resource.spec.hostnames?.join(', ') || '*',
              },
            ]),
      ]}
    >
      <div className={styles.stack}>
        {resource.kind === 'Gateway' ? (
          <>
            <GatewayPods gateway={resource} />
            <Section title={t('sections.conditions')}>
              <Conditions
                conditions={resource.status?.conditions}
                generation={resource.metadata.generation}
              />
            </Section>
            <Section title={t('sections.listeners')}>
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t('fields.name')}</th>
                      <th>{t('fields.hostname')}</th>
                      <th>{t('fields.protocol')}</th>
                      <th>{t('fields.port')}</th>
                      <th>{t('fields.tls')}</th>
                      <th>{t('fields.attachedRoutes')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resource.spec.listeners.map((listener) => (
                      <tr key={listener.name}>
                        <td>{listener.name}</td>
                        <td>{listener.hostname ?? '*'}</td>
                        <td>{listener.protocol}</td>
                        <td>{listener.port}</td>
                        <td>
                          {listener.tls?.mode ??
                            (listener.tls ? 'Terminate' : '—')}
                          {listener.tls?.certificateRefs?.map(
                            (reference, index) => (
                              <div key={index}>
                                {(reference.group ?? '') === '' &&
                                (reference.kind ?? 'Secret') === 'Secret' ? (
                                  <Link
                                    className={styles.link}
                                    to={`/secrets/${encodeURIComponent(reference.namespace ?? namespace)}/${encodeURIComponent(reference.name)}`}
                                  >
                                    {reference.name}
                                  </Link>
                                ) : (
                                  `${reference.kind ?? 'Secret'}/${reference.name}`
                                )}
                              </div>
                            )
                          )}
                        </td>
                        <td>
                          {resource.status?.listeners?.find(
                            ({ name }) => name === listener.name
                          )?.attachedRoutes ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {resource.status?.listeners?.map((listener) => (
                <div className={styles.stack} key={listener.name}>
                  <h3 className={styles.sectionTitle}>{listener.name}</h3>
                  <Conditions
                    conditions={listener.conditions}
                    generation={resource.metadata.generation}
                  />
                </div>
              ))}
            </Section>
          </>
        ) : (
          <>
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
                {resource.status?.parents?.map((parent, index) => (
                  <div className={styles.stack} key={index}>
                    <h3 className={styles.sectionTitle}>
                      <ParentReference
                        reference={parent.parentRef}
                        namespace={namespace}
                      />
                    </h3>
                    <p className={styles.muted}>{parent.controllerName}</p>
                    <Conditions
                      conditions={parent.conditions}
                      generation={resource.metadata.generation}
                    />
                  </div>
                ))}
              </div>
            </Section>
            {(resource.spec.rules ?? []).map((rule, index) => (
              <Section
                key={index}
                title={t('sections.rule', { number: index + 1 })}
              >
                <div className={styles.stack}>
                  <h3 className={styles.sectionTitle}>
                    {t('sections.matches')}
                  </h3>
                  <div className={styles.tableScroll}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>{t('fields.method')}</th>
                          <th>{t('fields.path')}</th>
                          <th>{t('fields.headers')}</th>
                          <th>{t('fields.queryParams')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(rule.matches?.length ? rule.matches : [{}]).map(
                          (match, matchIndex) => (
                            <tr key={matchIndex}>
                              <td>{match.method ?? '*'}</td>
                              <td>
                                {match.path?.type ?? 'PathPrefix'}:{' '}
                                {match.path?.value ?? '/'}
                              </td>
                              <td>
                                {match.headers
                                  ?.map(
                                    ({ name, value, type }) =>
                                      `${name}: ${value} (${type ?? 'Exact'})`
                                  )
                                  .join(', ') || '—'}
                              </td>
                              <td>
                                {match.queryParams
                                  ?.map(
                                    ({ name, value, type }) =>
                                      `${name}=${value} (${type ?? 'Exact'})`
                                  )
                                  .join(', ') || '—'}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                  {rule.filters?.length ? (
                    <>
                      <h3 className={styles.sectionTitle}>
                        {t('sections.filters')}
                      </h3>
                      <pre className={styles.code}>
                        {JSON.stringify(rule.filters, null, 2)}
                      </pre>
                    </>
                  ) : null}
                </div>
              </Section>
            ))}
          </>
        )}
      </div>
    </ResourceOverview>
  )
}

export default function ResourceDetail({ type }: { type: ResourceType }) {
  const { t } = useTranslation()
  const { namespace, name = '' } = useParams<{
    namespace: string
    name: string
  }>()
  const navigate = useNavigate()
  const definition = resources[type]
  const query = useResource<GatewayResource>(definition.reference, name, {
    namespace,
  })
  return (
    <ResourceDetailShell
      resource={definition.reference}
      resourceLabel={t(definition.singular)}
      name={name}
      namespace={namespace}
      data={query.data}
      isLoading={query.isLoading}
      error={query.error}
      onRefresh={query.refetch}
      showDelete
      showClone
      onDeleted={() => void navigate(resolveResourcePath(definition.reference))}
      tabs={[
        {
          value: 'overview',
          label: t('sections.overview'),
          content: ({ resource, refreshKey }) => (
            <Overview key={refreshKey} type={type} resource={resource} />
          ),
        },
        {
          value: 'related',
          label: t('sections.related'),
          content: ({ resource, refreshKey }) => (
            <Relations key={refreshKey} resource={resource} />
          ),
        },
        {
          value: 'yaml',
          label: t('sections.yaml'),
          content: ({ resource, refreshKey }) => (
            <ResourceYaml
              key={refreshKey}
              value={resource}
              onSave={async (content) => {
                await updateResource(definition.reference, name, content, {
                  namespace,
                })
                await query.refetch()
              }}
              fillHeight
            />
          ),
        },
        {
          value: 'events',
          label: t('sections.events'),
          content: ({ refreshKey }) => (
            <ResourceEvents
              key={refreshKey}
              resource={definition.reference}
              name={name}
              namespace={namespace}
            />
          ),
        },
        {
          value: 'history',
          label: t('sections.history'),
          content: ({ refreshKey }) => (
            <History
              key={refreshKey}
              type={type}
              name={name}
              namespace={namespace}
            />
          ),
        },
      ]}
    />
  )
}
