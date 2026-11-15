import { useCallback, useMemo, useState } from 'react'
import {
  Button,
  LogViewerPanel,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kite-dev/plugin-sdk/ui'
import { IconChevronDown, IconRefresh } from '@tabler/icons-react'

import { useTranslation } from './i18n'
import styles from './logs.module.css'
import {
  MAX_STREAMS,
  podSources,
  sourceColor,
  type Pod,
  type Source,
  type SourceStatus,
  type TimeRange,
} from './model'
import { SourceStream } from './source-stream'
import { useLogBuffer } from './use-log-buffer'

interface Preferences {
  container: string
  selection: Record<string, boolean>
  disabledPods: Record<string, boolean>
}

export function AggregatedLogViewer({ pods }: { pods: Pod[] }) {
  const [range, setRange] = useState<TimeRange>('300')
  const [reload, setReload] = useState(0)
  const [preferences, setPreferences] = useState<Preferences>({
    container: '_default',
    selection: {},
    disabledPods: {},
  })
  return (
    <LogSession
      key={`${range}/${reload}`}
      pods={pods}
      range={range}
      onRange={setRange}
      onReload={() => setReload((value) => value + 1)}
      preferences={preferences}
      onPreferences={(update) =>
        setPreferences((current) => ({ ...current, ...update }))
      }
    />
  )
}

function LogSession({
  pods,
  range,
  onRange,
  onReload,
  preferences,
  onPreferences,
}: {
  pods: Pod[]
  range: TimeRange
  onRange: (range: TimeRange) => void
  onReload: () => void
  preferences: Preferences
  onPreferences: (update: Partial<Preferences>) => void
}) {
  const { t } = useTranslation()
  const { container, selection, disabledPods } = preferences
  const [statuses, setStatuses] = useState<Record<string, SourceStatus>>({})
  const buffer = useLogBuffer()
  const sources = useMemo(() => pods.flatMap(podSources), [pods])
  const isSelected = useCallback(
    (source: Source) =>
      !disabledPods[source.id.split('/')[0]] &&
      (selection[source.id] ??
        (container === '_default'
          ? source.isDefault
          : container === '_all'
            ? source.kind === 'regular'
            : source.container === container)),
    [disabledPods, selection, container]
  )
  const selected = sources.filter(isSelected)
  const readable = selected.filter((source) =>
    range === 'previous'
      ? source.restartCount > 0 && source.kind !== 'ephemeral'
      : source.readable
  )
  const active = readable.slice(0, MAX_STREAMS)
  const activeIds = new Set(active.map((source) => source.instance))
  const onStatus = useCallback((id: string, status: SourceStatus) => {
    setStatuses((current) =>
      current[id]?.state === status.state && current[id]?.error === status.error
        ? current
        : { ...current, [id]: status }
    )
  }, [])
  const entries = useMemo(
    () =>
      buffer.entries
        .filter((entry) => isSelected(entry.source))
        .sort((a, b) => a.time - b.time || a.id - b.id)
        .map((entry) => ({
          id: entry.id,
          timestamp: entry.timestamp,
          text: `\u001b[${sourceColor(entry.source)}m[${entry.source.namespace}/${entry.source.pod}/${entry.source.container}${entry.source.restartCount ? '#' + entry.source.restartCount : ''}]\u001b[0m ${entry.message}\u001b[0m`,
        })),
    [buffer.entries, isSelected]
  )
  const containerNames = [
    ...new Set(sources.map((source) => source.container)),
  ].sort()
  const selectedPodCount = pods.filter((pod) =>
    selected.some((source) => source.id.startsWith(`${pod.metadata.uid}/`))
  ).length
  const errorCount = active.filter(
    (source) => statuses[source.instance]?.state === 'error'
  ).length
  return (
    <div className={styles.viewer}>
      {active.map((source) => (
        <SourceStream
          key={source.instance}
          source={source}
          range={range}
          onLine={buffer.append}
          onStatus={onStatus}
        />
      ))}
      <LogViewerPanel
        entries={entries}
        defaultTheme="monokai"
        onClear={buffer.clear}
        downloadFilename="aggregated-logs.txt"
        status={
          <>
            <span>
              {pods.length === 0
                ? t('waitingForPods')
                : t('streamCount', { count: active.length })}{' '}
              ·
            </span>
            {readable.length > MAX_STREAMS && (
              <span
                title={t('streamLimit', {
                  count: readable.length,
                  max: MAX_STREAMS,
                })}
              >
                {t('limited')} ·
              </span>
            )}
            {errorCount > 0 && (
              <span className={styles.error}>
                {t('sourceErrors', { count: errorCount })} ·
              </span>
            )}
            {buffer.trimmed > 0 && (
              <span>{t('trimmed', { count: buffer.trimmed })} ·</span>
            )}
          </>
        }
        toolbar={
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" aria-label={t('sources')}>
                  Pods {selectedPodCount}/{pods.length}
                  <IconChevronDown size={14} />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className={styles.sourcePopover}>
                <div className={styles.sourceHeading}>
                  <strong>{t('sources')}</strong>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t('reload')}
                    title={t('reload')}
                    onClick={onReload}
                  >
                    <IconRefresh size={16} />
                  </Button>
                </div>
                {pods.length === 0 && (
                  <p className={styles.muted}>{t('waitingForPods')}</p>
                )}
                {readable.length > MAX_STREAMS && (
                  <p className={styles.warning} role="status">
                    {t('streamLimit', {
                      count: readable.length,
                      max: MAX_STREAMS,
                    })}
                  </p>
                )}
                {pods.map((pod) => {
                  const containers = sources.filter((source) =>
                    source.id.startsWith(`${pod.metadata.uid}/`)
                  )
                  return (
                    <div className={styles.pod} key={pod.metadata.uid}>
                      <label className={styles.podName}>
                        <input
                          type="checkbox"
                          checked={containers.some(isSelected)}
                          onChange={(event) =>
                            onPreferences({
                              disabledPods: {
                                ...disabledPods,
                                [pod.metadata.uid!]: !event.target.checked,
                              },
                              selection: Object.fromEntries(
                                Object.entries(selection).filter(
                                  ([id]) =>
                                    !id.startsWith(`${pod.metadata.uid}/`)
                                )
                              ),
                            })
                          }
                        />
                        <span>
                          <strong>{pod.metadata.name}</strong>
                          <small>{pod.metadata.namespace}</small>
                        </span>
                      </label>
                      {containers.map((source) => {
                        const checked = isSelected(source)
                        const status = statuses[source.instance]
                        const unavailablePrevious =
                          range === 'previous' &&
                          (source.restartCount === 0 ||
                            source.kind === 'ephemeral')
                        const stateText = !checked
                          ? t('notSelected')
                          : unavailablePrevious
                            ? t('noPrevious')
                            : !source.readable && range !== 'previous'
                              ? (source.waitingReason ?? t('waiting'))
                              : !activeIds.has(source.instance)
                                ? t('limited')
                                : t(`states.${status?.state ?? 'connecting'}`)
                        return (
                          <div className={styles.container} key={source.id}>
                            <label className={styles.containerName}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) =>
                                  onPreferences({
                                    disabledPods: {
                                      ...disabledPods,
                                      [pod.metadata.uid!]: false,
                                    },
                                    selection: {
                                      ...selection,
                                      [source.id]: event.target.checked,
                                    },
                                  })
                                }
                              />
                              <span>{source.container}</span>
                              {source.kind !== 'regular' && (
                                <small>{source.kind}</small>
                              )}
                            </label>
                            <small className={styles.sourceStatus}>
                              {stateText}
                            </small>
                            {checked &&
                              activeIds.has(source.instance) &&
                              status?.error && (
                                <p role="alert" className={styles.error}>
                                  {status.error}
                                </p>
                              )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </PopoverContent>
            </Popover>
            <Select
              value={container}
              onValueChange={(value) =>
                onPreferences({ container: value, selection: {} })
              }
            >
              <SelectTrigger
                className={styles.containerSelect}
                aria-label={t('containers')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_default">
                  {t('defaultContainers')}
                </SelectItem>
                <SelectItem value="_all">{t('allContainers')}</SelectItem>
                {containerNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={range}
              onValueChange={(value) => onRange(value as TimeRange)}
            >
              <SelectTrigger
                className={styles.timeSelect}
                aria-label={t('timeRange')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  ['tail', '300', '900', '3600', 'live', 'previous'] as const
                ).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`ranges.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />
    </div>
  )
}
