import { memo, useEffect, useMemo } from 'react'
import { useIsMobile, useTheme } from '@kite-dev/plugin-sdk/hooks'
import { Button } from '@kite-dev/plugin-sdk/ui'
import {
  IconAlertCircle,
  IconChevronDown,
  IconChevronRight,
  IconMaximize,
  IconMinus,
  IconPlus,
  IconServer,
  IconTopologyStar,
} from '@tabler/icons-react'
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
  type EdgeProps,
  type NodeProps,
} from '@xyflow/react'

import '@xyflow/react/dist/style.css'

import { useTranslation } from './i18n'
import { resourceIcons } from './icons'
import type {
  GroupNode,
  MapNode,
  ResourceNode,
  RoutedEdge,
  SummaryNode,
} from './layout'
import { layoutMap } from './layout'
import styles from './map.module.css'
import { definitions, type MapResource, type Relation } from './model'

export function ResourceStatus({ resource }: { resource: MapResource }) {
  const { t } = useTranslation()
  const label =
    resource.reason ??
    (resource.desired !== undefined &&
    ['ready', 'notReady', 'running'].includes(resource.status)
      ? `${resource.ready} / ${resource.desired} ${t('status.ready')}`
      : t(`status.${resource.status}`))
  return (
    <span className={styles.status} data-tone={resource.tone} title={label}>
      <span aria-hidden="true" />
      {label}
    </span>
  )
}

const ResourceCard = memo(function ResourceCard({
  data,
}: NodeProps<ResourceNode>) {
  const { resource, showNamespace } = data
  const { t } = useTranslation()
  const Icon = resourceIcons[resource.type]
  const detail = resource.details?.find((item) => item.value)
  return (
    <button
      type="button"
      className={`${styles.resource} nodrag nopan`}
      aria-label={`${resource.kind} ${resource.name}`}
      data-tone={resource.tone}
    >
      <Handle type="target" position={Position.Left} />
      <div className={styles.resourceHeading}>
        <Icon size={15} stroke={1.7} />
        <span className={styles.kind} title={resource.namespace}>
          {resource.kind}
          {showNamespace && resource.namespace
            ? ` · ${resource.namespace}`
            : ''}
        </span>
      </div>
      <span className={styles.resourceName} title={resource.name}>
        {resource.name}
      </span>
      <div className={styles.resourceHealth}>
        <ResourceStatus resource={resource} />
        {resource.restarts !== undefined && (
          <span data-restarts={resource.restarts > 0 || undefined}>
            {t('card.restarts', { count: resource.restarts })}
          </span>
        )}
      </div>
      <div className={styles.resourceDetail}>
        {resource.nodeName && resource.type === 'pods' ? (
          <span title={resource.nodeName}>
            {t('fields.node')}: {resource.nodeName}
          </span>
        ) : detail ? (
          <span title={detail.value}>
            {t(`fields.${detail.label}`)}:{' '}
            {detail.label === 'image'
              ? detail.value.split('/').pop()
              : detail.value}
          </span>
        ) : (
          <span>{resource.namespace ?? t('groups.cluster')}</span>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </button>
  )
})

const ResourceSummary = memo(function ResourceSummary({
  data,
}: NodeProps<SummaryNode>) {
  const { t } = useTranslation()
  const Icon =
    resourceIcons[
      data.kind === 'helm'
        ? 'secrets'
        : data.kind === 'history'
          ? 'replicasets'
          : 'pods'
    ]
  const summary = t(`summary.${data.kind}`, { count: data.members.length })
  return (
    <button
      className={`${styles.resource} ${styles.summaryCard} nodrag nopan`}
      onClick={data.onToggle}
      aria-expanded={data.expanded}
      aria-label={`${t(data.expanded ? 'actions.collapse' : 'actions.expand')} ${t(`summary.${data.kind}`, { count: data.members.length })} · ${data.owner}`}
    >
      <Handle type="target" position={Position.Left} />
      <div className={styles.resourceHeading}>
        <Icon size={15} />
        <span className={styles.kind}>
          {data.kind === 'helm'
            ? `Helm · ${data.members[0].namespace}`
            : data.kind === 'history'
              ? 'ReplicaSet'
              : 'Pod'}
        </span>
        <span className={styles.summaryCount}>{data.members.length}</span>
      </div>
      <span
        className={styles.resourceName}
        title={data.kind === 'helm' ? data.owner : summary}
      >
        {data.kind === 'helm' ? data.owner : summary}
      </span>
      <span
        className={styles.resourceDetail}
        title={data.kind === 'helm' ? summary : data.owner}
      >
        {data.kind === 'helm' ? summary : data.owner}
      </span>
      <span className={styles.summaryAction}>
        {t(data.expanded ? 'actions.collapse' : 'actions.expand')}
        {data.expanded ? (
          <IconChevronDown size={12} />
        ) : (
          <IconChevronRight size={12} />
        )}
      </span>
      <Handle type="source" position={Position.Right} />
    </button>
  )
})

const NamespaceGroup = memo(function NamespaceGroup({
  data,
}: NodeProps<GroupNode>) {
  const { t } = useTranslation()
  const Icon = data.grouping === 'node' ? IconServer : IconTopologyStar
  const name =
    data.name === '@cluster'
      ? t('groups.cluster')
      : data.name === '@shared'
        ? t('groups.shared')
        : data.name === '@unassigned'
          ? t('groups.unassigned')
          : data.name
  return (
    <div className={styles.group} data-expanded={data.expanded}>
      <button
        className={`${styles.groupHeader} nodrag nopan`}
        onClick={data.onToggle}
        aria-expanded={data.expanded}
        aria-label={`${data.expanded ? t('actions.collapse') : t('actions.expand')} ${name}`}
      >
        <Icon size={20} stroke={1.7} className={styles.groupIcon} />
        <span className={styles.groupName} title={name}>
          {name}
        </span>
        <span className={styles.count}>
          {t('resources', { count: data.count })}
        </span>
        {data.issues > 0 && (
          <span className={styles.issueCount}>
            <IconAlertCircle size={13} />
            {t('issues', { count: data.issues })}
          </span>
        )}
        {data.expanded ? (
          <IconChevronDown size={17} className={styles.chevron} />
        ) : (
          <IconChevronRight size={17} className={styles.chevron} />
        )}
      </button>
    </div>
  )
})

const nodeTypes = {
  resource: ResourceCard,
  namespace: NamespaceGroup,
  summary: ResourceSummary,
}

function RelationEdge({ id, data, style, markerEnd }: EdgeProps<RoutedEdge>) {
  const path = data!.points
    .map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`)
    .join(' ')
  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
      <circle
        cx={data!.points[0].x}
        cy={data!.points[0].y}
        r={2.5}
        fill={style?.stroke}
      />
    </>
  )
}

const edgeTypes = { routed: RelationEdge }

function FitLayout({ layoutKey }: { layoutKey: string }) {
  const { fitView, viewportInitialized } = useReactFlow()
  useEffect(() => {
    if (!viewportInitialized) return
    const frame = requestAnimationFrame(
      () =>
        void fitView({
          padding: 0.06,
          maxZoom: 1,
          includeHiddenNodes: true,
        })
    )
    return () => cancelAnimationFrame(frame)
  }, [viewportInitialized, fitView, layoutKey])
  return null
}

function MapControls() {
  const { t } = useTranslation()
  const { zoom } = useViewport()
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  return (
    <Panel position="bottom-right" className={styles.controls}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('actions.zoomOut')}
        onClick={() => void zoomOut()}
      >
        <IconMinus size={16} />
      </Button>
      <span>{Math.round(zoom * 100)}%</span>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('actions.zoomIn')}
        onClick={() => void zoomIn()}
      >
        <IconPlus size={16} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('actions.fit')}
        onClick={() =>
          void fitView({ padding: 0.08, maxZoom: 1, includeHiddenNodes: true })
        }
      >
        <IconMaximize size={16} />
      </Button>
    </Panel>
  )
}

export function ResourceGraph({
  graph,
  selectedId,
  onSelect,
  onClear,
}: {
  graph: Awaited<ReturnType<typeof layoutMap>>
  selectedId: string | null
  onSelect: (resource: MapResource) => void
  onClear: () => void
}) {
  const { t } = useTranslation()
  const { actualTheme } = useTheme()
  const isMobile = useIsMobile()
  const edges = useMemo(() => {
    if (!selectedId) return graph.edges
    const selected = graph.nodes.find(
      (node) =>
        node.id === selectedId ||
        (node.type === 'summary' &&
          !node.data.expanded &&
          node.data.members.some((resource) => resource.id === selectedId))
    )
    if (!selected) return graph.edges
    const byId = new Map(graph.nodes.map((node) => [node.id, node]))
    const incoming = new Map<string, Relation[]>()
    const outgoing = new Map<string, Relation[]>()
    for (const relation of graph.relations) {
      incoming.set(relation.target, [
        ...(incoming.get(relation.target) ?? []),
        relation,
      ])
      outgoing.set(relation.source, [
        ...(outgoing.get(relation.source) ?? []),
        relation,
      ])
    }
    const highlighted = new Set<string>()
    const consumers = new Set([selected.id])
    // A selected dependency may lead to several workloads; stop at their boundaries.
    for (const id of consumers) {
      const node = byId.get(id)!
      if (
        (node.type === 'resource' &&
          definitions[node.data.resource.type].category === 'workloads') ||
        (node.type === 'summary' && node.data.kind !== 'helm')
      )
        continue
      for (const relation of outgoing.get(id) ?? []) {
        highlighted.add(relation.id)
        consumers.add(relation.target)
      }
    }
    const workloads = new Set(consumers)
    for (const id of workloads) {
      for (const relation of [
        ...(incoming.get(id) ?? []),
        ...(outgoing.get(id) ?? []),
      ]) {
        if (relation.kind !== 'owner') continue
        highlighted.add(relation.id)
        workloads.add(
          relation.source === id ? relation.target : relation.source
        )
      }
    }
    // Follow dependencies upstream without returning through them to other consumers.
    const dependencies = new Set(workloads)
    for (const id of dependencies) {
      for (const relation of incoming.get(id) ?? []) {
        highlighted.add(relation.id)
        dependencies.add(relation.source)
      }
    }
    return graph.edges.map((edge) =>
      highlighted.has(edge.id)
        ? {
            ...edge,
            style: {
              ...edge.style,
              stroke: 'var(--primary)',
              strokeWidth: 2,
              opacity: 1,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: 'var(--primary)',
              width: 12,
              height: 12,
            },
          }
        : edge
    )
  }, [graph, selectedId])
  const layoutKey = graph.nodes
    .map(
      (n) => `${n.id}:${n.position.x}:${n.position.y}:${n.width}:${n.height}`
    )
    .join('|')
  return (
    <ReactFlowProvider key={String(isMobile)}>
      <ReactFlow<MapNode>
        colorMode={actualTheme}
        nodes={graph.nodes}
        edges={edges}
        edgeTypes={edgeTypes}
        elementsSelectable={false}
        nodesFocusable={false}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => {
          if (node.type === 'resource') onSelect(node.data.resource)
        }}
        onPaneClick={onClear}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesReconnectable={false}
        deleteKeyCode={null}
        minZoom={0.15}
        maxZoom={1.8}
        fitView
        fitViewOptions={{
          padding: 0.06,
          maxZoom: 1,
          includeHiddenNodes: true,
        }}
        onlyRenderVisibleElements
        className={styles.flow}
        ariaLabelConfig={{
          'minimap.ariaLabel': t('minimap'),
        }}
      >
        <FitLayout layoutKey={layoutKey} />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="var(--border)"
        />
        <MiniMap
          pannable
          zoomable
          position="bottom-right"
          className={styles.minimap}
          nodeColor={(node) =>
            node.type === 'namespace' ? 'var(--muted)' : 'var(--border)'
          }
          maskColor="color-mix(in oklab, var(--background) 65%, transparent)"
        />
        <MapControls />
      </ReactFlow>
    </ReactFlowProvider>
  )
}
