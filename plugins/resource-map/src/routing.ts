import dagre from '@dagrejs/dagre'
import type { Edge } from '@xyflow/react'

import type { MapNode, RoutedEdge } from './layout'

export function routeEdges(
  nodes: MapNode[],
  edges: Edge[],
  reservedRoutes: { x: number; y: number }[][]
): RoutedEdge[] {
  if (!edges.length) return []
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const boxes = new Map(
    nodes
      .filter((node) => node.type !== 'namespace')
      .map((node) => {
        const parent = byId.get(node.parentId!)!
        return [
          node.id,
          {
            x: node.position.x + parent.position.x,
            y: node.position.y + parent.position.y,
            width: node.width!,
            height: node.height!,
          },
        ]
      })
  )
  const obstacles = [
    ...boxes.values(),
    ...nodes
      .filter((node) => node.type === 'namespace')
      .map((node) => ({
        ...node.position,
        width: node.width!,
        height: node.data.expanded ? 48 : 54,
      })),
  ]
  const ports = new Map<string, number[]>()
  const endpoint = (id: string, right: boolean) => {
    const box = boxes.get(id)!
    const x = box.x + (right ? box.width : 0)
    const key = `${id}:${right}`
    const used =
      ports.get(key) ??
      reservedRoutes.flatMap((points) =>
        [points[0], points[points.length - 1]]
          .filter(
            (point) =>
              point.x === x && point.y > box.y && point.y < box.y + box.height
          )
          .map((point) => point.y)
      )
    const boundaries = [box.y + 8, ...used, box.y + box.height - 8].sort(
      (a, b) => a - b
    )
    let widest = 0
    for (let i = 1; i < boundaries.length - 1; i++)
      if (
        boundaries[i + 1] - boundaries[i] >
        boundaries[widest + 1] - boundaries[widest]
      )
        widest = i
    const y = (boundaries[widest] + boundaries[widest + 1]) / 2
    ports.set(key, [...used, y])
    return { x, y }
  }
  const connections = edges.map((edge) => {
    const source = boxes.get(edge.source)!
    const target = boxes.get(edge.target)!
    const sourceRight = source.x <= target.x
    const targetRight = source.x >= target.x
    return {
      edge,
      sourceRight,
      targetRight,
      start: endpoint(edge.source, sourceRight),
      end: endpoint(edge.target, targetRight),
    }
  })
  const xs = [
    ...new Set(
      obstacles.flatMap((box) => [
        box.x - 16,
        box.x - 8,
        box.x + box.width + 8,
        box.x + box.width + 16,
      ])
    ),
  ].sort((a, b) => a - b)
  const ys = [
    ...new Set([
      ...obstacles.flatMap((box) => [
        box.y - 16,
        box.y - 8,
        box.y + box.height + 8,
        box.y + box.height + 16,
      ]),
      ...connections.flatMap(({ start, end }) => [start.y, end.y]),
    ]),
  ].sort((a, b) => a - b)
  const grid = new dagre.graphlib.Graph()
  const clear = (x1: number, y1: number, x2: number, y2: number) =>
    !obstacles.some(
      (box) =>
        Math.max(x1, x2) > box.x - 2 &&
        Math.min(x1, x2) < box.x + box.width + 2 &&
        Math.max(y1, y2) > box.y - 2 &&
        Math.min(y1, y2) < box.y + box.height + 2
    )
  // Card boundaries form routing lanes; connect only segments that clear every card.
  for (let x = 0; x < xs.length; x++) {
    for (let y = 0; y < ys.length; y++) {
      if (!clear(xs[x], ys[y], xs[x], ys[y])) continue
      const id = `${x}:${y}`
      grid.setNode(`${id}:h`, { x: xs[x], y: ys[y] })
      grid.setNode(`${id}:v`, { x: xs[x], y: ys[y] })
      grid.setEdge(`${id}:h`, `${id}:v`, { weight: 20 })
      grid.setEdge(`${id}:v`, `${id}:h`, { weight: 20 })
      if (
        x &&
        grid.hasNode(`${x - 1}:${y}:h`) &&
        clear(xs[x - 1], ys[y], xs[x], ys[y])
      ) {
        grid.setEdge(`${id}:h`, `${x - 1}:${y}:h`, {
          weight: xs[x] - xs[x - 1],
        })
        grid.setEdge(`${x - 1}:${y}:h`, `${id}:h`, {
          weight: xs[x] - xs[x - 1],
        })
      }
      if (
        y &&
        grid.hasNode(`${x}:${y - 1}:v`) &&
        clear(xs[x], ys[y - 1], xs[x], ys[y])
      ) {
        grid.setEdge(`${id}:v`, `${x}:${y - 1}:v`, {
          weight: ys[y] - ys[y - 1],
        })
        grid.setEdge(`${x}:${y - 1}:v`, `${id}:v`, {
          weight: ys[y] - ys[y - 1],
        })
      }
    }
  }
  const occupied = reservedRoutes.flatMap((points) =>
    points.slice(1).map((end, index) => ({ start: points[index], end }))
  )
  return connections.map(({ edge, sourceRight, targetRight, start, end }) => {
    const from = `${xs.indexOf(start.x + (sourceRight ? 8 : -8))}:${ys.indexOf(start.y)}:h`
    const to = `${xs.indexOf(end.x + (targetRight ? 8 : -8))}:${ys.indexOf(end.y)}:h`
    const routes = dagre.graphlib.alg.dijkstra(grid, from, (step) => {
      const a = grid.node(step.v),
        b = grid.node(step.w)
      const overlaps = occupied.some(({ start, end }) =>
        a.x === b.x && start.x === end.x && a.x === start.x
          ? Math.min(Math.max(a.y, b.y), Math.max(start.y, end.y)) >
            Math.max(Math.min(a.y, b.y), Math.min(start.y, end.y))
          : a.y === b.y &&
            start.y === end.y &&
            a.y === start.y &&
            Math.min(Math.max(a.x, b.x), Math.max(start.x, end.x)) >
              Math.max(Math.min(a.x, b.x), Math.min(start.x, end.x))
      )
      return grid.edge(step).weight + (overlaps ? 10000 : 0)
    })
    const points = [end]
    for (
      let step: string | undefined = to;
      step;
      step = routes[step].predecessor
    )
      points.push(grid.node(step))
    points.push(start)
    points.reverse()
    const unique = points.filter(
      (point, index) =>
        !index ||
        point.x !== points[index - 1].x ||
        point.y !== points[index - 1].y
    )
    occupied.push(
      ...points.slice(1).map((end, index) => ({ start: points[index], end }))
    )
    return {
      ...edge,
      type: 'routed',
      data: {
        points: unique.filter((point, index) => {
          const before = unique[index - 1],
            after = unique[index + 1]
          return (
            !before ||
            !after ||
            !(
              (before.x === point.x && point.x === after.x) ||
              (before.y === point.y && point.y === after.y)
            )
          )
        }),
      },
    }
  })
}
