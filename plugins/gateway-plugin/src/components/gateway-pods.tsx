import type { CoreV1 } from '@kite-dev/plugin-sdk/k8s'
import { useResources } from '@kite-dev/plugin-sdk/resources'
import { WorkloadPodsCard } from '@kite-dev/plugin-sdk/ui'

import { useTranslation } from '../i18n'
import type { Gateway } from '../resources'
import styles from '../style.module.css'

export function GatewayPods({ gateway }: { gateway: Gateway }) {
  const { t } = useTranslation()
  const { name, namespace } = gateway.metadata
  const standard = useResources<CoreV1.Pod>(
    { group: '', resource: 'pods' },
    {
      namespace,
      labelSelector: `gateway.networking.k8s.io/gateway-name=${name},!gateway.envoyproxy.io/owning-gateway-namespace`,
    }
  )
  const envoy = useResources<CoreV1.Pod>(
    { group: '', resource: 'pods' },
    {
      namespace: '_all',
      labelSelector: `gateway.envoyproxy.io/owning-gateway-name=${name},gateway.envoyproxy.io/owning-gateway-namespace=${namespace}`,
    }
  )
  const pods = [...(standard.data ?? []), ...(envoy.data ?? [])]
  const error = standard.error ?? envoy.error
  return (
    <div className={styles.stack}>
      {error && (
        <p role="alert" className={styles.error}>
          {error.message}
        </p>
      )}
      <WorkloadPodsCard
        title={t('resources.pods')}
        pods={pods}
        isLoading={standard.isLoading || envoy.isLoading}
        loadingText={t('common.loading')}
        emptyText={t('common.noPods')}
        ageLabel={t('fields.age')}
      />
    </div>
  )
}
