import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useResource, useResources } from '@kite-dev/plugin-sdk/resources'
import { Button } from '@kite-dev/plugin-sdk/ui'
import { IconX } from '@tabler/icons-react'

import { useTranslation } from './i18n'
import styles from './logs.module.css'
import { targetSelector, type Pod, type Target } from './model'
import { AggregatedLogViewer } from './viewer'

function TargetPods({
  target,
  onPods,
  onRemove,
}: {
  target: Target
  onPods: (id: string, pods: Pod[]) => void
  onRemove?: (id: string) => void
}) {
  const { t } = useTranslation()
  const selector = targetSelector(target)
  const isPod = target.reference.resource === 'pods'
  const query = useResources<Pod>(
    { group: '', resource: 'pods' },
    {
      namespace: target.resource.metadata.namespace,
      labelSelector: selector,
      enabled: !isPod && !!selector,
      refreshInterval: 5000,
    }
  )
  const podQuery = useResource<Pod>(
    { group: '', resource: 'pods' },
    target.resource.metadata.name,
    {
      namespace: target.resource.metadata.namespace,
      enabled: isPod,
      refreshInterval: 5000,
    }
  )
  const error = isPod ? podQuery.error : query.error
  const pods = useMemo(
    () =>
      error
        ? []
        : isPod
          ? podQuery.data
            ? [podQuery.data]
            : []
          : (query.data ?? []),
    [error, isPod, podQuery.data, query.data]
  )
  useEffect(() => {
    onPods(target.id, pods)
  }, [target.id, pods, onPods])
  const message =
    error?.message ?? (!isPod && !selector ? t('noSelector') : undefined)
  return (
    <div className={styles.target}>
      <div
        className={styles.targetName}
        title={`${target.resource.metadata.namespace}/${target.resource.metadata.name}`}
      >
        <span className={styles.muted}>
          {target.resource.kind ?? target.reference.resource} /
        </span>
        <strong>{target.resource.metadata.name}</strong>
        {onRemove && (
          <Button
            size="icon"
            variant="ghost"
            className={styles.removeTarget}
            aria-label={t('removeSource', {
              name: target.resource.metadata.name,
            })}
            onClick={() => onRemove(target.id)}
          >
            <IconX size={14} />
          </Button>
        )}
      </div>
      {message && (
        <p role="alert" className={styles.error}>
          {message}
        </p>
      )}
    </div>
  )
}

export function Workspace({
  targets,
  actions,
  onRemove,
  onAdd,
}: {
  targets: Target[]
  actions?: ReactNode
  onRemove?: (id: string) => void
  onAdd?: () => void
}) {
  const { t } = useTranslation()
  const [podLists, setPodLists] = useState<Record<string, Pod[]>>({})
  const onPods = useCallback((id: string, pods: Pod[]) => {
    setPodLists((current) =>
      current[id] === pods ? current : { ...current, [id]: pods }
    )
  }, [])
  const pods = useMemo(() => {
    const byUID = new Map<string, Pod>()
    for (const target of targets) {
      for (const pod of podLists[target.id] ?? [])
        byUID.set(pod.metadata.uid!, pod)
    }
    return [...byUID.values()].sort((a, b) =>
      `${a.metadata.namespace}/${a.metadata.name}`.localeCompare(
        `${b.metadata.namespace}/${b.metadata.name}`
      )
    )
  }, [targets, podLists])
  return (
    <div className={styles.workspace}>
      <div className={styles.scopeBar}>
        {actions}
        <div className={styles.targets}>
          {targets.map((target) => (
            <TargetPods
              key={target.id}
              target={target}
              onPods={onPods}
              onRemove={onRemove}
            />
          ))}
        </div>
      </div>
      {targets.length === 0 ? (
        <div className={styles.empty}>
          <strong>{t('emptyTitle')}</strong>
          <Button onClick={onAdd}>{t('selectResources')}</Button>
        </div>
      ) : (
        <AggregatedLogViewer pods={pods} />
      )}
    </div>
  )
}
