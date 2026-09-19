import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useCluster,
  useNamespace,
  usePageTitle,
  useTheme,
} from '@kite-dev/plugin-sdk/hooks'
import {
  Button,
  Input,
  NamespaceSelector,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kite-dev/plugin-sdk/ui'
import {
  IconAlertCircle,
  IconFilter,
  IconLoader2,
  IconRefresh,
  IconSearch,
  IconTopologyStar,
} from '@tabler/icons-react'

import { useMapData } from './data'
import { ResourceGraph } from './graph'
import { useTranslation } from './i18n'
import { Inspector } from './inspector'
import { layoutMap, type Grouping } from './layout'
import styles from './map.module.css'
import { definitions, isIssue, type Category, type MapResource } from './model'

function MapContent({ namespace }: { namespace: string }) {
  const { t } = useTranslation()
  const { setNamespace } = useNamespace()
  const data = useMapData(namespace)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [grouping, setGrouping] = useState<Grouping>('namespace')
  const [issuesOnly, setIssuesOnly] = useState(false)
  const [selection, setSelection] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [canvasWidth, setCanvasWidth] = useState(1000)
  const workspaceRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setCanvasWidth(Math.round(entry.contentRect.width))
    )
    observer.observe(workspaceRef.current!)
    return () => observer.disconnect()
  }, [])
  const selected = data.resources.find((r) => r.id === selection)
  const filtered = useMemo(
    () =>
      data.resources.filter(
        (resource) =>
          (category === 'all' ||
            definitions[resource.type].category === category) &&
          (!issuesOnly || isIssue(resource)) &&
          (!query.trim() ||
            `${resource.name} ${resource.kind} ${resource.namespace ?? ''}`
              .toLowerCase()
              .includes(query.trim().toLowerCase()))
      ),
    [data.resources, category, issuesOnly, query]
  )
  const toggle = useCallback(
    (id: string, current: boolean) =>
      setExpanded((value) => ({ ...value, [id]: !current })),
    []
  )
  const [graph, setGraph] = useState<Awaited<ReturnType<typeof layoutMap>>>()
  useEffect(() => {
    let active = true
    void layoutMap(
      filtered,
      data.resources,
      data.relations,
      grouping,
      expanded,
      !!query.trim(),
      toggle,
      canvasWidth
    ).then((result) => {
      if (active) setGraph(result)
    })
    return () => {
      active = false
    }
  }, [
    filtered,
    data.resources,
    data.relations,
    grouping,
    expanded,
    query,
    toggle,
    canvasWidth,
  ])
  const onSelect = (resource: MapResource) => setSelection(resource.id)
  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <NamespaceSelector
            value={namespace}
            onChange={setNamespace}
            showAll
            triggerClassName={styles.namespaceSelect}
          />
          <Select
            value={category}
            onValueChange={(value) => setCategory(value as Category | 'all')}
          >
            <SelectTrigger
              className={styles.categorySelect}
              aria-label={t('filters.types')}
            >
              <IconFilter size={16} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                [
                  'all',
                  'workloads',
                  'network',
                  'storage',
                  'config',
                  'nodes',
                ] as const
              ).map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`categories.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className={styles.groupLabel}>{t('filters.groupBy')}</span>
          <div
            className={styles.segmented}
            role="group"
            aria-label={t('filters.groupBy')}
          >
            {(['namespace', 'node'] as const).map((value) => (
              <button
                key={value}
                aria-pressed={grouping === value}
                onClick={() => setGrouping(value)}
              >
                {t(`fields.${value}`)}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.searchFilters}>
          <div className={styles.search}>
            <IconSearch size={16} />
            <Input
              aria-label={t('filters.search')}
              placeholder={t('filters.search')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <label className={styles.issueToggle}>
            <input
              type="checkbox"
              checked={issuesOnly}
              onChange={(event) => setIssuesOnly(event.target.checked)}
            />
            <span className={styles.switch} aria-hidden="true" />
            {t('filters.issues')}
          </label>
          <Button
            variant="ghost"
            size="icon"
            disabled={data.isFetching}
            onClick={() => void data.refresh()}
            aria-label={t('actions.refresh')}
          >
            <IconRefresh
              size={17}
              className={data.isFetching ? styles.spin : undefined}
            />
          </Button>
        </div>
      </div>
      <div className={styles.overview} aria-label={t('summary.overview')}>
        <span className={styles.overviewTotal}>
          <strong>{data.resources.length}</strong> {t('summary.total')}
        </span>
        {(['workloads', 'network', 'config', 'storage', 'nodes'] as const).map(
          (value) => (
            <button
              key={value}
              aria-pressed={category === value}
              onClick={() => setCategory(category === value ? 'all' : value)}
            >
              {t(`categories.${value}`)}
              <strong>
                {
                  data.resources.filter(
                    (r) =>
                      definitions[r.type].category === value &&
                      (value !== 'workloads' ||
                        !['pods', 'replicasets'].includes(r.type))
                  ).length
                }
              </strong>
            </button>
          )
        )}
        <span className={styles.podCount}>
          Pod{' '}
          <strong>
            {
              data.resources.filter(
                (r) =>
                  r.type === 'pods' && r.status === 'running' && !isIssue(r)
              ).length
            }{' '}
            / {data.resources.filter((r) => r.type === 'pods').length}
          </strong>{' '}
          {t('status.running')}
        </span>
        <button
          className={styles.overviewIssues}
          data-has-issues={data.resources.some(isIssue)}
          aria-pressed={issuesOnly}
          onClick={() => setIssuesOnly(!issuesOnly)}
        >
          <IconAlertCircle size={14} />
          {t('issues', { count: data.resources.filter(isIssue).length })}
        </button>
      </div>
      {data.errors.length > 0 && (
        <div className={styles.queryErrors} role="alert">
          <IconAlertCircle size={17} />
          <div>
            <strong>{t('partialData')}</strong>
            <span>
              {data.errors
                .map(
                  ({ type }) =>
                    definitions[type as keyof typeof definitions].kind
                )
                .join(', ')}
            </span>
          </div>
        </div>
      )}
      <div ref={workspaceRef} className={styles.workspace}>
        <div className={styles.canvas} aria-label={t('title')}>
          {data.isLoading || !graph ? (
            <div className={styles.empty}>
              <IconLoader2 size={24} className={styles.spin} />
              <p>{t('loading')}</p>
            </div>
          ) : filtered.length ? (
            <ResourceGraph
              graph={graph}
              selectedId={selected?.id ?? null}
              onSelect={onSelect}
              onClear={() => setSelection(null)}
            />
          ) : (
            <div className={styles.empty}>
              <IconTopologyStar size={32} stroke={1.4} />
              <h2>
                {t(data.resources.length ? 'empty.filtered' : 'empty.title')}
              </h2>
              <p>
                {t(data.resources.length ? 'empty.hint' : 'empty.description')}
              </p>
              {data.resources.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery('')
                    setCategory('all')
                    setIssuesOnly(false)
                  }}
                >
                  {t('actions.reset')}
                </Button>
              )}
            </div>
          )}
        </div>
        {selected && (
          <Inspector
            resource={selected}
            resources={data.resources}
            relations={data.relations}
            onSelect={onSelect}
            onClose={() => setSelection(null)}
          />
        )}
      </div>
      <footer className={styles.footer}>
        <span>
          {t('showing', {
            visible: filtered.length,
            total: data.resources.length,
          })}
          <span className={styles.footerDot}>·</span>
          {t('issues', { count: filtered.filter(isIssue).length })}
          {graph && graph.foldedCount > 0 && (
            <span> · {t('summary.folded', { count: graph.foldedCount })}</span>
          )}
        </span>
        <span className={styles.footerLegend}>
          <span>
            <i />
            {t('legend.owner')}
          </span>
          <span>
            <i className={styles.dashed} />
            {t('legend.reference')}
          </span>
          <span>{t('legend.select')}</span>
        </span>
        <span>
          <i
            className={data.errors.length ? styles.warningDot : styles.liveDot}
          />
          {t(data.isFetching ? 'updating' : 'refreshHint')}
        </span>
      </footer>
    </>
  )
}

export default function ResourceMap() {
  const { t } = useTranslation()
  const { currentCluster } = useCluster()
  const { namespace } = useNamespace()
  usePageTitle(t('title'))
  const { actualTheme } = useTheme()
  return (
    <div
      className={styles.page}
      data-theme={actualTheme}
      style={{ colorScheme: actualTheme }}
    >
      <header className={styles.heading}>
        <div className={styles.titleIcon}>
          <IconTopologyStar size={22} stroke={1.7} />
        </div>
        <div>
          <h1>{t('title')}</h1>
          <p>{t('description')}</p>
        </div>
      </header>
      {currentCluster ? (
        <MapContent
          key={`${currentCluster}:${namespace}`}
          namespace={namespace}
        />
      ) : (
        <div className={styles.empty}>
          <IconTopologyStar size={32} />
          <h2>{t('empty.cluster')}</h2>
        </div>
      )}
    </div>
  )
}
