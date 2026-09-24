import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type { ELK, ElkNode, ElkPoint } from 'elkjs/lib/elk-api.js'

import { isIssue, type MapResource, type Relation } from './model'
import { routeEdges } from './routing'

export type Grouping = 'namespace' | 'node'
export type ResourceNode = Node<
  { resource: MapResource; showNamespace: boolean },
  'resource'
>
export type SummaryNode = Node<
  {
    kind: 'history' | 'replicas' | 'helm' | 'standalone'
    owner: string
    members: MapResource[]
    expanded: boolean
    onToggle: () => void
  },
  'summary'
>
export type GroupNode = Node<
  {
    name: string
    count: number
    issues: number
    expanded: boolean
    grouping: Grouping
    onToggle: () => void
  },
  'namespace'
>
export type MapNode = ResourceNode | GroupNode | SummaryNode
export type RoutedEdge = Edge<{ points: { x: number; y: number }[] }, 'routed'>

const cardWidth = 224
const cardHeight = 96
const gap = 24

export async function layoutMap(
  elk: ELK,
  resources: MapResource[],
  allResources: MapResource[],
  allRelations: Relation[],
  grouping: Grouping,
  expanded: Record<string, boolean>,
  revealMatches: boolean,
  toggle: (id: string, current: boolean) => void,
  canvasWidth: number
) {
  const resourceIds = new Set(resources.map((r) => r.id))
  const byId = new Map(allResources.map((r) => [r.id, r]))
  const hosts = new Map(
    allResources.map((r) => [r.id, new Set(r.nodeName ? [r.nodeName] : [])])
  )
  if (grouping === 'node') {
    let changed = true
    while (changed) {
      changed = false
      for (const edge of allRelations) {
        if (edge.kind === 'node') continue
        const source = hosts.get(edge.source)!
        for (const node of hosts.get(edge.target)!) {
          if (!source.has(node)) {
            source.add(node)
            changed = true
          }
        }
      }
    }
  }
  const groups = new Map<string, MapResource[]>()
  const membership = new Map<string, string>()
  for (const resource of allResources) {
    const locations = hosts.get(resource.id)!
    const name =
      grouping === 'namespace'
        ? (resource.namespace ?? '@cluster')
        : locations.size === 1
          ? [...locations][0]
          : locations.size > 1
            ? '@shared'
            : '@unassigned'
    const id = `group:${grouping}:${name}`
    membership.set(resource.id, id)
    if (resourceIds.has(resource.id)) {
      const group = groups.get(id) ?? []
      group.push(resource)
      groups.set(id, group)
    }
  }

  const ownersWithPods = new Set(
    allRelations
      .filter(
        (edge) =>
          edge.kind === 'owner' && byId.get(edge.target)?.type === 'pods'
      )
      .map((edge) => edge.source)
  )
  const summaries = new Map<string, SummaryNode['data']>()
  const hiddenBy = new Map<string, string>()
  for (const resource of resources) {
    const owner = resource.metadata.ownerReferences?.find(
      (ref) => ref.controller
    )
    if (!resource.helmRelease && (!owner || !byId.has(owner.uid))) continue
    const history =
      resource.type === 'replicasets' &&
      resource.desired === 0 &&
      resource.ready === 0 &&
      resource.current === 0 &&
      !ownersWithPods.has(resource.id) &&
      resource.status !== 'terminating' &&
      !isIssue(resource)
    const replicas =
      resource.type === 'pods' &&
      resource.status === 'running' &&
      !isIssue(resource) &&
      resource.restarts === 0
    if (!history && !replicas && !resource.helmRelease) continue
    const kind = resource.helmRelease
      ? 'helm'
      : history
        ? 'history'
        : 'replicas'
    const ownerId = resource.helmRelease
      ? `${resource.namespace}/${resource.helmRelease}`
      : owner!.uid
    const id = `summary:${membership.get(resource.id)}:${ownerId}:${kind}`
    const summary = summaries.get(id) ?? {
      kind,
      owner: resource.helmRelease ?? byId.get(owner!.uid)!.name,
      members: [],
      expanded: false,
      onToggle: () => {},
    }
    summary.members.push(resource)
    summaries.set(id, summary)
  }
  const connected = new Set<string>()
  for (const edge of allRelations) {
    connected.add(edge.source)
    // A bound PV does not mean the claim is used by a Pod.
    if (
      byId.get(edge.source)!.type !== 'persistentvolumes' ||
      byId.get(edge.target)!.type !== 'persistentvolumeclaims'
    )
      connected.add(edge.target)
  }
  for (const resource of resources) {
    if (resource.helmRelease || connected.has(resource.id)) continue
    const id = `summary:${membership.get(resource.id)}:${resource.type}:standalone`
    const summary = summaries.get(id) ?? {
      kind: 'standalone',
      owner: resource.kind,
      members: [],
      expanded: false,
      onToggle: () => {},
    }
    summary.members.push(resource)
    summaries.set(id, summary)
  }
  for (const [id, summary] of summaries) {
    if (
      summary.members.length <
        (summary.kind === 'replicas'
          ? 5
          : summary.kind === 'standalone'
            ? 4
            : 2) ||
      revealMatches
    ) {
      summaries.delete(id)
      continue
    }
    summary.expanded = expanded[id] ?? false
    summary.onToggle = () => toggle(id, summary.expanded)
    membership.set(id, membership.get(summary.members[0].id)!)
    for (const resource of summary.members) {
      if (!summary.expanded) hiddenBy.set(resource.id, id)
    }
  }
  const projected = new Map<string, Relation>()
  for (const edge of allRelations) {
    if (!resourceIds.has(edge.source) || !resourceIds.has(edge.target)) continue
    const source = hiddenBy.get(edge.source) ?? edge.source
    const target = hiddenBy.get(edge.target) ?? edge.target
    if (source === target) continue
    const id = `${source}:${target}:${edge.kind}`
    projected.set(id, { ...edge, id, source, target })
  }
  const relations = [...projected.values()]
  const ordered = [...groups].sort(
    ([a, ar], [b, br]) =>
      Number(br.some(isIssue)) - Number(ar.some(isIssue)) ||
      br.length - ar.length ||
      a.localeCompare(b)
  )
  const maxWidth = Math.max(784, canvasWidth / 0.85 - 48)
  const layouts = await Promise.all(
    ordered.map(async ([id, members]) => {
      const open =
        expanded[id] ??
        (!id.endsWith(':@cluster') || revealMatches || groups.size === 1)
      const memberIds = members
        .filter((r) => !hiddenBy.has(r.id))
        .map((r) => r.id)
      memberIds.push(
        ...[...summaries.keys()].filter((key) => membership.get(key) === id)
      )
      const positions = new Map<string, ElkPoint>()
      const paths = new Map<string, ElkPoint[]>()
      let width = 360
      let height = 56
      if (open) {
        const internal = relations.filter(
          (edge) =>
            membership.get(edge.source) === id &&
            membership.get(edge.target) === id
        )
        const connected = new Set(
          internal.flatMap((edge) => [edge.source, edge.target])
        )
        const detached = memberIds.filter((key) => !connected.has(key))
        const diagram: ElkNode = await elk.layout({
          id,
          layoutOptions: {
            'elk.algorithm': 'layered',
            'elk.direction': 'RIGHT',
            'elk.edgeRouting': 'ORTHOGONAL',
            'elk.padding': '[top=0,left=0,bottom=0,right=0]',
            'elk.spacing.nodeNode': '28',
            'elk.spacing.edgeNode': '20',
            'elk.layered.spacing.nodeNodeBetweenLayers': '80',
            'elk.layered.spacing.edgeEdgeBetweenLayers': '16',
            'elk.layered.spacing.edgeNodeBetweenLayers': '24',
            'elk.layered.mergeEdges': 'false',
            'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
          },
          children: memberIds
            .filter((key) => connected.has(key))
            .map((key) => ({
              id: key,
              width: cardWidth,
              height: cardHeight,
            })),
          // Dependencies sit to the right of consumers; retain the actual arrow direction below.
          edges: internal.map((edge) => ({
            id: edge.id,
            sources: [edge.kind === 'owner' ? edge.source : edge.target],
            targets: [edge.kind === 'owner' ? edge.target : edge.source],
          })),
        })
        for (const node of diagram.children!)
          positions.set(node.id, { x: node.x! + 24, y: node.y! + 64 })
        for (const edge of diagram.edges!) {
          const section = edge.sections![0]
          const points = [
            section.startPoint,
            ...(section.bendPoints ?? []),
            section.endPoint,
          ]
          if (projected.get(edge.id)!.kind !== 'owner') points.reverse()
          paths.set(
            edge.id,
            points.map((point) => ({ x: point.x + 24, y: point.y + 64 }))
          )
        }
        width = Math.max(width, diagram.width! + 48)
        height = 64 + diagram.height!
        const occupied = diagram.children!.map((node) => ({
          x: node.x! + 24,
          y: node.y! + 64,
          width: cardWidth,
          height: cardHeight,
        }))
        const corridors = [...paths.values()].flatMap((points) =>
          points.slice(1).map((end, index) => {
            const start = points[index]
            return {
              x: Math.min(start.x, end.x) - 12,
              y: Math.min(start.y, end.y) - 12,
              width: Math.abs(start.x - end.x) + 24,
              height: Math.abs(start.y - end.y) + 24,
            }
          })
        )
        const columnsX = [...new Set(occupied.map((box) => box.x))].sort(
          (a, b) => b - a
        )
        const remaining: string[] = []
        // Fill empty columns without moving connected resources or entering their routing corridors.
        for (const key of detached) {
          const rowsY = [
            ...new Set([
              64,
              ...occupied.map((box) => box.y + box.height + gap),
              ...corridors.map((box) => box.y + box.height),
            ]),
          ].sort((a, b) => a - b)
          let slot: ElkPoint | undefined
          for (const x of columnsX) {
            for (const y of rowsY) {
              if (y + cardHeight > height) continue
              if (
                occupied.some(
                  (box) =>
                    x < box.x + box.width + gap &&
                    x + cardWidth + gap > box.x &&
                    y < box.y + box.height + gap &&
                    y + cardHeight + gap > box.y
                )
              )
                continue
              if (
                corridors.some(
                  (box) =>
                    x < box.x + box.width &&
                    x + cardWidth > box.x &&
                    y < box.y + box.height &&
                    y + cardHeight > box.y
                )
              )
                continue
              slot = { x, y }
              break
            }
            if (slot) break
          }
          if (slot) {
            positions.set(key, slot)
            occupied.push({ ...slot, width: cardWidth, height: cardHeight })
          } else remaining.push(key)
        }
        const columns = Math.max(
          1,
          Math.min(
            remaining.length,
            Math.floor(
              (Math.max(maxWidth, width) - 48 + gap) / (cardWidth + gap)
            )
          )
        )
        if (connected.size && remaining.length) height += 36
        remaining.forEach((key, index) =>
          positions.set(key, {
            x: 24 + (index % columns) * (cardWidth + gap),
            y: height + Math.floor(index / columns) * (cardHeight + gap),
          })
        )
        if (remaining.length) {
          width = Math.max(width, columns * (cardWidth + gap) - gap + 48)
          height +=
            Math.ceil(remaining.length / columns) * (cardHeight + gap) - gap
        }
        height += 24
      }
      return { id, members, memberIds, open, positions, paths, width, height }
    })
  )
  const nodes: MapNode[] = []
  const visible = new Set<string>()
  const routes = new Map<string, ElkPoint[]>()
  let x = 0,
    y = 0,
    rowHeight = 0
  for (const layout of layouts) {
    const { id, members, memberIds, open, positions, width, height } = layout
    if (x && x + width > maxWidth) {
      x = 0
      y += rowHeight + gap
      rowHeight = 0
    }
    nodes.push({
      id,
      type: 'namespace',
      position: { x, y },
      width,
      height,
      style: { width, height },
      draggable: false,
      selectable: false,
      focusable: false,
      data: {
        name: id.slice(`group:${grouping}:`.length),
        count: members.length,
        issues: members.filter(isIssue).length,
        expanded: open,
        grouping,
        onToggle: () => toggle(id, open),
      },
    })
    if (open) {
      for (const key of memberIds) {
        visible.add(key)
        const base = {
          id: key,
          parentId: id,
          extent: 'parent' as const,
          position: positions.get(key)!,
          width: cardWidth,
          height: cardHeight,
          zIndex: 2,
          draggable: false,
        }
        const summary = summaries.get(key)
        if (summary) {
          nodes.push({
            ...base,
            type: 'summary',
            selectable: false,
            focusable: false,
            data: summary,
          })
        } else {
          const resource = byId.get(key)!
          nodes.push({
            ...base,
            type: 'resource',
            ariaLabel: `${resource.kind} ${resource.name}`,
            data: {
              resource,
              showNamespace: grouping === 'node',
            },
          })
        }
      }
    }
    for (const [edgeId, points] of layout.paths)
      routes.set(
        edgeId,
        points.map((point) => ({ x: point.x + x, y: point.y + y }))
      )
    x += width + gap
    rowHeight = Math.max(rowHeight, height)
  }
  const visibleRelations = relations.filter(
    (edge) => visible.has(edge.source) && visible.has(edge.target)
  )
  const edges: Edge[] = visibleRelations.map((edge) => ({
    ...edge,
    type: 'routed',
    selectable: false,
    focusable: false,
    zIndex: 1,
    style: {
      stroke:
        edge.kind === 'owner' ? 'var(--muted-foreground)' : 'var(--primary)',
      strokeWidth: 1.25,
      strokeLinejoin: 'round',
      opacity: 0.7,
      strokeDasharray: edge.kind === 'owner' ? undefined : '5 4',
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color:
        edge.kind === 'owner' ? 'var(--muted-foreground)' : 'var(--primary)',
      width: 12,
      height: 12,
    },
  }))
  const crossGroup = new Map(
    routeEdges(
      nodes,
      edges.filter((edge) => !routes.has(edge.id)),
      [...routes.values()]
    ).map((edge) => [edge.id, edge])
  )
  return {
    nodes,
    relations: visibleRelations,
    edges: edges.map((edge) =>
      routes.has(edge.id)
        ? {
            ...edge,
            type: 'routed' as const,
            data: { points: routes.get(edge.id)! },
          }
        : crossGroup.get(edge.id)!
    ),
    foldedCount: hiddenBy.size,
  }
}
