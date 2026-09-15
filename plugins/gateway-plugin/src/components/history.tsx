import { useState } from 'react'
import {
  useResourceHistory,
  type ResourceHistory,
} from '@kite-dev/plugin-sdk/resources'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  YamlEditor,
} from '@kite-dev/plugin-sdk/ui'

import { useTranslation } from '../i18n'
import { resources, type ResourceType } from '../resources'
import styles from '../style.module.css'
import { formatDate } from './common'

export function History({
  type,
  name,
  namespace,
}: {
  type: ResourceType
  name: string
  namespace?: string
}) {
  const { t, language } = useTranslation()
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<ResourceHistory>()
  const [snapshot, setSnapshot] = useState('')
  const query = useResourceHistory(resources[type].reference, name, {
    namespace,
    page,
    pageSize: 10,
  })
  return (
    <div className={styles.stack}>
      {query.error && (
        <p role="alert" className={styles.error}>
          {query.error.message}
        </p>
      )}
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('fields.operation')}</th>
              <th>{t('fields.operator')}</th>
              <th>{t('fields.created')}</th>
              <th>{t('fields.status')}</th>
              <th>{t('fields.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {query.data?.data.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.operationType}</td>
                <td>{entry.operator?.username ?? '—'}</td>
                <td>{formatDate(entry.createdAt, language)}</td>
                <td>
                  {entry.success
                    ? t('history.success')
                    : entry.errorMessage || t('history.failed')}
                </td>
                <td>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelected(entry)
                      setSnapshot(entry.resourceYaml || entry.previousYaml)
                    }}
                  >
                    {t('actions.viewYaml')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {query.isLoading && (
        <p role="status" className={styles.muted}>
          {t('common.loading')}
        </p>
      )}
      {query.data?.data.length === 0 && (
        <p className={styles.muted}>{t('history.empty')}</p>
      )}
      <div className={styles.actions}>
        <Button
          size="sm"
          variant="outline"
          disabled={query.isFetching || !query.data?.pagination.hasPrevPage}
          onClick={() => setPage(page - 1)}
        >
          {t('actions.previous')}
        </Button>
        <span className={styles.date}>
          {page} / {Math.max(1, query.data?.pagination.totalPages ?? 1)}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={query.isFetching || !query.data?.pagination.hasNextPage}
          onClick={() => setPage(page + 1)}
        >
          {t('actions.next')}
        </Button>
      </div>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(undefined)
        }}
      >
        <DialogContent className={styles.dialog}>
          <DialogHeader>
            <DialogTitle>{t('actions.viewYaml')}</DialogTitle>
            <DialogDescription>{name}</DialogDescription>
          </DialogHeader>
          <div className={styles.actions}>
            <Button
              size="sm"
              variant="outline"
              disabled={!selected?.previousYaml}
              onClick={() => setSnapshot(selected!.previousYaml)}
            >
              {t('history.previous')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!selected?.resourceYaml}
              onClick={() => setSnapshot(selected!.resourceYaml)}
            >
              {t('history.current')}
            </Button>
          </div>
          <YamlEditor
            value={snapshot}
            onChange={(value) => setSnapshot(value ?? '')}
            disabled
            height="55vh"
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
