import { useCluster, useNamespace } from '@kite-dev/plugin-sdk/hooks'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kite-dev/plugin-sdk/ui'

import { useTranslation } from '../i18n'
import styles from './home.module.css'

export default function HomePage() {
  const { currentCluster } = useCluster()
  const { namespace } = useNamespace()
  const { t } = useTranslation()

  return (
    <main className={styles.page}>
      <Card>
        <CardHeader>
          <CardTitle>{t('navigation.home')}</CardTitle>
          <CardDescription>{t('context.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className={styles.context}>
            <dt>{t('context.cluster')}</dt>
            <dd>{currentCluster ?? '—'}</dd>
            <dt>{t('context.namespace')}</dt>
            <dd>
              {namespace === '_all' ? t('context.allNamespaces') : namespace}
            </dd>
          </dl>
        </CardContent>
      </Card>
    </main>
  )
}
