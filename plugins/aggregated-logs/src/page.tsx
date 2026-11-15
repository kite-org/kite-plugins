import { useState } from 'react'
import {
  useCluster,
  useNamespace,
  usePageTitle,
} from '@kite-dev/plugin-sdk/hooks'
import { Button } from '@kite-dev/plugin-sdk/ui'
import { IconPlus } from '@tabler/icons-react'

import { useTranslation } from './i18n'
import styles from './logs.module.css'
import type { Target } from './model'
import { ResourcePicker } from './resource-picker'
import { Workspace } from './workspace'

function PageContent() {
  const { t } = useTranslation()
  const { namespace } = useNamespace()
  const [targets, setTargets] = useState<Target[]>([])
  const [picking, setPicking] = useState(false)
  return (
    <>
      <Workspace
        targets={targets}
        onRemove={(id) =>
          setTargets((current) => current.filter((target) => target.id !== id))
        }
        onAdd={() => setPicking(true)}
        actions={
          <Button variant="outline" size="sm" onClick={() => setPicking(true)}>
            <IconPlus size={16} />
            {t('selectResources')}
          </Button>
        }
      />
      <ResourcePicker
        open={picking}
        onOpenChange={setPicking}
        namespace={namespace}
        selected={targets}
        onChange={setTargets}
      />
    </>
  )
}

export default function LogsPage() {
  const { t } = useTranslation()
  const { currentCluster } = useCluster()
  usePageTitle(t('title'))
  return (
    <section className={styles.page} aria-label={t('title')}>
      {currentCluster ? (
        <PageContent key={currentCluster} />
      ) : (
        <p>{t('selectCluster')}</p>
      )}
    </section>
  )
}
