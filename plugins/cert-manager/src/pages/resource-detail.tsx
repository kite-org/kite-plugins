import { useParams, usePluginNavigate } from '@kite-dev/plugin-sdk/navigation'
import { updateResource, useResource } from '@kite-dev/plugin-sdk/resources'
import {
  ResourceDetailShell,
  ResourceEvents,
  ResourceOverview,
} from '@kite-dev/plugin-sdk/ui'

import {
  ConditionBadge,
  Conditions,
  Fields,
  formatDate,
  IssuerLink,
  SecretLink,
  StatusBadge,
} from '../components/common'
import { Relations } from '../components/relations'
import { useTranslation, type TranslationKey } from '../i18n'
import type {
  Certificate,
  CertificateRequest,
  CertManagerResource,
  Challenge,
  Issuer,
  Order,
  ResourceType,
  Solver,
} from '../resources'
import { issuerType, resources } from '../resources'
import styles from './page.module.css'

function CertificateFields({ resource }: { resource: Certificate }) {
  const { t, language } = useTranslation()
  const { spec, status, metadata } = resource
  const yesNo = (value?: boolean) =>
    value === undefined ? '—' : t(value ? 'common.yes' : 'common.no')
  const subjectLabels: Record<string, TranslationKey | undefined> = {
    organizations: 'fields.organizations',
    countries: 'fields.countries',
    organizationalUnits: 'fields.organizationalUnits',
    localities: 'fields.localities',
    provinces: 'fields.provinces',
    streetAddresses: 'fields.streetAddresses',
    postalCodes: 'fields.postalCodes',
    serialNumber: 'fields.serialNumber',
  }

  return (
    <>
      <Fields
        title={t('sections.validity')}
        fields={[
          {
            label: t('fields.validFrom'),
            value: formatDate(status?.notBefore, language),
          },
          {
            label: t('fields.expires'),
            value: formatDate(status?.notAfter, language),
          },
          {
            label: t('fields.scheduledRenewal'),
            value: formatDate(status?.renewalTime, language),
          },
          { label: t('fields.requestedDuration'), value: spec.duration },
          { label: t('fields.renewBeforeExpiry'), value: spec.renewBefore },
          {
            label: t('fields.renewBeforeExpiryPercentage'),
            value: spec.renewBeforePercentage,
          },
          { label: t('fields.revision'), value: status?.revision },
          {
            label: t('fields.revisionHistoryLimit'),
            value: spec.revisionHistoryLimit,
          },
          {
            label: t('fields.lastIssuanceFailure'),
            value: formatDate(status?.lastFailureTime, language),
          },
          {
            label: t('fields.failedIssuanceAttempts'),
            value: status?.failedIssuanceAttempts,
          },
        ]}
      />
      <Fields
        title={t('sections.identity')}
        fields={[
          { label: t('fields.commonName'), value: spec.commonName },
          { label: t('fields.dnsNames'), value: spec.dnsNames?.join(', ') },
          {
            label: t('fields.ipAddresses'),
            value: spec.ipAddresses?.join(', '),
          },
          { label: t('fields.uris'), value: spec.uris?.join(', ') },
          {
            label: t('fields.emailAddresses'),
            value: spec.emailAddresses?.join(', '),
          },
          { label: t('fields.literalSubject'), value: spec.literalSubject },
          { label: t('fields.certificateAuthority'), value: yesNo(spec.isCA) },
          { label: t('fields.usages'), value: spec.usages?.join(', ') },
        ]}
      />
      {spec.subject && (
        <Fields
          title={t('sections.subject')}
          fields={Object.entries(spec.subject).map(([key, value]) => ({
            label: subjectLabels[key] ? t(subjectLabels[key]) : key,
            value: Array.isArray(value) ? value.join(', ') : value,
          }))}
        />
      )}
      <Fields
        title={t('sections.privateKey')}
        fields={[
          { label: t('fields.algorithm'), value: spec.privateKey?.algorithm },
          { label: t('fields.size'), value: spec.privateKey?.size },
          { label: t('fields.encoding'), value: spec.privateKey?.encoding },
          {
            label: t('fields.rotationPolicy'),
            value: spec.privateKey?.rotationPolicy,
          },
          {
            label: t('fields.nextPrivateKeySecret'),
            value: status?.nextPrivateKeySecretName && (
              <SecretLink
                name={status.nextPrivateKeySecretName}
                namespace={metadata.namespace}
              />
            ),
          },
        ]}
      />
      {Object.entries(spec.keystores ?? {}).map(([type, store]) => (
        <Fields
          key={type}
          title={type.toUpperCase()}
          fields={[
            { label: t('fields.createKeystore'), value: yesNo(store.create) },
            { label: t('fields.profile'), value: store.profile },
            {
              label: t('fields.passwordSecret'),
              value: store.passwordSecretRef && (
                <SecretLink
                  name={store.passwordSecretRef.name}
                  namespace={metadata.namespace}
                />
              ),
            },
            {
              label: t('fields.passwordKey'),
              value: store.passwordSecretRef?.key,
            },
          ]}
        />
      ))}
    </>
  )
}

function RequestFields({ resource }: { resource: CertificateRequest }) {
  const { t, language } = useTranslation()
  return (
    <Fields
      title={t('resources.certificateRequest')}
      fields={[
        {
          label: t('status.approved'),
          value: <ConditionBadge resource={resource} type="Approved" />,
        },
        {
          label: t('status.denied'),
          value: <ConditionBadge resource={resource} type="Denied" />,
        },
        { label: t('fields.requester'), value: resource.spec.username },
        { label: t('fields.requesterUid'), value: resource.spec.uid },
        { label: t('fields.groups'), value: resource.spec.groups?.join(', ') },
        { label: t('fields.requestedDuration'), value: resource.spec.duration },
        {
          label: t('fields.certificateAuthority'),
          value: t(resource.spec.isCA ? 'common.yes' : 'common.no'),
        },
        { label: t('fields.usages'), value: resource.spec.usages?.join(', ') },
        {
          label: t('fields.revision'),
          value:
            resource.metadata.annotations?.[
              'cert-manager.io/certificate-revision'
            ],
        },
        {
          label: t('fields.failureTime'),
          value: formatDate(resource.status?.failureTime, language),
        },
      ]}
    />
  )
}

function SolverFields({ solver, title }: { solver: Solver; title: string }) {
  const { t } = useTranslation()
  return (
    <Fields
      title={title}
      fields={[
        {
          label: t('fields.challengeType'),
          value: solver.http01 ? 'HTTP-01' : solver.dns01 ? 'DNS-01' : '—',
        },
        {
          label: t('fields.dnsProvider'),
          value:
            solver.dns01 &&
            Object.keys(solver.dns01)
              .filter((key) => !['cnameStrategy'].includes(key))
              .join(', '),
        },
        {
          label: t('fields.ingressClass'),
          value:
            solver.http01?.ingress?.ingressClassName ??
            solver.http01?.ingress?.class,
        },
        { label: t('fields.ingress'), value: solver.http01?.ingress?.name },
        {
          label: t('fields.gateway'),
          value: solver.http01?.gatewayHTTPRoute?.parentRefs
            ?.map((reference) =>
              [reference.namespace, reference.name].filter(Boolean).join('/')
            )
            .join(', '),
        },
        {
          label: t('fields.selectedDnsNames'),
          value: solver.selector?.dnsNames?.join(', '),
        },
        {
          label: t('fields.selectedDnsZones'),
          value: solver.selector?.dnsZones?.join(', '),
        },
        {
          label: t('fields.labelSelector'),
          value:
            solver.selector?.matchLabels &&
            Object.entries(solver.selector.matchLabels)
              .map(([key, value]) => `${key}=${value}`)
              .join(', '),
        },
      ]}
    />
  )
}

function IssuerFields({ resource }: { resource: Issuer }) {
  const { t } = useTranslation()
  const { spec, status } = resource
  const namespace =
    resource.kind === 'Issuer' ? resource.metadata.namespace : undefined
  return (
    <>
      <Fields
        title={t('sections.issuer')}
        fields={[{ label: t('fields.type'), value: issuerType(resource) }]}
      />
      {spec.acme && (
        <>
          <Fields
            title="ACME"
            fields={[
              { label: t('fields.server'), value: spec.acme.server },
              { label: t('fields.email'), value: spec.acme.email },
              {
                label: t('fields.accountKeySecret'),
                value: (
                  <SecretLink
                    name={spec.acme.privateKeySecretRef.name}
                    namespace={namespace}
                  />
                ),
              },
              {
                label: t('fields.preferredChain'),
                value: spec.acme.preferredChain,
              },
              {
                label: t('fields.accountKeyGenerationDisabled'),
                value: t(
                  spec.acme.disableAccountKeyGeneration
                    ? 'common.yes'
                    : 'common.no'
                ),
              },
              { label: t('fields.accountUri'), value: status?.acme?.uri },
              {
                label: t('fields.registeredEmail'),
                value: status?.acme?.lastRegisteredEmail,
              },
              {
                label: t('fields.externalAccountKeyId'),
                value: spec.acme.externalAccountBinding?.keyID,
              },
              {
                label: t('fields.externalAccountKeySecret'),
                value: spec.acme.externalAccountBinding && (
                  <SecretLink
                    name={spec.acme.externalAccountBinding.keySecretRef.name}
                    namespace={namespace}
                  />
                ),
              },
            ]}
          />
          {spec.acme.solvers?.map((solver, index) => (
            <SolverFields
              key={index}
              solver={solver}
              title={t('sections.solverNumber', { number: index + 1 })}
            />
          ))}
        </>
      )}
      {spec.ca && (
        <Fields
          title="CA"
          fields={[
            {
              label: t('fields.secret'),
              value: (
                <SecretLink name={spec.ca.secretName} namespace={namespace} />
              ),
            },
            {
              label: t('fields.crlDistributionPoints'),
              value: spec.ca.crlDistributionPoints?.join(', '),
            },
            {
              label: t('fields.ocspServers'),
              value: spec.ca.ocspServers?.join(', '),
            },
          ]}
        />
      )}
      {spec.selfSigned && (
        <Fields
          title={t('issuer.selfSigned')}
          fields={[
            {
              label: t('fields.crlDistributionPoints'),
              value: spec.selfSigned.crlDistributionPoints?.join(', '),
            },
          ]}
        />
      )}
      {spec.vault && (
        <Fields
          title="Vault"
          fields={[
            { label: t('fields.server'), value: spec.vault.server },
            { label: t('fields.path'), value: spec.vault.path },
            { label: t('fields.vaultNamespace'), value: spec.vault.namespace },
            {
              label: t('fields.authentication'),
              value: spec.vault.auth && Object.keys(spec.vault.auth).join(', '),
            },
          ]}
        />
      )}
      {spec.venafi && (
        <Fields
          title="Venafi"
          fields={[
            { label: t('fields.zone'), value: spec.venafi.zone },
            { label: t('fields.tppUrl'), value: spec.venafi.tpp?.url },
            {
              label: t('fields.tppCredentialsSecret'),
              value: spec.venafi.tpp && (
                <SecretLink
                  name={spec.venafi.tpp.credentialsRef.name}
                  namespace={namespace}
                />
              ),
            },
            { label: t('fields.cloudUrl'), value: spec.venafi.cloud?.url },
            {
              label: t('fields.apiTokenSecret'),
              value: spec.venafi.cloud && (
                <SecretLink
                  name={spec.venafi.cloud.apiTokenSecretRef.name}
                  namespace={namespace}
                />
              ),
            },
          ]}
        />
      )}
      {resource.kind === 'ClusterIssuer' && (
        <p className={styles.muted}>{t('issuer.clusterSecretHint')}</p>
      )}
    </>
  )
}

function OrderFields({ resource }: { resource: Order }) {
  const { t, language } = useTranslation()
  return (
    <>
      <Fields
        title={t('sections.order')}
        fields={[
          { label: t('fields.commonName'), value: resource.spec.commonName },
          {
            label: t('fields.dnsNames'),
            value: resource.spec.dnsNames?.join(', '),
          },
          {
            label: t('fields.requestedDuration'),
            value: resource.spec.duration,
          },
          { label: t('fields.orderUrl'), value: resource.status?.url },
          {
            label: t('fields.finalizeUrl'),
            value: resource.status?.finalizeURL,
          },
          {
            label: t('fields.failureTime'),
            value: formatDate(resource.status?.failureTime, language),
          },
          { label: t('fields.reason'), value: resource.status?.reason },
        ]}
      />
      {resource.status?.authorizations?.map((authorization, index) => (
        <Fields
          key={authorization.url}
          title={t('sections.authorizationNumber', { number: index + 1 })}
          fields={[
            { label: t('fields.identifier'), value: authorization.identifier },
            {
              label: t('fields.initialState'),
              value: authorization.initialState,
            },
            {
              label: t('fields.wildcard'),
              value: t(authorization.wildcard ? 'common.yes' : 'common.no'),
            },
            { label: t('fields.url'), value: authorization.url },
          ]}
        />
      ))}
    </>
  )
}

function ChallengeFields({ resource }: { resource: Challenge }) {
  const { t } = useTranslation()
  const yesNo = (value?: boolean) =>
    value === undefined ? '—' : t(value ? 'common.yes' : 'common.no')
  return (
    <>
      <Fields
        title={t('sections.challenge')}
        fields={[
          { label: t('fields.dnsName'), value: resource.spec.dnsName },
          { label: t('fields.type'), value: resource.spec.type },
          { label: t('fields.wildcard'), value: yesNo(resource.spec.wildcard) },
          {
            label: t('status.processing'),
            value: yesNo(resource.status?.processing),
          },
          {
            label: t('fields.presented'),
            value: yesNo(resource.status?.presented),
          },
          { label: t('fields.reason'), value: resource.status?.reason },
          { label: t('fields.challengeUrl'), value: resource.spec.url },
          {
            label: t('fields.authorizationUrl'),
            value: resource.spec.authorizationURL,
          },
        ]}
      />
      <SolverFields
        solver={resource.spec.solver}
        title={t('sections.solver')}
      />
    </>
  )
}

function DetailOverview({
  type,
  resource,
}: {
  type: ResourceType
  resource: CertManagerResource
}) {
  const { t } = useTranslation()
  return (
    <ResourceOverview
      resource={resources[type].reference}
      name={resource.metadata.name}
      namespace={resource.metadata.namespace}
      metadata={resource.metadata}
      relatedResources={null}
      fields={[
        {
          label: t('fields.status'),
          value: <StatusBadge resource={resource} />,
        },
        ...('issuerRef' in resource.spec
          ? [
              {
                label: t('resources.issuer'),
                value: (
                  <IssuerLink
                    reference={resource.spec.issuerRef}
                    namespace={resource.metadata.namespace}
                  />
                ),
              },
            ]
          : []),
        ...(resource.kind === 'Certificate'
          ? [
              {
                label: t('fields.secret'),
                value: (
                  <SecretLink
                    name={resource.spec.secretName}
                    namespace={resource.metadata.namespace}
                  />
                ),
              },
              {
                label: t('status.issuing'),
                value: <ConditionBadge resource={resource} type="Issuing" />,
              },
            ]
          : []),
      ]}
    >
      <div className={styles.stack}>
        {resource.kind !== 'Order' && resource.kind !== 'Challenge' && (
          <Conditions resource={resource} />
        )}
        {resource.kind === 'Certificate' && (
          <CertificateFields resource={resource} />
        )}
        {resource.kind === 'CertificateRequest' && (
          <RequestFields resource={resource} />
        )}
        {(resource.kind === 'Issuer' || resource.kind === 'ClusterIssuer') && (
          <IssuerFields resource={resource} />
        )}
        {resource.kind === 'Order' && <OrderFields resource={resource} />}
        {resource.kind === 'Challenge' && (
          <ChallengeFields resource={resource} />
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
  const navigate = usePluginNavigate()
  const definition = resources[type]
  const query = useResource<CertManagerResource>(definition.reference, name, {
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
      onSaveYaml={
        definition.editable
          ? async (content) => {
              await updateResource(definition.reference, name, content, {
                namespace,
              })
              await query.refetch()
            }
          : undefined
      }
      showDelete
      showClone={false}
      onDeleted={() => {
        void navigate(type)
      }}
      overview={({ resource }) => (
        <DetailOverview type={type} resource={resource} />
      )}
      preYamlTabs={[
        {
          value: 'related',
          label: t('sections.relatedResources'),
          content: ({ resource, refreshKey }) => (
            <Relations key={refreshKey} resource={resource} />
          ),
        },
      ]}
      extraTabs={[
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
      ]}
    />
  )
}
