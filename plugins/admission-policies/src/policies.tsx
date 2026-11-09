import { useMemo, useState } from 'react'
import {
  useResources,
  type KubernetesResource,
} from '@kite-dev/plugin-sdk/resources'
import { Badge, ResourceTable, type ColumnDef } from '@kite-dev/plugin-sdk/ui'
import { Link } from 'react-router-dom'

import { useTranslation } from './i18n'
import styles from './policies.module.css'

const group = 'admissionregistration.k8s.io'

const sources = [
  {
    resource: 'validatingwebhookconfigurations',
    kind: 'ValidatingWebhookConfiguration',
  },
  {
    resource: 'mutatingwebhookconfigurations',
    kind: 'MutatingWebhookConfiguration',
  },
  {
    resource: 'validatingadmissionpolicies',
    kind: 'ValidatingAdmissionPolicy',
  },
  {
    resource: 'validatingadmissionpolicybindings',
    kind: 'ValidatingAdmissionPolicyBinding',
  },
  { resource: 'mutatingadmissionpolicies', kind: 'MutatingAdmissionPolicy' },
  {
    resource: 'mutatingadmissionpolicybindings',
    kind: 'MutatingAdmissionPolicyBinding',
  },
] as const

type PolicyRow = KubernetesResource & { resource: string; kind: string }

function formatDate(value?: string, language?: string): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' })
}

export default function PoliciesPage() {
  const { t, language } = useTranslation()
  const [refreshInterval, setRefreshInterval] = useState(0)
  const options = { refreshInterval }
  const validatingWebhooks = useResources(
    { group, resource: sources[0].resource },
    options
  )
  const mutatingWebhooks = useResources(
    { group, resource: sources[1].resource },
    options
  )
  const validatingPolicies = useResources(
    { group, resource: sources[2].resource },
    options
  )
  const validatingBindings = useResources(
    { group, resource: sources[3].resource },
    options
  )
  const mutatingPolicies = useResources(
    { group, resource: sources[4].resource },
    options
  )
  const mutatingBindings = useResources(
    { group, resource: sources[5].resource },
    options
  )
  const queries = [
    validatingWebhooks,
    mutatingWebhooks,
    validatingPolicies,
    validatingBindings,
    mutatingPolicies,
    mutatingBindings,
  ]

  const rows = useMemo(() => {
    const data = [
      validatingWebhooks.data,
      mutatingWebhooks.data,
      validatingPolicies.data,
      validatingBindings.data,
      mutatingPolicies.data,
      mutatingBindings.data,
    ]
    return sources.flatMap((source, index) =>
      (data[index] ?? []).map((item) => ({
        ...item,
        resource: source.resource,
        kind: source.kind,
      }))
    )
  }, [
    validatingWebhooks.data,
    mutatingWebhooks.data,
    validatingPolicies.data,
    validatingBindings.data,
    mutatingPolicies.data,
    mutatingBindings.data,
  ])

  // Kinds the cluster does not serve, such as MutatingAdmissionPolicy while
  // its API is still beta, fail with "no matches for kind"; they are absent,
  // not broken.
  const failedKinds = sources
    .filter((_, index) => {
      const error = queries[index].error
      return error && !error.message.includes('no matches for kind')
    })
    .map((source) => source.kind)
  const error = failedKinds.length
    ? new Error(`${t('partialError')} ${failedKinds.join(', ')}`)
    : undefined

  const columns: ColumnDef<PolicyRow, unknown>[] = [
    {
      accessorKey: 'metadata.name',
      header: t('fields.name'),
      cell: ({ row }) => (
        <Link
          className={styles.link}
          to={`/${row.original.resource}/${encodeURIComponent(row.original.metadata.name)}`}
        >
          {row.original.metadata.name}
        </Link>
      ),
    },
    {
      accessorKey: 'kind',
      header: t('fields.kind'),
      enableColumnFilter: true,
      // Kinds prefix each other (ValidatingAdmissionPolicy/...Binding).
      filterFn: 'equalsString',
      cell: ({ getValue }) => (
        <Badge variant="outline">{String(getValue())}</Badge>
      ),
    },
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
    <ResourceTable
      id="policies"
      resourceName={t('title')}
      data={rows}
      columns={columns}
      isLoading={queries.some((query) => query.isLoading)}
      error={error}
      onRefresh={() => Promise.all(queries.map((query) => query.refetch()))}
      refreshInterval={refreshInterval}
      onRefreshIntervalChange={setRefreshInterval}
      searchQueryFilter={(row, value) =>
        [row.metadata.name, row.kind].some((candidate) =>
          candidate.toLowerCase().includes(value.toLowerCase())
        )
      }
      emptyState={<p className={styles.empty}>{t('empty')}</p>}
    />
  )
}
